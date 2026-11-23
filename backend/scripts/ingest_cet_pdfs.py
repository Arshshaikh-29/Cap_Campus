"""
Exact coordinate-based parser for Official Maharashtra State CET Cell
Engineering CAP Round Cutoff PDFs (2025 Round 4 + 2026 Rounds 1–4).

Extracts (college_code, college_name, city, choice_code, branch_name,
quota_level, stage, category, merit_rank, percentile, year, round_number)
directly from official vector PDFs with X-coordinate column matching so
sparse Stage rows (e.g. Stage VII, I-Non PWD) NEVER misalign.
"""

import os
import re
import shutil
import sqlite3
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pymupdf

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.scripts.ingest_csv import (
    CITY_OVERRIDES,
    COLLEGE_CODE_ALIASES,
    KNOWN_CITIES,
)

PDF_DIR = Path(
    r"C:\Users\arsha\.gemini\antigravity\brain\3da57514-694e-4b66-bd06-a7a631144ddc\scratch\cet_pdfs"
)

PDF_SOURCES = [
    (2025, 4, PDF_DIR / "2025_CAP4_MH_real.pdf"),
    (2026, 1, PDF_DIR / "2026_CAP1_MH.pdf"),
    (2026, 2, PDF_DIR / "2026_CAP2_MH.pdf"),
    (2026, 3, PDF_DIR / "2026_CAP3_MH.pdf"),
    (2026, 4, PDF_DIR / "2026_CAP4_MH.pdf"),
]

# Valid CET Cell category codes
CAT_CODE_RE = re.compile(
    r"^(?:(?:PWDR|DEFR|PWD|DEF|G|L)(?:OPEN|OBC|SEBC|SC|ST|VJ|NT1|NT2|NT3)[SHO]?|EWS|TFWS|MI|MI-MH|MI-AI|ORPHAN[A-Z]?|DEFROBCS|DEFRSEBCS|PWDROBCS)$"
)
COLLEGE_HDR_RE = re.compile(r"^(\d{5})\s*-\s*(.+)$")
CHOICE_HDR_RE = re.compile(r"^(\d{9,10}[A-Z]?)\s*-\s*(.+)$")
RANK_RE = re.compile(r"^\d{1,6}$")
PCT_RE = re.compile(r"^\((\d{1,3}(?:\.\d+)?)\)$")

# Canonical branch name mapping to align minor CET Cell spelling variants across years
BRANCH_ALIASES = {
    "electronics and telecommunication engg": "Electronics and Telecommunication Engg",
    "electronics & telecommunication engineering": "Electronics and Telecommunication Engg",
    "electronics and telecommunication engineering": "Electronics and Telecommunication Engg",
    "artificial intelligence (ai) and data science": "Artificial Intelligence and Data Science",
    "artificial intelligence and data science": "Artificial Intelligence and Data Science",
    "artificial intelligence (ai) and machine learning": "Artificial Intelligence and Machine Learning",
    "artificial intelligence and machine learning": "Artificial Intelligence and Machine Learning",
    "computer science and engineering(artificial intelligence and machine learning)": "Computer Science and Engineering(Artificial Intelligence and Machine Learning)",
    "computer science and engineering (artificial intelligence and machine learning)": "Computer Science and Engineering(Artificial Intelligence and Machine Learning)",
    "computer science and engineering(data science)": "Computer Science and Engineering(Data Science)",
    "computer science and engineering (data science)": "Computer Science and Engineering(Data Science)",
    "computer science and engineering (cyber security)": "Computer Science and Engineering (Cyber Security)",
    "computer science and engineering(cyber security)": "Computer Science and Engineering (Cyber Security)",
    "instrumentation & control engineering": "Instrumentation and Control Engineering",
    "instrumentation and control engineering": "Instrumentation and Control Engineering",
    "automation & robotics": "Automation and Robotics",
    "robotics & automation": "Robotics and Automation",
    "production engineering [sandwich]": "Production Engineering[Sandwich]",
}


def norm_college_code(raw5: str) -> str:
    c = raw5.strip()
    if c in COLLEGE_CODE_ALIASES:
        return COLLEGE_CODE_ALIASES[c]
    if len(c) == 5 and c.startswith("0"):
        c = c[1:]
    return COLLEGE_CODE_ALIASES.get(c, c)


def norm_choice_code(raw: str, norm_col: str) -> str:
    c = raw.strip()
    if len(c) == 10 and c.startswith("0"):
        return c[1:]
    if c.startswith("16006"):
        return "6006" + c[5:]
    if c.startswith("14005"):
        return "4005" + c[5:]
    return c


def norm_branch(raw_branch: str) -> str:
    b = re.sub(r"\s+", " ", raw_branch).strip()
    b = re.sub(r",(?=\S)", ", ", b)
    # Strip trailing [Shift] / intake annotations if present
    b = re.sub(r"\s*\[(?:First|Second)\s+Shift\]\s*$", "", b, flags=re.I).strip()
    low = b.lower()
    if low in BRANCH_ALIASES:
        return BRANCH_ALIASES[low]
    return b


def norm_category(cat: str) -> str:
    c = cat.strip().upper()
    if c.startswith("ORPHAN"):
        return "ORPHAN"
    if c in ("MI-MH", "MI-AI"):
        return "MI"
    return c


def infer_city(college_code: str, college_name: str, existing_cities: Dict[str, str]) -> str:
    if college_code in CITY_OVERRIDES:
        return CITY_OVERRIDES[college_code]
    if college_code in existing_cities and existing_cities[college_code] != "Unknown":
        return existing_cities[college_code]
    low = college_name.lower()
    for city_name, keywords in KNOWN_CITIES:
        for kw in keywords:
            if kw in low:
                return city_name
    return "Maharashtra"


def parse_pdf(
    pdf_path: Path,
    year: int,
    round_number: int,
    existing_names: Dict[str, str],
    existing_cities: Dict[str, str],
) -> List[Tuple]:
    t0 = time.time()
    doc = pymupdf.open(str(pdf_path))
    rows_out: List[Tuple] = []

    cur_col_code: Optional[str] = None
    cur_col_name: Optional[str] = None
    cur_city: Optional[str] = None
    cur_choice_code: Optional[str] = None
    cur_branch: Optional[str] = None
    cur_quota: str = "State Level"
    col_headers: List[Tuple[float, str]] = []  # (center_x, category)
    pending_ranks: Optional[Tuple[str, Dict[int, int]]] = None  # (stage, {col_idx: rank})

    for page in doc:
        words = page.get_text("words")  # (x0, y0, x1, y1, word, block, line, word_no)
        if not words:
            continue

        # Cluster words into horizontal visual lines by y-center (tolerance ~3pt)
        words.sort(key=lambda w: (round(w[1] / 3.0), w[0]))
        lines: List[List[Tuple[float, float, float, str]]] = []
        cur_line: List[Tuple[float, float, float, str]] = []
        last_y = None
        for w in words:
            x0, y0, x1, y1, txt = w[0], w[1], w[2], w[3], w[4]
            yc = 0.5 * (y0 + y1)
            if last_y is None or abs(yc - last_y) <= 3.5:
                cur_line.append((x0, x1, yc, txt))
                last_y = yc if last_y is None else 0.7 * last_y + 0.3 * yc
            else:
                cur_line.sort(key=lambda item: item[0])
                lines.append(cur_line)
                cur_line = [(x0, x1, yc, txt)]
                last_y = yc
        if cur_line:
            cur_line.sort(key=lambda item: item[0])
            lines.append(cur_line)

        for line in lines:
            full_text = " ".join(tok[3] for tok in line).strip()
            if not full_text:
                continue

            # Ignore page running headers / boilerplate
            low = full_text.lower()
            if (
                low.startswith("government of maharashtra")
                or low.startswith("state common entrance test cell")
                or low.startswith("cut off list for")
                or low.startswith("degree courses in engineering")
                or low.startswith("master of engineering")
                or low.startswith("legends:")
                or low.startswith("status:")
            ):
                continue

            # 1. Choice code + branch header (check BEFORE college header since both start with digits)
            m_ch = CHOICE_HDR_RE.match(full_text)
            if m_ch and cur_col_code:
                raw_choice, raw_br = m_ch.group(1), m_ch.group(2)
                cur_choice_code = norm_choice_code(raw_choice, cur_col_code)
                cur_branch = norm_branch(raw_br)
                col_headers = []
                pending_ranks = None
                continue

            # 2. College code + name header
            m_col = COLLEGE_HDR_RE.match(full_text)
            if m_col:
                raw5, raw_name = m_col.group(1), m_col.group(2).strip()
                cur_col_code = norm_college_code(raw5)
                cur_col_name = existing_names.get(cur_col_code) or re.sub(r"\s+", " ", raw_name)
                cur_city = infer_city(cur_col_code, cur_col_name, existing_cities)
                cur_choice_code = None
                cur_branch = None
                col_headers = []
                pending_ranks = None
                continue

            # 3. Quota Level headers
            if "home university seats allotted to other than home university" in low or "other than home university" in low:
                cur_quota = "Other Than Home University"
                col_headers = []
                pending_ranks = None
                continue
            if "home university seats" in low:
                cur_quota = "Home University"
                col_headers = []
                pending_ranks = None
                continue
            if low == "state level" or low.startswith("state level"):
                cur_quota = "State Level"
                col_headers = []
                pending_ranks = None
                continue
            if "minority seats" in low:
                cur_quota = "Minority"
                col_headers = []
                pending_ranks = None
                continue
            if "maharashtra state seats" in low:
                cur_quota = "Maharashtra State"
                col_headers = []
                pending_ranks = None
                continue

            # 4. Category Header Row (starts with Stage)
            if line[0][3] == "Stage" and len(line) >= 2:
                hdrs = []
                for x0, x1, _, txt in line[1:]:
                    c_up = txt.strip().upper()
                    if CAT_CODE_RE.match(c_up):
                        hdrs.append((0.5 * (x0 + x1), norm_category(c_up)))
                if hdrs:
                    col_headers = hdrs
                    pending_ranks = None
                continue

            if not (cur_col_code and cur_branch and col_headers):
                continue

            # 5. Percentile Row (matches pending_ranks)
            pct_tokens = []
            for x0, x1, _, txt in line:
                mp = PCT_RE.match(txt.strip())
                if mp:
                    pct_tokens.append((0.5 * (x0 + x1), float(mp.group(1))))

            if pct_tokens and pending_ranks is not None:
                stage_val, rank_map = pending_ranks
                # Match each percentile token to nearest category column
                for px, pval in pct_tokens:
                    if not (0.0 < pval <= 100.0):
                        continue
                    best_idx = min(
                        range(len(col_headers)),
                        key=lambda i: abs(col_headers[i][0] - px),
                    )
                    if abs(col_headers[best_idx][0] - px) <= 36.0:
                        cat_code = col_headers[best_idx][1]
                        rnk = rank_map.get(best_idx)
                        rows_out.append(
                            (
                                cur_col_code,
                                cur_col_name,
                                cur_city,
                                cur_choice_code,
                                cur_branch,
                                cur_quota,
                                stage_val,
                                cat_code,
                                float(rnk) if rnk is not None else None,
                                pval,
                                year,
                                round_number,
                            )
                        )
                pending_ranks = None
                continue

            # 6. Rank Row (contains integers aligned under col_headers)
            rank_tokens = []
            stage_parts = []
            first_col_x = col_headers[0][0]
            for x0, x1, _, txt in line:
                xc = 0.5 * (x0 + x1)
                t = txt.strip()
                if xc < first_col_x - 22.0:
                    stage_parts.append(t)
                elif RANK_RE.match(t):
                    rank_tokens.append((xc, int(t)))

            if rank_tokens:
                stage_str = " ".join(stage_parts).strip() or "I"
                # Normalize CET Cell stage codes (I, II, III, VII, I-Non, MH, etc.)
                if stage_str.upper().startswith("I-NON"):
                    stage_str = "I-Non PWD"
                rmap: Dict[int, int] = {}
                for rx, rval in rank_tokens:
                    best_idx = min(
                        range(len(col_headers)),
                        key=lambda i: abs(col_headers[i][0] - rx),
                    )
                    if abs(col_headers[best_idx][0] - rx) <= 36.0:
                        rmap[best_idx] = rval
                if rmap:
                    pending_ranks = (stage_str, rmap)

    doc.close()
    print(
        f"Parsed {year} CAP {round_number} ({pdf_path.name}): "
        f"{len(rows_out):,} rows in {time.time() - t0:.1f}s"
    )
    return rows_out


def main():
    db_path = ROOT / "cap_compass.sqlite3"
    con = sqlite3.connect(str(db_path))

    # Load canonical college names & cities from existing DB so naming stays 100% unified
    existing_names: Dict[str, str] = {}
    existing_cities: Dict[str, str] = {}
    for code, name, city in con.execute(
        "SELECT college_code, MAX(college_name), MAX(city) FROM college_records WHERE year <= 2025 AND round_number <= 3 GROUP BY college_code"
    ).fetchall():
        existing_names[code] = name
        existing_cities[code] = city

    all_new_rows: List[Tuple] = []
    for yr, rnd, path in PDF_SOURCES:
        if not path.exists():
            print(f"SKIP missing {path}")
            continue
        all_new_rows.extend(parse_pdf(path, yr, rnd, existing_names, existing_cities))

    # Idempotently replace (2025, 4) and all 2026 rows
    con.execute("DELETE FROM college_records WHERE (year = 2025 AND round_number = 4) OR year = 2026")
    con.executemany(
        """
        INSERT INTO college_records (
            college_code, college_name, city, choice_code, branch_name,
            quota_level, stage, category, merit_rank, percentile, year, round_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        all_new_rows,
    )
    con.commit()

    # Summary check
    print("\n=== UPDATED DB YEARS & ROUNDS ===")
    total = 0
    for yr, rnd, cnt in con.execute(
        "SELECT year, round_number, COUNT(*) FROM college_records GROUP BY year, round_number ORDER BY year, round_number"
    ).fetchall():
        print(f"  {yr} CAP Round {rnd}: {cnt:,} rows")
        total += cnt
    distinct_cols = con.execute("SELECT COUNT(DISTINCT college_code) FROM college_records").fetchone()[0]
    print(f"TOTAL RECORDS: {total:,} | DISTINCT COLLEGES: {distinct_cols}")

    # Spot check premier institutes in 2026 CAP 1 & 4 + 2025 CAP 4
    print("\n=== 2026 SPOT CHECKS (GOPENS, Stage I) ===")
    for code, label in [("3012", "VJTI"), ("6006", "COEP"), ("3014", "SPCE"), ("3215", "SPIT"), ("6271", "PICT")]:
        rows = con.execute(
            """
            SELECT year, round_number, branch_name, merit_rank, ROUND(percentile, 2)
            FROM college_records
            WHERE college_code=? AND category='GOPENS' AND stage='I' AND year=2026
            ORDER BY round_number, merit_rank
            LIMIT 8
            """,
            (code,),
        ).fetchall()
        print(f"  {label} ({code}) 2026 sample:", rows[:4])

    con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    con.execute("PRAGMA journal_mode=DELETE")
    con.execute("VACUUM")
    con.close()
    print("Database updated and vacuumed successfully.")


if __name__ == "__main__":
    main()
