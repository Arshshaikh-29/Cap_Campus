import os
import re
import secrets
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import asc, desc, func, or_
from sqlalchemy.orm import Session
from .database import Base, engine, get_db
from .models import CollegeRecord, PaymentOrder, CounsellingLead
from .rank_scale import get_rank_scale
from .college_websites import get_college_links
from .security import (
    ALLOWED_ORIGINS,
    ALLOWED_ORIGIN_REGEX,
    IS_PRODUCTION,
    SecurityMiddleware,
    admin_guard,
    get_client_ip,
    issue_admin_token,
    issue_entitlement_token,
    mask_utr,
    sanitize_email,
    sanitize_text,
    verify_admin_secret,
    verify_admin_token,
    verify_entitlement_token,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CAP Compass API",
    version="2.6.0",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

GPAY_NUMBER = "9920627188"

PLAN_CATALOG = {
    "pro": {
        "id": "pro",
        "name": "CAP Pro Pass",
        "amount_inr": 199,
        "badge": "Most Popular",
        "validity": "Full 2026 CAP Season (Rounds 1–3 + Spot)",
    },
    "vip": {
        "id": "vip",
        "name": "Counselling VIP + 1-on-1 Review",
        "amount_inr": 499,
        "badge": "Personal Mentor",
        "validity": "Full Season + 1-on-1 Option Form Audit via WhatsApp/Call",
    },
}

app.add_middleware(SecurityMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Admin-Pin",
        "X-Entitlement-Token",
    ],
)


@app.exception_handler(Exception)
async def _safe_unhandled_exception_handler(request: Request, exc: Exception):
    # Never expose internal stack traces, SQL queries, or server file paths to callers
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later."},
    )

COLLEGE_CODE_ALIASES = {
    "16006": "6006",
    "14005": "4005",
}


def _norm_college_code(code: str) -> str:
    c = str(code or "").strip()
    return COLLEGE_CODE_ALIASES.get(c, c)


# Pydantic Schemas
class PredictionRequest(BaseModel):
    percentile: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    rank: Optional[float] = Field(default=None, ge=1.0, le=500000.0)
    category: str = Field(min_length=1, max_length=24)
    branch: Optional[str] = Field(default=None, max_length=120)
    branches: Optional[List[str]] = Field(default=None, max_length=50)
    city: Optional[str] = Field(default=None, max_length=80)
    cities: Optional[List[str]] = Field(default=None, max_length=50)
    round_number: Optional[int] = Field(default=None, ge=1, le=4)
    exact_only: Optional[bool] = False


class ComparisonRequest(BaseModel):
    college_codes: List[str] = Field(min_length=1, max_length=10)
    category: str = Field(min_length=1, max_length=24)
    round_number: Optional[int] = Field(default=3, ge=1, le=4)
    year: Optional[int] = Field(default=2025, ge=2020, le=2030)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "CAP Compass API"}


@app.get("/api/filters")
def get_filters(db: Session = Depends(get_db)):
    cities = [
        r[0]
        for r in db.query(CollegeRecord.city)
        .distinct()
        .filter(CollegeRecord.city != "Unknown", CollegeRecord.city.isnot(None))
        .all()
    ]
    branches = [
        r[0]
        for r in db.query(CollegeRecord.branch_name)
        .distinct()
        .filter(CollegeRecord.branch_name.isnot(None))
        .all()
    ]
    categories = [
        r[0]
        for r in db.query(CollegeRecord.category)
        .distinct()
        .filter(CollegeRecord.category.isnot(None))
        .all()
    ]

    return {
        "cities": sorted(cities),
        "branches": sorted(branches),
        "categories": sorted(categories),
    }


@app.get("/api/colleges")
def search_colleges(
    search: Optional[str] = None,
    city: Optional[str] = None,
    branch: Optional[str] = None,
    sort_by: Optional[str] = "name",
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    limit = max(1, min(200, int(limit or 50)))
    offset = max(0, min(5000, int(offset or 0)))

    query = db.query(
        CollegeRecord.college_code,
        CollegeRecord.college_name,
        CollegeRecord.city,
    ).distinct()

    if search:
        s = (sanitize_text(search, max_len=100) or "").strip()
        if s:
            norm_s = COLLEGE_CODE_ALIASES.get(s, s)
            query = query.filter(
                or_(
                    CollegeRecord.college_name.ilike(f"%{s}%"),
                    CollegeRecord.college_code.ilike(f"%{s}%"),
                    CollegeRecord.college_code == norm_s,
                    CollegeRecord.city.ilike(f"%{s}%"),
                )
            )
    if city:
        query = query.filter(CollegeRecord.city == city)
    if branch:
        query = query.filter(CollegeRecord.branch_name == branch)

    total = query.count()

    if sort_by == "name_desc":
        query = query.order_by(desc(CollegeRecord.college_name))
    elif sort_by == "code":
        query = query.order_by(asc(CollegeRecord.college_code))
    elif sort_by == "city":
        query = query.order_by(asc(CollegeRecord.city), asc(CollegeRecord.college_name))
    else:
        query = query.order_by(asc(CollegeRecord.college_name))

    colleges = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "results": [
            {
                "college_code": c[0],
                "college_name": c[1],
                "city": c[2],
                **get_college_links(c[0]),
            }
            for c in colleges
        ],
    }


@app.get("/api/colleges/{college_code}")
def get_college_details(college_code: str, db: Session = Depends(get_db)):
    norm_code = _norm_college_code(college_code)
    college = (
        db.query(CollegeRecord)
        .filter(CollegeRecord.college_code == norm_code)
        .first()
    )
    if not college:
        raise HTTPException(status_code=404, detail="College not found")

    scale = get_rank_scale(db)
    minority_colleges, open_colleges = _get_college_sets(db)

    records = (
        db.query(CollegeRecord)
        .filter(CollegeRecord.college_code == norm_code)
        .order_by(
            desc(CollegeRecord.year),
            asc(CollegeRecord.round_number),
            desc(CollegeRecord.percentile),
        )
        .all()
    )

    # Prefer primary Stage I / MH rows when available for a (branch, category, year, round)
    has_stage1 = {
        (r.branch_name, r.category, r.year, r.round_number)
        for r in records
        if r.stage in ("I", "MH")
    }
    clean_records = []
    for r in records:
        key = (r.branch_name, r.category, r.year, r.round_number)
        if key in has_stage1 and r.stage not in ("I", "MH"):
            continue
        rnk = r.merit_rank
        if r.percentile is not None and (rnk is None or not scale.is_consistent(r.year, r.percentile, rnk)):
            rnk = scale.pct_to_rank(r.year, r.percentile)
        clean_records.append(
            {
                "id": r.id,
                "college_code": r.college_code,
                "college_name": r.college_name,
                "city": r.city,
                "choice_code": r.choice_code,
                "branch_name": r.branch_name,
                "quota_level": r.quota_level,
                "stage": r.stage,
                "category": r.category,
                "merit_rank": rnk,
                "percentile": r.percentile,
                "year": r.year,
                "round_number": r.round_number,
            }
        )

    branches = sorted({r["branch_name"] for r in clean_records if r["branch_name"]})
    categories = sorted({r["category"] for r in clean_records if r["category"]})

    return {
        "college_code": college.college_code,
        "college_name": college.college_name,
        "city": college.city,
        **get_college_links(college.college_code),
        "is_autonomous": norm_code in open_colleges,
        "is_minority": norm_code in minority_colleges,
        "branches": branches,
        "categories": categories,
        "recent_cutoffs": clean_records[:2500],
    }


WOMENS_ONLY_COLLEGES = {"3035", "4304", "6276", "6285", "6938"}

_CAT_RE = re.compile(
    r"^(PWDR|DEFR|PWD|DEF|G|L)(OPEN|OBC|SEBC|SC|ST|VJ|NT1|NT2|NT3)[SHO]?$"
)

# Inverse power-law parameters: open_gap = inv_a * (basis_gap ** inv_b), open_rnk = basis_rnk * inv_rmult
_BASIS_TO_OPEN_POWER = {
    "TFWS": (1.19, 1.02, 1.20),
    "EWS": (0.66, 0.96, 0.78),
    "DEFOPEN": (0.43, 1.03, 0.55),
}

# Forward power-law parameters: target_gap = fwd_a * (open_gap ** fwd_b), target_rnk = open_rnk * fwd_rmult
_OPEN_TO_TARGET_POWER = {
    "OPEN": (1.00, 1.00, 1.00),
    "OBC": (1.33, 0.97, 1.16),
    "SEBC": (1.62, 0.94, 1.26),
    "EWS": (1.85, 0.94, 1.45),
    "NT2": (1.84, 0.88, 1.32),
    "NT3": (1.88, 0.90, 1.38),
    "NT1": (2.43, 0.82, 1.55),
    "VJ": (3.32, 0.77, 1.95),
    "SC": (4.05, 0.70, 2.10),
    "ST": (16.25, 0.46, 5.50),
    "TFWS": (0.84, 0.98, 0.83),
}

_COLLEGE_SETS_CACHE: dict[str, set[str]] = {}


def _get_college_sets(db: Session) -> tuple[set[str], set[str]]:
    if "minority" not in _COLLEGE_SETS_CACHE or not _COLLEGE_SETS_CACHE["minority"]:
        mi_rows = (
            db.query(CollegeRecord.college_code)
            .filter(CollegeRecord.category == "MI")
            .distinct()
            .all()
        )
        open_rows = (
            db.query(CollegeRecord.college_code)
            .filter(CollegeRecord.category.in_(["GOPENS", "LOPENS"]))
            .distinct()
            .all()
        )
        _COLLEGE_SETS_CACHE["minority"] = {r[0] for r in mi_rows if r[0]}
        _COLLEGE_SETS_CACHE["open"] = {r[0] for r in open_rows if r[0]}
    return _COLLEGE_SETS_CACHE["minority"], _COLLEGE_SETS_CACHE["open"]


def _family(base: str) -> List[str]:
    """All seat-type variants (State / Home / Other university) of a base category."""
    return [f"{base}S", f"{base}H", f"{base}O"]


def build_category_chain(category: str, include_open_fallback: bool = False) -> List[List[str]]:
    """
    Ordered list of category groups to look up for a student.

    Respects Maharashtra CAP reservation rules:
      - MI (Minority Quota) only matches MI seats.
      - TFWS only matches TFWS seats.
      - General (G...) categories do NOT fall back to Ladies (L...) categories.
      - Ladies (L...) categories check L{caste} then G{caste} (co-ed General seats of same caste).
      - Non-autonomous colleges (which lack Home/Other University rows in State-Level CSVs)
        fall back to calibrated State-Level proxies (TFWS, EWS, DEFOPENS).
    """
    cat = (category or "GOPENS").upper().strip()
    if cat == "MI":
        return [["MI"]] if not include_open_fallback else [["MI"], _family("GOPEN"), ["TFWS"]]
    if cat == "TFWS":
        return [["TFWS"]] if not include_open_fallback else [["TFWS"], _family("GOPEN")]
    if cat == "EWS":
        chain_ews = [["EWS"]]
        if include_open_fallback:
            chain_ews.append(_family("GOPEN"))
        chain_ews.extend([["TFWS"], _family("DEFOPEN")])
        return chain_ews
    if cat == "ORPHAN":
        return [["ORPHAN"]] if not include_open_fallback else [["ORPHAN"], _family("GOPEN"), ["TFWS"]]

    chain: List[List[str]] = []

    def add(group: List[str]):
        group = [g for g in group if not any(g in existing for existing in chain)]
        if group:
            chain.append(group)

    m = _CAT_RE.match(cat)
    if m:
        prefix, caste = m.groups()
        add(_family(f"{prefix}{caste}"))
        if prefix == "L":
            add(_family(f"G{caste}"))
            if caste == "OPEN" or include_open_fallback:
                add(_family("LOPEN"))
                add(_family("GOPEN"))
        elif prefix in ("DEF", "DEFR"):
            if caste != "OPEN":
                add(_family(f"DEF{caste}"))
                add(_family("DEFOPEN"))
                add(_family(f"G{caste}"))
            else:
                add(_family("GOPEN"))
        elif prefix in ("PWD", "PWDR"):
            if caste != "OPEN":
                add(_family(f"PWD{caste}"))
                add(_family("PWDOPEN"))
                add(_family(f"G{caste}"))
            else:
                add(_family("GOPEN"))
        else:
            if include_open_fallback and caste != "OPEN":
                add(_family("GOPEN"))

        add(["TFWS"])
        add(["EWS"])
        add(_family("DEFOPEN"))
    else:
        add([cat])
        add(_family("GOPEN"))
        add(["TFWS"])
        add(["EWS"])

    return chain


def _calibrate_cutoff_for_category(
    requested_cat: str,
    basis_cat: str,
    raw_percentile: Optional[float],
    raw_rank: Optional[float],
    record_year: Optional[int],
    is_minority_college: bool = False,
) -> tuple[Optional[float], Optional[float]]:
    """
    Calibrate historical cutoff when falling back across categories or older merit pools
    using empirical power-law percentile-gap scaling: (100 - cat) = a * (100 - open)^b.
    """
    # NOTE: only the percentile output is used by the endpoints. Rank cutoffs are
    # derived from the calibrated percentile through the data-driven RankScale,
    # which is far more accurate than multiplying ranks by fixed factors.
    pct = raw_percentile
    rnk = raw_rank

    req = (requested_cat or "GOPENS").upper().strip()
    bas = (basis_cat or "GOPENS").upper().strip()
    if req == bas:
        return pct, rnk

    m_req = _CAT_RE.match(req)
    m_bas = _CAT_RE.match(bas)
    req_prefix = m_req.group(1) if m_req else ""
    req_caste = m_req.group(2) if m_req else req
    bas_prefix = m_bas.group(1) if m_bas else ""
    bas_caste = m_bas.group(2) if m_bas else bas

    # Same caste (e.g. LOBCS -> GOBCS or GOBCS -> GOBCH): no caste gap shift needed
    if m_req and m_bas and req_caste == bas_caste and req_prefix in ("G", "L") and bas_prefix in ("G", "L"):
        return pct, rnk

    # If the basis seat is already an Open seat (GOPENS/LOPENS on an autonomous/minority college),
    # the college does not have a separate reserved cutoff for the requested category, so the
    # candidate must compete at the actual Open cutoff without a synthetic discount.
    if bas_caste == "OPEN" and bas_prefix in ("G", "L"):
        return pct, rnk

    # Step 1: Convert non-autonomous State-level proxy (TFWS, EWS, DEFOPEN) to Open-equivalent gap
    open_gap = (100.0 - pct) if pct is not None else None
    open_rnk = rnk

    bas_key = f"{bas_prefix}{bas_caste}" if m_bas else bas
    if bas_key.startswith("DEFR"):
        bas_key = "DEF" + bas_caste
    if bas_key in _BASIS_TO_OPEN_POWER:
        inv_a, inv_b, inv_rmult = _BASIS_TO_OPEN_POWER[bas_key]
        if open_gap is not None:
            open_gap = inv_a * (max(0.02, open_gap) ** inv_b)
        if open_rnk is not None:
            open_rnk = open_rnk * inv_rmult

    if is_minority_college:
        cal_pct = round(min(99.99, max(1.0, 100.0 - open_gap)), 4) if open_gap is not None else None
        cal_rnk = round(max(1.0, open_rnk), 1) if open_rnk is not None else None
        return cal_pct, cal_rnk

    # Step 2: Convert Open-equivalent gap to requested category on non-minority non-autonomous college
    target_key = req_caste if m_req else req
    fwd_a, fwd_b, fwd_rmult = _OPEN_TO_TARGET_POWER.get(target_key, (1.0, 1.0, 1.0))

    target_gap = open_gap
    target_rnk = open_rnk
    if target_gap is not None:
        target_gap = fwd_a * (max(0.02, target_gap) ** fwd_b)
    if target_rnk is not None:
        target_rnk = target_rnk * fwd_rmult

    if req_prefix.startswith("PWD"):
        if target_gap is not None and open_gap is not None:
            target_gap = max(target_gap, 14.0 * (max(0.02, open_gap) ** 0.52))
        if target_rnk is not None:
            target_rnk *= 2.5
    elif req_prefix.startswith("DEF"):
        if target_gap is not None and open_gap is not None:
            target_gap = max(target_gap, 2.6 * (max(0.02, open_gap) ** 0.87))
        if target_rnk is not None:
            target_rnk *= 1.45

    cal_pct = round(min(99.99, max(1.0, 100.0 - target_gap)), 4) if target_gap is not None else None
    cal_rnk = round(max(1.0, target_rnk), 1) if target_rnk is not None else None
    return cal_pct, cal_rnk


def _classify(student_rank: float, cutoff_rank: float, margin_pct: float = 0.0):
    """
    Band a course using both the student-to-cutoff rank ratio and percentile margin.
    """
    ratio = student_rank / max(1.0, cutoff_rank)
    if ratio <= 0.85 or margin_pct >= 1.5:
        chance = "High"
    elif ratio <= 1.0 or margin_pct >= 0.0:
        chance = "Good"
    elif ratio <= 1.15 or margin_pct >= -1.5:
        chance = "Borderline"
    elif ratio <= 1.30 or margin_pct >= -3.0:
        chance = "Low"
    else:
        chance = "Reach"

    if ratio <= 1.0 or margin_pct >= 0.0:
        band = "Historically Within Range"
    elif ratio <= 1.25 or margin_pct >= -3.0:
        band = "Moderate"
    elif ratio <= 1.60 or margin_pct >= -8.0:
        band = "Ambitious"
    else:
        band = None
    return ratio, band, chance


def _cutoff_ranks(scale, year, eff_pct, raw_pct, raw_rank, is_est):
    """(rank in the record's own year, rank on the latest-year merit list)."""
    trustworthy_raw = (
        not is_est
        and raw_rank is not None
        and scale.is_consistent(year, raw_pct, raw_rank)
    )
    rank_in_year = raw_rank if trustworthy_raw else scale.pct_to_rank(year, eff_pct)
    if trustworthy_raw and year == scale.latest_year:
        rank_latest = raw_rank
    else:
        rank_latest = scale.pct_to_rank(scale.latest_year, eff_pct)
    return rank_in_year, rank_latest


@app.get("/api/convert")
def convert_score(
    percentile: Optional[float] = None,
    rank: Optional[float] = None,
    db: Session = Depends(get_db),
):
    """Estimate State Merit Rank from percentile (or vice versa) for each CAP year."""
    if percentile is None and rank is None:
        raise HTTPException(status_code=400, detail="Provide percentile or rank")
    scale = get_rank_scale(db)
    per_year = []
    by_year = {}
    for y in scale.years:
        if percentile is not None:
            r_est = scale.pct_to_rank(y, percentile)
            per_year.append({"year": y, "percentile": percentile, "rank": r_est})
            by_year[str(y)] = r_est
        else:
            p_est = scale.rank_to_pct(y, rank)
            per_year.append({"year": y, "percentile": p_est, "rank": rank})
            by_year[str(y)] = p_est
    latest = per_year[-1] if per_year else None
    return {
        "input_type": "percentile" if percentile is not None else "rank",
        "latest_year": scale.latest_year,
        "latest": latest,
        "estimated_rank": latest["rank"] if latest else None,
        "estimated_percentile": latest["percentile"] if latest else None,
        "by_year": by_year,
        "per_year": per_year,
    }


def _build_prediction_pool(req: "PredictionRequest", db: Session, scale):
    """
    Score-independent part of prediction: query, dedupe and category-calibrate every
    candidate course once. Reused by /api/predict and the What-If simulator.
    """
    latest_year = scale.latest_year
    req_cat = (req.category or "GOPENS").upper().strip()
    chain = build_category_chain(req_cat, include_open_fallback=False)
    priority = {cat: i for i, group in enumerate(chain) for cat in group}
    requested_family = set(chain[0]) if chain else set()

    m_req = _CAT_RE.match(req_cat)
    req_prefix = m_req.group(1) if m_req else ""

    minority_colleges, open_colleges = _get_college_sets(db)

    query = db.query(
        CollegeRecord.choice_code,
        CollegeRecord.college_code,
        CollegeRecord.college_name,
        CollegeRecord.city,
        CollegeRecord.branch_name,
        CollegeRecord.category,
        CollegeRecord.stage,
        CollegeRecord.percentile,
        CollegeRecord.merit_rank,
        CollegeRecord.year,
        CollegeRecord.round_number,
    ).filter(
        CollegeRecord.category.in_(list(priority.keys())),
        CollegeRecord.percentile.isnot(None),
    )

    target_branches = [b.strip() for b in (req.branches or []) if b and b.strip()]
    if req.branch and req.branch.strip() and req.branch.strip() not in target_branches:
        target_branches.append(req.branch.strip())

    target_cities = [c.strip() for c in (req.cities or []) if c and c.strip()]
    if req.city and req.city.strip() and req.city.strip() not in target_cities:
        target_cities.append(req.city.strip())

    if target_branches:
        query = query.filter(CollegeRecord.branch_name.in_(target_branches))
    if target_cities:
        query = query.filter(CollegeRecord.city.in_(target_cities))
    if req.round_number in (1, 2, 3):
        query = query.filter(CollegeRecord.round_number == req.round_number)

    # Exclude women-only colleges when searching General (G...) categories
    if req_prefix == "G":
        query = query.filter(~CollegeRecord.college_code.in_(list(WOMENS_ONLY_COLLEGES)))

    # Minority colleges only offer MI, GOPENS, LOPENS, TFWS — no caste, EWS, PWD, DEF or ORPHAN quotas
    if req_cat not in ("GOPENS", "GOPENH", "GOPENO", "LOPENS", "LOPENH", "LOPENO", "MI", "TFWS") and minority_colleges:
        query = query.filter(~CollegeRecord.college_code.in_(list(minority_colleges)))

    proxy_cats = ("TFWS", "EWS", "DEFOPENS", "DEFOPENH", "DEFOPENO")
    best = {}
    # closing percentile per (course, category, year), preferring Stage I / MH rows
    yearly = {}
    for r in query.all():
        if r.college_code in open_colleges and r.category in proxy_cats and req_cat not in proxy_cats:
            continue
        key = r.choice_code or f"{r.college_code}|{r.branch_name}"
        st_prio = 0 if r.stage in ("I", "MH") else 1

        ykey = (key, r.category, r.year)
        cur = yearly.get(ykey)
        if cur is None or (st_prio, r.percentile) < cur:
            yearly[ykey] = (st_prio, r.percentile)

        rank_key = (priority[r.category], -r.year, st_prio, r.percentile)
        if key not in best or rank_key < best[key][0]:
            best[key] = (rank_key, r)

    years_available = sorted({y for (_, _, y) in yearly})

    pool = []
    for _, r in best.values():
        is_est = r.category not in requested_family
        if req.exact_only and is_est:
            continue
        is_min = r.college_code in minority_colleges

        def calibrated(pct, r=r, is_est=is_est, is_min=is_min):
            if not is_est:
                return pct
            cal, _ = _calibrate_cutoff_for_category(
                req_cat, r.category, pct, None, r.year, is_minority_college=is_min
            )
            return cal if cal is not None else pct

        eff_pct = calibrated(r.percentile)
        rank_in_year, rank_latest = _cutoff_ranks(
            scale, r.year, eff_pct, r.percentile, r.merit_rank, is_est
        )

        key = r.choice_code or f"{r.college_code}|{r.branch_name}"
        history = []
        for y in years_available:
            hv = yearly.get((key, r.category, y))
            if hv is None:
                continue
            h_pct = calibrated(hv[1])
            history.append(
                {
                    "year": y,
                    "percentile": round(h_pct, 4),
                    "rank": scale.pct_to_rank(y, h_pct),
                    "rank_latest_scale": scale.pct_to_rank(latest_year, h_pct),
                }
            )
        trend = "stable"
        if len(history) >= 2:
            delta = history[-1]["percentile"] - history[0]["percentile"]
            if delta > 0.5:
                trend = "rising"
            elif delta < -0.5:
                trend = "falling"

        pool.append(
            {
                "r": r,
                "key": key,
                "is_est": is_est,
                "eff_pct_raw": eff_pct,
                "eff_pct": round(eff_pct, 4),
                "rank_in_year": rank_in_year,
                "rank_latest": rank_latest,
                "history": history,
                "trend": trend,
            }
        )
    return req_cat, chain, pool


def _score_prediction_pool(pool, student_pct: float, student_rank: float):
    """Score-dependent part: margins, rank ratio, band and chance for each candidate."""
    scored = []
    for p in pool:
        margin_pct = round(student_pct - p["eff_pct_raw"], 4)
        margin_rank = round(p["rank_latest"] - student_rank)
        ratio, band, chance = _classify(student_rank, p["rank_latest"], margin_pct)
        scored.append(
            {
                **p,
                "ratio": ratio,
                "band": band,
                "chance": chance,
                "margin_pct": margin_pct,
                "margin_rank": margin_rank,
            }
        )
    return scored


@app.post("/api/predict")
def predict_colleges(req: PredictionRequest, db: Session = Depends(get_db)):
    if req.percentile is None and req.rank is None:
        raise HTTPException(
            status_code=400, detail="Must provide either percentile or rank"
        )
    if req.percentile is not None and not (0 < req.percentile <= 100):
        raise HTTPException(status_code=400, detail="Percentile must be between 0 and 100")
    if req.rank is not None and req.rank < 1:
        raise HTTPException(status_code=400, detail="Rank must be at least 1")

    scale = get_rank_scale(db)
    latest_year = scale.latest_year
    use_percentile = req.percentile is not None
    student_pct = req.percentile if use_percentile else scale.rank_to_pct(latest_year, req.rank)
    student_rank = req.rank if not use_percentile else scale.pct_to_rank(latest_year, req.percentile)

    req_cat, chain, pool = _build_prediction_pool(req, db, scale)
    candidates = _score_prediction_pool(pool, student_pct, student_rank)

    def to_dict(c, band_override=None):
        r = c["r"]
        return {
            "choice_code": r.choice_code,
            "college_code": r.college_code,
            "college_name": r.college_name,
            "city": r.city,
            "branch": r.branch_name,
            **get_college_links(r.college_code),
            # cutoff expressed for the requested category
            "historical_percentile": c["eff_pct"],
            "historical_rank": c["rank_latest"],
            "cutoff_rank_in_year": c["rank_in_year"],
            "rank_scale_year": latest_year,
            "raw_percentile": r.percentile,
            "raw_rank": r.merit_rank,
            "student_percentile": student_pct,
            "student_rank": student_rank,
            "input_type": "percentile" if use_percentile else "rank",
            "margin": c["margin_pct"] if use_percentile else c["margin_rank"],
            "margin_percentile": c["margin_pct"],
            "margin_rank": c["margin_rank"],
            "rank_ratio": round(c["ratio"], 3),
            "chance_level": c["chance"],
            "prediction_category": band_override or c["band"],
            "basis_category": r.category,
            "is_estimate": c["is_est"],
            "year": r.year,
            "round": r.round_number,
            "stage": r.stage,
            "history": c["history"],
            "trend": c["trend"],
        }

    results = [to_dict(c) for c in candidates if c["band"]]
    fallback_used = False
    if not results and candidates:
        fallback_used = True
        nearest = sorted(candidates, key=lambda c: c["ratio"])[:25]
        results = [to_dict(c, "Ambitious") for c in nearest]

    results.sort(key=lambda x: x["historical_rank"] or float("inf"))

    return {
        "count": len(results),
        "fallback_used": fallback_used,
        "categories_considered": [c for group in chain for c in group],
        "student": {
            "percentile": student_pct,
            "rank": student_rank,
            "student_percentile": student_pct,
            "student_rank": student_rank,
            "input_type": "percentile" if use_percentile else "rank",
            "rank_scale_year": latest_year,
            "category": req_cat,
        },
        "predictions": results,
    }


class WhatIfRequest(BaseModel):
    percentile: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    rank: Optional[float] = Field(default=None, ge=1.0, le=500000.0)
    category: str = Field(min_length=1, max_length=24)
    branches: Optional[List[str]] = Field(default=None, max_length=50)
    cities: Optional[List[str]] = Field(default=None, max_length=50)
    round_number: Optional[int] = Field(default=None, ge=1, le=4)
    deltas: Optional[List[float]] = Field(default=None, max_length=9)


@app.post("/api/what-if")
def what_if_simulator(req: WhatIfRequest, db: Session = Depends(get_db)):
    """Score Impact Simulator: how many courses become (un)reachable as the score shifts."""
    if req.percentile is None and req.rank is None:
        raise HTTPException(status_code=400, detail="Must provide either percentile or rank")

    scale = get_rank_scale(db)
    latest_year = scale.latest_year
    base_pct = (
        float(req.percentile)
        if req.percentile is not None
        else float(scale.rank_to_pct(latest_year, req.rank))
    )
    if not (0 < base_pct <= 100):
        raise HTTPException(status_code=400, detail="Percentile must be between 0 and 100")

    deltas = req.deltas or [-2.0, -1.0, -0.5, 0.0, 0.5, 1.0, 2.0]
    deltas = sorted({round(max(-10.0, min(10.0, float(d))), 2) for d in deltas} | {0.0})

    # Build + calibrate the candidate pool ONCE, then re-score it at every simulated score
    req_cat, _, pool = _build_prediction_pool(
        PredictionRequest(
            percentile=base_pct,
            category=req.category,
            branches=req.branches,
            cities=req.cities,
            round_number=req.round_number,
        ),
        db,
        scale,
    )

    def slim(c):
        r = c["r"]
        return {
            "college_code": r.college_code,
            "college_name": r.college_name,
            "city": r.city,
            "branch": r.branch_name,
            "choice_code": r.choice_code,
            **get_college_links(r.college_code),
            "historical_percentile": c["eff_pct"],
            "historical_rank": c["rank_latest"],
            "is_estimate": c["is_est"],
        }

    runs = {}
    for d in deltas:
        pct = round(min(100.0, max(0.01, base_pct + d)), 4)
        rank = scale.pct_to_rank(latest_year, pct)
        scored = _score_prediction_pool(pool, pct, rank)
        within = {c["key"]: c for c in scored if c["band"] == "Historically Within Range"}
        moderate = sum(1 for c in scored if c["band"] == "Moderate")
        ambitious = sum(1 for c in scored if c["band"] == "Ambitious")
        runs[d] = (pct, rank, within, moderate, ambitious)

    base_within = runs[0.0][2]
    points = []
    for d in deltas:
        pct, rank, within, moderate, ambitious = runs[d]
        if d > 0:
            changed = [within[k] for k in within.keys() - base_within.keys()]
        elif d < 0:
            changed = [base_within[k] for k in base_within.keys() - within.keys()]
        else:
            changed = []
        changed.sort(key=lambda c: c["rank_latest"] or float("inf"))
        points.append(
            {
                "delta": d,
                "percentile": pct,
                "rank": rank,
                "within_range": len(within),
                "moderate": moderate,
                "ambitious": ambitious,
                "changed_count": len(changed),
                "changed": [slim(c) for c in changed[:12]],
            }
        )

    return {
        "category": req_cat,
        "base_percentile": round(base_pct, 4),
        "base_rank": runs[0.0][1],
        "rank_scale_year": latest_year,
        "total_courses": len(pool),
        "points": points,
    }


@app.post("/api/compare")
def compare_colleges(req: ComparisonRequest, db: Session = Depends(get_db)):
    if len(req.college_codes) > 4:
        raise HTTPException(
            status_code=400, detail="Can compare at most 4 colleges"
        )
    if not req.college_codes:
        return {"comparison": []}

    scale = get_rank_scale(db)
    norm_codes = [_norm_college_code(c) for c in req.college_codes]
    target_year = req.year or 2025
    target_round = req.round_number or 3
    req_cat = (req.category or "GOPENS").upper().strip()

    chain = build_category_chain(req_cat, include_open_fallback=True)
    priority = {cat: i for i, group in enumerate(chain) for cat in group}
    requested_family = set(chain[0]) if chain else set()
    minority_colleges, open_colleges = _get_college_sets(db)

    all_rows = (
        db.query(CollegeRecord)
        .filter(
            CollegeRecord.college_code.in_(norm_codes),
            CollegeRecord.category.in_(list(priority.keys())),
            CollegeRecord.percentile.isnot(None),
        )
        .all()
    )

    proxy_cats = ("TFWS", "EWS", "DEFOPENS", "DEFOPENH", "DEFOPENO")
    best_per_course = {}
    for r in all_rows:
        if r.college_code in open_colleges and r.category in proxy_cats and req_cat not in proxy_cats:
            continue
        key = (r.college_code, r.branch_name)
        cat_prio = priority.get(r.category, 999)
        yr_dist = abs((r.year or 2025) - target_year)
        st_prio = 0 if r.stage in ("I", "MH") else 1
        rn_dist = (
            0
            if r.round_number == target_round
            else (
                target_round - r.round_number
                if r.round_number < target_round
                else 10 + (r.round_number - target_round)
            )
        )
        score = (cat_prio, yr_dist, st_prio, rn_dist, r.percentile)
        if key not in best_per_course or score < best_per_course[key][0]:
            best_per_course[key] = (score, r)

    comparison_out = []
    for (_, _), (_, r) in sorted(
        best_per_course.items(), key=lambda item: (item[0][0], item[0][1])
    ):
        is_est = r.category not in requested_family
        is_min = r.college_code in minority_colleges
        eff_pct = r.percentile
        if is_est:
            cal, _ = _calibrate_cutoff_for_category(
                req_cat, r.category, r.percentile, None, r.year, is_minority_college=is_min
            )
            eff_pct = cal if cal is not None else r.percentile
        rank_in_year, rank_latest = _cutoff_ranks(
            scale, r.year, eff_pct, r.percentile, r.merit_rank, is_est
        )
        comparison_out.append(
            {
                "id": r.id,
                "college_code": r.college_code,
                "college_name": r.college_name,
                "city": r.city,
                "choice_code": r.choice_code,
                "branch_name": r.branch_name,
                "category": req_cat,
                "basis_category": r.category,
                "is_estimate": is_est,
                "percentile": round(eff_pct, 4),
                "raw_percentile": r.percentile,
                "merit_rank": rank_in_year,
                "merit_rank_latest_scale": rank_latest,
                "raw_merit_rank": r.merit_rank,
                "year": r.year,
                "round_number": r.round_number,
                "stage": r.stage,
                "quota_level": r.quota_level,
            }
        )

    return {"comparison": comparison_out}


@app.get("/api/analytics/options")
def get_analytics_options(college_code: str, db: Session = Depends(get_db)):
    """Branches recorded for a college with the categories available for each."""
    norm_code = _norm_college_code(college_code)
    college = (
        db.query(CollegeRecord)
        .filter(CollegeRecord.college_code == norm_code)
        .first()
    )
    if not college:
        raise HTTPException(status_code=404, detail="College not found")

    rows = (
        db.query(
            CollegeRecord.branch_name,
            CollegeRecord.category,
            func.count(CollegeRecord.id),
        )
        .filter(CollegeRecord.college_code == norm_code)
        .group_by(CollegeRecord.branch_name, CollegeRecord.category)
        .all()
    )

    branches = {}
    for branch_name, cat, n in rows:
        b = branches.setdefault(
            branch_name, {"name": branch_name, "records": 0, "categories": []}
        )
        b["records"] += n
        b["categories"].append(cat)
    for b in branches.values():
        b["categories"].sort()

    return {
        "college_code": college.college_code,
        "college_name": college.college_name,
        "city": college.city,
        "branches": sorted(branches.values(), key=lambda b: (-b["records"], b["name"])),
    }


def _closing_cells(rows, scale=None):
    """
    Closing cutoff per (category, year, round), preferring primary Stage I/MH rows.
    The closing rank is taken from the same row as the closing (lowest) percentile;
    if that row's rank disagrees with its percentile, the rank is re-derived from
    the year's percentile->rank scale.
    """
    has_stage1 = {
        (r.category, r.year, r.round_number)
        for r in rows
        if r.stage in ("I", "MH")
    }
    picked = {}
    for r in rows:
        key = (r.category, r.year, r.round_number)
        if key in has_stage1 and r.stage not in ("I", "MH"):
            continue
        if r.percentile is None:
            continue
        if key not in picked or r.percentile < picked[key].percentile:
            picked[key] = r

    cells = {}
    for key, r in picked.items():
        rank = r.merit_rank
        if scale is not None and (rank is None or not scale.is_consistent(r.year, r.percentile, rank)):
            rank = scale.pct_to_rank(r.year, r.percentile)
        cells[key] = {"percentile": r.percentile, "merit_rank": rank}
    return cells


def _final_round(cells, category, year):
    """Cell of the last available round for a category in a year."""
    rounds = sorted(rn for (cat, y, rn) in cells if cat == category and y == year)
    return (
        (rounds[-1], cells[(category, year, rounds[-1])])
        if rounds
        else (None, None)
    )


@app.get("/api/analytics/cutoffs")
def get_cutoff_analytics(
    college_code: str,
    branch: str,
    category: str = "GOPENS",
    db: Session = Depends(get_db),
):
    norm_code = _norm_college_code(college_code)
    requested = (category or "GOPENS").upper().strip()
    chain = build_category_chain(requested, include_open_fallback=True)
    requested_family = set(chain[0]) if chain else set()
    scale = get_rank_scale(db)
    minority_colleges, _ = _get_college_sets(db)
    is_min = norm_code in minority_colleges

    rows = (
        db.query(CollegeRecord)
        .filter(
            CollegeRecord.college_code == norm_code,
            CollegeRecord.branch_name == branch,
        )
        .all()
    )
    cells = _closing_cells(rows, scale)
    available = {}
    for cat, _, _ in cells:
        available[cat] = available.get(cat, 0) + 1

    yr_cells = {}
    for (cat, y, rn), vals in cells.items():
        yr_cells.setdefault((y, rn), {})[cat] = vals

    trends = []
    for y, rn in sorted(yr_cells.keys()):
        cats_in_yr = yr_cells[(y, rn)]
        best_cat = None
        best_score = (999, 999)

        for c in cats_in_yr:
            score = (999, 0)
            for i, group in enumerate(chain):
                if c in group:
                    score = (i, 0 if c == requested else 1)
                    break

            if score < best_score:
                best_score = score
                best_cat = c
            elif score == best_score:
                if c == requested:
                    best_cat = c
                elif best_cat is None or available.get(c, 0) > available.get(
                    best_cat, 0
                ):
                    best_cat = c

        if best_cat is None:
            best_cat = max(cats_in_yr.keys(), key=lambda c: available.get(c, 0))

        raw_cell = cats_in_yr[best_cat]
        is_est_cell = best_cat not in requested_family
        eff_pct = raw_cell["percentile"]
        if is_est_cell and eff_pct is not None:
            cal_p, _ = _calibrate_cutoff_for_category(
                requested, best_cat, eff_pct, None, y, is_minority_college=is_min
            )
            if cal_p is not None:
                eff_pct = cal_p
        eff_rnk = (
            scale.pct_to_rank(y, eff_pct)
            if is_est_cell and eff_pct is not None
            else raw_cell["merit_rank"]
        )

        trends.append(
            {
                "category": best_cat,
                "year": y,
                "round_number": rn,
                "percentile": eff_pct,
                "merit_rank": eff_rnk,
                "raw_percentile": raw_cell["percentile"],
                "raw_merit_rank": raw_cell["merit_rank"],
                "is_estimate": is_est_cell,
            }
        )

    if trends:
        freq = {}
        for t in trends:
            freq[t["category"]] = freq.get(t["category"], 0) + 1
        basis = max(freq.keys(), key=lambda c: (freq[c], c == trends[-1]["category"]))
    else:
        basis = None

    summary = None
    if trends:
        years = sorted({t["year"] for t in trends})
        finals = {}
        for y in years:
            yr_trends = [t for t in trends if t["year"] == y]
            finals[y] = yr_trends[-1] if yr_trends else None
        latest_year = years[-1]
        latest = finals[latest_year]
        prev = finals[years[-2]] if len(years) > 1 else None

        def delta(a, b, key):
            return (
                round(a[key] - b[key], 4)
                if a and b and a.get(key) is not None and b.get(key) is not None
                else None
            )

        yoy_pct = delta(latest, prev, "percentile")
        yoy_rank = delta(latest, prev, "merit_rank")
        latest_rounds = [t for t in trends if t["year"] == latest_year]
        first_round = latest_rounds[0] if latest_rounds else None
        round_drop_pct = (
            delta(first_round, latest, "percentile")
            if first_round and first_round["round_number"] != latest["round_number"]
            else None
        )

        final_pcts = [
            finals[y]["percentile"]
            for y in years
            if finals[y]["percentile"] is not None
        ]
        steps = [b - a for a, b in zip(final_pcts, final_pcts[1:])]
        avg_step = sum(steps) / len(steps) if steps else 0.0
        volatility = (sum(abs(s) for s in steps) / len(steps)) if steps else 0.5
        trend = "stable"
        if avg_step > 0.5:
            trend = "rising"
        elif avg_step < -0.5:
            trend = "falling"

        outlook = None
        if latest.get("percentile") is not None:
            centre = latest["percentile"] + avg_step
            spread = max(0.5, volatility)
            outlook = {
                "year": latest_year + 1,
                "low": round(max(0.0, centre - spread), 2),
                "high": round(min(100.0, centre + spread), 2),
            }

        pcts = [t["percentile"] for t in trends if t["percentile"] is not None]
        summary = {
            "latest": latest,
            "previous": prev,
            "yoy_percentile_change": yoy_pct,
            "yoy_rank_change": yoy_rank,
            "round_drop_percentile": round_drop_pct,
            "trend": trend,
            "peak_percentile": max(pcts) if pcts else None,
            "lowest_percentile": min(pcts) if pcts else None,
            "years": years,
            "finals": [finals[y] for y in years],
            "outlook": outlook,
        }

    category_comparison = []
    if cells:
        latest_year_all = max(y for (_, y, _) in cells)
        for cat in available:
            rn, cell = _final_round(cells, cat, latest_year_all)
            if cell and cell["percentile"] is not None:
                category_comparison.append(
                    {"category": cat, "round_number": rn, "year": latest_year_all, **cell}
                )
        category_comparison.sort(key=lambda c: -c["percentile"])

    branch_comparison = []
    priority = {cat: i for i, group in enumerate(chain) for cat in group}
    college_rows = (
        db.query(
            CollegeRecord.branch_name,
            CollegeRecord.category,
            CollegeRecord.stage,
            CollegeRecord.year,
            CollegeRecord.round_number,
            CollegeRecord.percentile,
            CollegeRecord.merit_rank,
        )
        .filter(
            CollegeRecord.college_code == norm_code,
            CollegeRecord.category.in_(list(priority.keys())),
            CollegeRecord.percentile.isnot(None),
        )
        .all()
    )
    best = {}
    for r in college_rows:
        st_prio = 0 if r.stage in ("I", "MH") else 1
        key = (priority[r.category], -r.year, st_prio, -r.round_number, r.percentile)
        if r.branch_name not in best or key < best[r.branch_name][0]:
            best[r.branch_name] = (key, r)
    for _, r in best.values():
        is_est_br = r.category not in requested_family
        eff_pct = r.percentile
        if is_est_br and eff_pct is not None:
            cal_p, _ = _calibrate_cutoff_for_category(
                requested, r.category, eff_pct, None, r.year, is_minority_college=is_min
            )
            if cal_p is not None:
                eff_pct = cal_p
        eff_rnk = (
            scale.pct_to_rank(r.year, eff_pct)
            if (is_est_br or r.merit_rank is None or not scale.is_consistent(r.year, r.percentile, r.merit_rank))
            else r.merit_rank
        )
        branch_comparison.append(
            {
                "branch": r.branch_name,
                "category": r.category,
                "year": r.year,
                "round_number": r.round_number,
                "percentile": eff_pct,
                "merit_rank": eff_rnk,
                "is_estimate": is_est_br,
            }
        )
    branch_comparison.sort(key=lambda b: -b["percentile"])

    return {
        "college_code": norm_code,
        "branch": branch,
        "requested_category": requested,
        "basis_category": basis,
        "is_estimate": basis is not None and basis != requested,
        "available_categories": sorted(available, key=lambda c: (-available[c], c)),
        "trends": trends,
        "summary": summary,
        "category_comparison": category_comparison,
        "branch_comparison": branch_comparison,
    }


# =====================================================================
# INDUSTRY FEATURES: SMART CAP OPTION FORM BUILDER & RANK CURVE ENGINE
# =====================================================================

class OptionFormRequest(BaseModel):
    percentile: Optional[float] = None
    rank: Optional[float] = None
    category: str = "GOPENS"
    branches: Optional[List[str]] = None
    cities: Optional[List[str]] = None
    round_number: Optional[int] = None
    strategy: str = "balanced"  # balanced | dream_heavy | safe_first
    max_choices: int = 30
    exact_only: Optional[bool] = False


# Empirical MHT-CET PCM Marks (out of 200) -> Approximate Percentile anchors
# Derived from recent State CET Cell PCM shift normalization tables
MARKS_PERCENTILE_ANCHORS = [
    (200, 100.00),
    (175, 99.90),
    (160, 99.65),
    (150, 99.30),
    (140, 98.80),
    (130, 98.05),
    (120, 97.00),
    (110, 95.60),
    (100, 93.70),
    (90, 90.80),
    (80, 86.50),
    (70, 80.50),
    (60, 72.00),
    (50, 61.00),
    (40, 46.00),
    (30, 28.00),
    (20, 12.00),
    (0, 1.00),
]


def _marks_to_percentile(marks: float) -> float:
    m = max(0.0, min(200.0, float(marks)))
    for i in range(len(MARKS_PERCENTILE_ANCHORS) - 1):
        m_hi, p_hi = MARKS_PERCENTILE_ANCHORS[i]
        m_lo, p_lo = MARKS_PERCENTILE_ANCHORS[i + 1]
        if m_lo <= m <= m_hi:
            t = (m - m_lo) / max(1e-6, (m_hi - m_lo))
            return round(p_lo + t * (p_hi - p_lo), 2)
    return 1.0


@app.get("/api/rank-curve")
def get_rank_curve(
    marks: Optional[float] = None,
    percentile: Optional[float] = None,
    rank: Optional[float] = None,
    db: Session = Depends(get_db),
):
    scale = get_rank_scale(db)
    latest_year = scale.latest_year
    sample_pcts = [
        99.9, 99.5, 99.0, 98.0, 97.0, 95.0, 92.0, 90.0,
        85.0, 80.0, 75.0, 70.0, 60.0, 50.0, 40.0, 25.0, 10.0,
    ]
    curve = []
    for p in sample_pcts:
        curve.append(
            {
                "percentile": p,
                "rank_2025": scale.pct_to_rank(2025, p),
                "rank_2024": scale.pct_to_rank(2024, p),
                "rank_2023": scale.pct_to_rank(2023, p),
            }
        )

    estimate = None
    if marks is not None:
        if marks < 0 or marks > 200:
            raise HTTPException(status_code=400, detail="Marks must be between 0 and 200")
        est_pct = _marks_to_percentile(marks)
        est_pct_low = max(1.0, round(est_pct - 1.2, 2))
        est_pct_high = min(99.99, round(est_pct + 0.9, 2))
        estimate = {
            "mode": "marks",
            "marks": marks,
            "estimated_percentile": est_pct,
            "percentile_range": [est_pct_low, est_pct_high],
            "estimated_rank": scale.pct_to_rank(latest_year, est_pct),
            "by_year": {
                str(y): scale.pct_to_rank(y, est_pct) for y in scale.years
            },
        }
    elif percentile is not None:
        if percentile <= 0 or percentile > 100:
            raise HTTPException(status_code=400, detail="Percentile must be between 0 and 100")
        estimate = {
            "mode": "percentile",
            "estimated_percentile": round(percentile, 4),
            "estimated_rank": scale.pct_to_rank(latest_year, percentile),
            "by_year": {
                str(y): scale.pct_to_rank(y, percentile) for y in scale.years
            },
        }
    elif rank is not None:
        if rank < 1:
            raise HTTPException(status_code=400, detail="Rank must be >= 1")
        est_pct = round(scale.rank_to_pct(latest_year, rank), 4)
        estimate = {
            "mode": "rank",
            "estimated_rank": int(round(rank)),
            "estimated_percentile": est_pct,
            "by_year": {
                str(y): round(scale.rank_to_pct(y, rank), 4) for y in scale.years
            },
        }

    return {
        "latest_year": latest_year,
        "pool_sizes": {
            "2023": scale.pct_to_rank(2023, 1.0),
            "2024": scale.pct_to_rank(2024, 1.0),
            "2025": scale.pct_to_rank(2025, 1.0),
        },
        "curve": curve,
        "estimate": estimate,
        "marks_table": [
            {
                "marks": m,
                "percentile": p,
                "rank_2025": scale.pct_to_rank(2025, p),
            }
            for m, p in MARKS_PERCENTILE_ANCHORS
            if m in (175, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60, 50)
        ],
    }


@app.post("/api/option-form/generate")
def generate_option_form(req: OptionFormRequest, db: Session = Depends(get_db)):
    if req.percentile is None and req.rank is None:
        raise HTTPException(status_code=400, detail="Provide percentile or rank")

    max_choices = max(10, min(60, int(req.max_choices or 30)))
    pred_req = PredictionRequest(
        percentile=req.percentile,
        rank=req.rank,
        category=req.category,
        branch=None,
        city=None,
        round_number=req.round_number,
        exact_only=req.exact_only,
    )
    pred_res = predict_colleges(pred_req, db)
    all_preds = pred_res.get("predictions", [])

    # Apply multi-branch & multi-city filters
    branch_set = {b.strip() for b in (req.branches or []) if b and b.strip()}
    city_set = {c.strip() for c in (req.cities or []) if c and c.strip()}

    filtered = []
    for p in all_preds:
        if branch_set and p["branch"] not in branch_set:
            continue
        if city_set and p["city"] not in city_set:
            continue
        filtered.append(p)

    # Deduplicate by (college_code, branch) keeping best record
    dedup = {}
    for p in filtered:
        key = (p["college_code"], p["branch"])
        if key not in dedup:
            dedup[key] = p
    pool = list(dedup.values())

    # Partition into Dream / Target / Safe buckets
    dream_pool = []
    target_pool = []
    safe_pool = []
    for p in pool:
        band = p.get("prediction_category")
        margin_pct = p.get("margin_percentile", 0) or 0
        if band == "Ambitious":
            dream_pool.append({**p, "tier": "Dream"})
        elif band == "Moderate" or (band == "Historically Within Range" and margin_pct < 1.5):
            target_pool.append({**p, "tier": "Target"})
        else:
            safe_pool.append({**p, "tier": "Safe"})

    # Sort each bucket cleanly:
    # Dream -> closest reachable ambitions first (lowest rank_ratio / highest chance)
    dream_pool.sort(key=lambda x: (abs(x.get("margin_percentile", -99)), x.get("historical_rank", 1e9)))
    # Target -> best rank first (most prestigious target colleges)
    target_pool.sort(key=lambda x: x.get("historical_rank", 1e9))
    # Safe -> highest cutoff / best reputation safe colleges first
    safe_pool.sort(key=lambda x: x.get("historical_rank", 1e9))

    strategy = (req.strategy or "balanced").lower()
    if strategy == "dream_heavy":
        ratios = (0.35, 0.40, 0.25)
    elif strategy == "safe_first":
        ratios = (0.10, 0.40, 0.50)
    else:
        ratios = (0.20, 0.45, 0.35)

    n_dream = max(1, round(max_choices * ratios[0]))
    n_target = max(1, round(max_choices * ratios[1]))
    n_safe = max(1, max_choices - n_dream - n_target)

    chosen = []
    chosen.extend(dream_pool[:n_dream])
    chosen.extend(target_pool[:n_target])
    chosen.extend(safe_pool[:n_safe])

    # Backfill if any bucket was short
    used_keys = {(c["college_code"], c["branch"]) for c in chosen}
    for extra_pool in (target_pool, safe_pool, dream_pool):
        if len(chosen) >= max_choices:
            break
        for item in extra_pool:
            if len(chosen) >= max_choices:
                break
            k = (item["college_code"], item["branch"])
            if k not in used_keys:
                used_keys.add(k)
                chosen.append(item)

    # Crucial DTE CAP rule: strictly order final Option Form by prestige / lowest cutoff rank first!
    chosen.sort(key=lambda x: x.get("historical_rank") or float("inf"))

    ordered_choices = []
    for idx, c in enumerate(chosen, start=1):
        ordered_choices.append(
            {
                "preference_no": idx,
                "tier": c["tier"],
                **c,
            }
        )

    dream_cnt = sum(1 for c in ordered_choices if c["tier"] == "Dream")
    target_cnt = sum(1 for c in ordered_choices if c["tier"] == "Target")
    safe_cnt = sum(1 for c in ordered_choices if c["tier"] == "Safe")

    warnings = []
    health = 100
    if len(ordered_choices) < 10:
        warnings.append("Short list (< 10 choices): consider adding more cities or branches to avoid non-allotment.")
        health -= 18
    if safe_cnt < 3:
        warnings.append("Fewer than 3 Safe backup options — add at least 3–5 Safe colleges at the bottom of your form.")
        health -= 20
    if dream_cnt == 0 and len(ordered_choices) > 0:
        warnings.append("No Dream choices at the top — adding 3–5 upward-stretch choices maximizes Round 1/2 betterment upside.")
        health -= 10
    if not warnings:
        warnings.append("Optimal DTE Preference Order: Dream choices placed at the top, followed by Target and guaranteed Safe backups.")

    return {
        "student": pred_res["student"],
        "strategy": strategy,
        "total_pool_matched": len(pool),
        "counts": {
            "total": len(ordered_choices),
            "dream": dream_cnt,
            "target": target_cnt,
            "safe": safe_cnt,
        },
        "health_score": max(35, health),
        "advice": warnings,
        "choices": ordered_choices,
    }


# =====================================================================
# MONETIZATION, GPAY (9920627188) ORDERS, LEADS & ADMIN REVENUE API
# =====================================================================

class PaymentSubmitRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=20)
    email: Optional[str] = Field(default=None, max_length=120)
    plan: str = Field(..., max_length=16)  # "pro" or "vip"
    utr_number: str = Field(..., min_length=8, max_length=30)
    notes: Optional[str] = Field(default=None, max_length=300)


class LeadSubmitRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=20)
    score_info: Optional[str] = Field(default=None, max_length=80)
    category: Optional[str] = Field(default=None, max_length=40)
    preferred_branch: Optional[str] = Field(default=None, max_length=120)
    message: Optional[str] = Field(default=None, max_length=600)


class AdminLoginRequest(BaseModel):
    pin: str = Field(..., min_length=4, max_length=64)


class AdminStatusUpdateRequest(BaseModel):
    status: str = Field(..., max_length=20)
    notes: Optional[str] = Field(default=None, max_length=300)


class AdminKeyGenerateRequest(BaseModel):
    full_name: str = Field(..., max_length=100)
    phone: str = Field(..., max_length=20)
    plan: str = Field(default="pro", max_length=16)
    notes: Optional[str] = Field(default="Direct GPay / WhatsApp Payment", max_length=300)


class EntitlementVerifyRequest(BaseModel):
    entitlement_token: str = Field(..., min_length=10, max_length=512)


def _require_admin(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_admin_pin: Optional[str] = Header(default=None),
):
    ip = get_client_ip(request)
    locked_sec = admin_guard.check_locked(ip)
    if locked_sec is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed admin login attempts. Try again in {locked_sec}s.",
            headers={"Retry-After": str(locked_sec)},
        )

    # Preferred: signed short-lived Bearer token issued by POST /api/admin/login
    if authorization and authorization.lower().startswith("bearer "):
        tok = authorization[7:].strip()
        if verify_admin_token(tok):
            admin_guard.reset(ip)
            return True

    # Fallback header verified in constant-time (protected by same brute-force lockout)
    if x_admin_pin and verify_admin_secret(x_admin_pin):
        admin_guard.reset(ip)
        return True

    remaining = admin_guard.record_failure(ip)
    if remaining <= 0:
        raise HTTPException(
            status_code=429,
            detail="Account temporarily locked due to repeated invalid credentials.",
            headers={"Retry-After": "900"},
        )
    raise HTTPException(status_code=401, detail="Invalid Admin credentials")


@app.post("/api/admin/login")
def admin_login(req: AdminLoginRequest, request: Request):
    ip = get_client_ip(request)
    locked_sec = admin_guard.check_locked(ip)
    if locked_sec is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Locked for {locked_sec} seconds.",
            headers={"Retry-After": str(locked_sec)},
        )
    if not verify_admin_secret(req.pin):
        remaining = admin_guard.record_failure(ip)
        if remaining <= 0:
            raise HTTPException(
                status_code=429,
                detail="Too many failed attempts. Admin login temporarily locked for 15 minutes.",
                headers={"Retry-After": "900"},
            )
        raise HTTPException(
            status_code=401,
            detail=f"Invalid Admin PIN ({remaining} attempt(s) remaining before lockout).",
        )
    admin_guard.reset(ip)
    token, expires_in = issue_admin_token(ttl_seconds=7200)
    return {"token": token, "token_type": "bearer", "expires_in": expires_in}


def _generate_access_key(plan: str) -> str:
    # 48 bits of cryptographic entropy (281+ trillion combinations) — immune to guessing/enumeration
    prefix = "CAP-VIP" if plan == "vip" else "CAP-PRO"
    raw = secrets.token_hex(6).upper()
    return f"{prefix}-{raw[:4]}-{raw[4:8]}-{raw[8:12]}"


@app.get("/api/monetization/config")
def get_monetization_config():
    return {
        "gpay_number": GPAY_NUMBER,
        "whatsapp_number": f"91{GPAY_NUMBER}",
        "payee_label": "CAP Compass Counselling",
        "plans": PLAN_CATALOG,
    }


@app.post("/api/payments/submit")
def submit_gpay_payment(req: PaymentSubmitRequest, db: Session = Depends(get_db)):
    plan_id = (req.plan or "").strip().lower()
    if plan_id not in PLAN_CATALOG:
        raise HTTPException(status_code=400, detail="Plan must be 'pro' or 'vip'")

    full_name = sanitize_text(req.full_name, max_len=100) or ""
    phone = re.sub(r"\D+", "", req.phone or "")
    utr = re.sub(r"[^A-Za-z0-9]", "", (req.utr_number or "").strip()).upper()
    clean_email = sanitize_email(req.email)
    clean_notes = sanitize_text(req.notes, max_len=300)

    if len(full_name) < 2:
        raise HTTPException(status_code=400, detail="Please enter your full name")
    if len(phone) < 10 or len(phone) > 15:
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit mobile/WhatsApp number")
    if len(utr) < 8 or len(utr) > 24:
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid Google Pay UTR / UPI Transaction ID (8–24 characters)",
        )

    existing_utr = (
        db.query(PaymentOrder).filter(PaymentOrder.utr_number == utr).first()
    )
    if existing_utr:
        # Only return the existing access key if phone matches; prevents UTR probing for others' keys!
        if existing_utr.phone != phone[-10:]:
            raise HTTPException(
                status_code=409,
                detail="This UTR reference is already registered to another payment record.",
            )
        return {
            "already_submitted": True,
            "order_id": existing_utr.id,
            "access_key": existing_utr.access_key,
            "entitlement_token": (
                issue_entitlement_token(existing_utr.access_key, existing_utr.plan)
                if existing_utr.status == "approved"
                else None
            ),
            "plan": existing_utr.plan,
            "amount_inr": existing_utr.amount_inr,
            "status": existing_utr.status,
            "gpay_number": GPAY_NUMBER,
            "message": "This UTR was already recorded. Use your Access Key below to check activation status.",
        }

    access_key = _generate_access_key(plan_id)
    while db.query(PaymentOrder).filter(PaymentOrder.access_key == access_key).first():
        access_key = _generate_access_key(plan_id)

    order = PaymentOrder(
        access_key=access_key,
        full_name=full_name,
        phone=phone[-10:],
        email=clean_email,
        plan=plan_id,
        amount_inr=PLAN_CATALOG[plan_id]["amount_inr"],
        utr_number=utr,
        payment_method=f"GPay ({GPAY_NUMBER})",
        status="pending",
        notes=clean_notes,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    return {
        "already_submitted": False,
        "order_id": order.id,
        "access_key": order.access_key,
        "plan": order.plan,
        "amount_inr": order.amount_inr,
        "status": order.status,
        "gpay_number": GPAY_NUMBER,
        "message": (
            f"Payment UTR recorded! Send your GPay screenshot to WhatsApp {GPAY_NUMBER} "
            f"with key {order.access_key} for instant verification."
        ),
    }


@app.get("/api/payments/verify")
def verify_access_key(access_key: str, db: Session = Depends(get_db)):
    key = re.sub(r"[^A-Za-z0-9\-]", "", (access_key or "").strip().upper())
    if not key or len(key) > 40:
        raise HTTPException(status_code=400, detail="Valid access key is required")

    order = db.query(PaymentOrder).filter(PaymentOrder.access_key == key).first()
    if not order:
        return {
            "valid": False,
            "status": "not_found",
            "plan": "free",
            "message": "Access key not found. Please check the code or submit your GPay UTR.",
        }

    is_active = order.status == "approved"
    masked_utr = mask_utr(order.utr_number)
    ent_token = issue_entitlement_token(order.access_key, order.plan) if is_active else None
    first_name = (order.full_name or "").split()[0] if order.full_name else "Student"

    return {
        "valid": is_active,
        "status": order.status,
        "plan": order.plan if is_active else "free",
        "requested_plan": order.plan,
        "access_key": order.access_key,
        "entitlement_token": ent_token,
        "full_name": first_name,
        "amount_inr": order.amount_inr,
        "utr_number": masked_utr,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "message": (
            f"{PLAN_CATALOG.get(order.plan, {}).get('name', order.plan.upper())} is active!"
            if is_active
            else (
                f"Payment UTR {masked_utr} is pending owner verification on GPay {GPAY_NUMBER}."
                if order.status == "pending"
                else "This payment order was rejected. Please contact support on WhatsApp 9920627188."
            )
        ),
    }


@app.post("/api/payments/verify-token")
def verify_entitlement(req: EntitlementVerifyRequest, db: Session = Depends(get_db)):
    payload = verify_entitlement_token(req.entitlement_token)
    if not payload:
        return {"valid": False, "plan": "free"}
    order = (
        db.query(PaymentOrder)
        .filter(PaymentOrder.access_key == payload.get("key"))
        .first()
    )
    if not order or order.status != "approved":
        return {"valid": False, "plan": "free"}
    return {
        "valid": True,
        "plan": order.plan,
        "access_key": order.access_key,
        "full_name": (order.full_name or "").split()[0] if order.full_name else "Student",
    }


@app.post("/api/leads")
def submit_counselling_lead(req: LeadSubmitRequest, db: Session = Depends(get_db)):
    full_name = sanitize_text(req.full_name, max_len=100) or ""
    phone = re.sub(r"\D+", "", req.phone or "")
    if len(full_name) < 2:
        raise HTTPException(status_code=400, detail="Please enter your name")
    if len(phone) < 10 or len(phone) > 15:
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit phone number")

    lead = CounsellingLead(
        full_name=full_name,
        phone=phone[-10:],
        score_info=sanitize_text(req.score_info, max_len=80),
        category=sanitize_text(req.category, max_len=40),
        preferred_branch=sanitize_text(req.preferred_branch, max_len=120),
        message=sanitize_text(req.message, max_len=600),
        status="new",
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    return {
        "id": lead.id,
        "status": lead.status,
        "message": f"Callback request received! Our CAP counsellor will reach out on {lead.phone} or WhatsApp {GPAY_NUMBER}.",
    }


@app.get("/api/admin/overview")
def admin_overview(
    _: bool = Depends(_require_admin), db: Session = Depends(get_db)
):
    orders = (
        db.query(PaymentOrder).order_by(desc(PaymentOrder.created_at)).limit(200).all()
    )
    leads = (
        db.query(CounsellingLead)
        .order_by(desc(CounsellingLead.created_at))
        .limit(200)
        .all()
    )

    approved_revenue = sum(o.amount_inr for o in orders if o.status == "approved")
    pending_revenue = sum(o.amount_inr for o in orders if o.status == "pending")

    return {
        "gpay_number": GPAY_NUMBER,
        "metrics": {
            "total_revenue_inr": approved_revenue,
            "pending_revenue_inr": pending_revenue,
            "approved_orders": sum(1 for o in orders if o.status == "approved"),
            "pending_orders": sum(1 for o in orders if o.status == "pending"),
            "total_orders": len(orders),
            "total_leads": len(leads),
            "new_leads": sum(1 for l in leads if l.status == "new"),
        },
        "orders": [
            {
                "id": o.id,
                "access_key": o.access_key,
                "full_name": o.full_name,
                "phone": o.phone,
                "email": o.email,
                "plan": o.plan,
                "amount_inr": o.amount_inr,
                "utr_number": o.utr_number,
                "status": o.status,
                "notes": o.notes,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "approved_at": o.approved_at.isoformat() if o.approved_at else None,
            }
            for o in orders
        ],
        "leads": [
            {
                "id": l.id,
                "full_name": l.full_name,
                "phone": l.phone,
                "score_info": l.score_info,
                "category": l.category,
                "preferred_branch": l.preferred_branch,
                "message": l.message,
                "status": l.status,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in leads
        ],
    }


@app.post("/api/admin/payments/{order_id}/status")
def admin_update_payment_status(
    order_id: int,
    req: AdminStatusUpdateRequest,
    _: bool = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    new_status = (req.status or "").strip().lower()
    if new_status not in ("pending", "approved", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid status")

    order = db.query(PaymentOrder).filter(PaymentOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = new_status
    if new_status == "approved":
        order.approved_at = datetime.now(timezone.utc)
    if req.notes is not None:
        order.notes = sanitize_text(req.notes, max_len=300)
    db.commit()
    db.refresh(order)

    return {
        "id": order.id,
        "access_key": order.access_key,
        "status": order.status,
        "plan": order.plan,
    }


@app.post("/api/admin/keys/generate")
def admin_generate_direct_key(
    req: AdminKeyGenerateRequest,
    _: bool = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    plan_id = (req.plan or "pro").strip().lower()
    if plan_id not in PLAN_CATALOG:
        raise HTTPException(status_code=400, detail="Plan must be 'pro' or 'vip'")

    access_key = _generate_access_key(plan_id)
    while db.query(PaymentOrder).filter(PaymentOrder.access_key == access_key).first():
        access_key = _generate_access_key(plan_id)

    utr_synthetic = f"MANUAL-{secrets.token_hex(4).upper()}"
    order = PaymentOrder(
        access_key=access_key,
        full_name=sanitize_text(req.full_name, max_len=100) or "Direct GPay Buyer",
        phone=re.sub(r"\D+", "", req.phone or "")[-10:] or GPAY_NUMBER,
        plan=plan_id,
        amount_inr=PLAN_CATALOG[plan_id]["amount_inr"],
        utr_number=utr_synthetic,
        payment_method=f"Direct GPay ({GPAY_NUMBER})",
        status="approved",
        notes=sanitize_text(req.notes, max_len=300) or "Issued via Admin Dashboard",
        approved_at=datetime.now(timezone.utc),
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    return {
        "id": order.id,
        "access_key": order.access_key,
        "plan": order.plan,
        "amount_inr": order.amount_inr,
        "status": order.status,
    }


@app.post("/api/admin/leads/{lead_id}/status")
def admin_update_lead_status(
    lead_id: int,
    req: AdminStatusUpdateRequest,
    _: bool = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    new_status = (req.status or "").strip().lower()
    if new_status not in ("new", "contacted", "resolved"):
        raise HTTPException(status_code=400, detail="Invalid lead status")

    lead = db.query(CounsellingLead).filter(CounsellingLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.status = new_status
    db.commit()
    return {"id": lead.id, "status": lead.status}
