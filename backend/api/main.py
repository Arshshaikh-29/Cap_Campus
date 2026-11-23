import json
import os
import re
import secrets
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import asc, desc, func, or_
from sqlalchemy.orm import Session
from .database import Base, engine, get_db
from .models import CollegeRecord, PaymentOrder, CounsellingLead, UserAccount
from .rank_scale import get_rank_scale
from .college_websites import get_college_links
from .college_locations import get_college_location
from .college_insights import (
    FRA_PORTAL_URL,
    MAHADBT_PORTAL_URL,
    NIRF_PORTAL_URL,
    VERIFIED_COLLEGE_INSIGHTS,
    get_college_insights,
    get_college_insights_summary,
)
from .security import (
    ALLOWED_ORIGINS,
    ALLOWED_ORIGIN_REGEX,
    IS_PRODUCTION,
    SecurityMiddleware,
    admin_guard,
    get_client_ip,
    get_google_client_id,
    issue_admin_token,
    issue_entitlement_token,
    issue_user_token,
    mask_utr,
    sanitize_email,
    sanitize_text,
    verify_admin_secret,
    verify_admin_token,
    verify_entitlement_token,
    verify_user_token,
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
    round_number: Optional[int] = Field(default=4, ge=1, le=4)
    year: Optional[int] = Field(default=2026, ge=2020, le=2030)


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
                **get_college_insights_summary(c[0]),
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
        "location": get_college_location(
            college.college_code, college.college_name, college.city
        ),
        **get_college_links(college.college_code),
        **get_college_insights(college.college_code),
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
    if req.round_number in (1, 2, 3, 4):
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
            **get_college_insights_summary(r.college_code),
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


def _resolve_entitlement_tier(token: Optional[str], db: Session) -> str:
    """Server-side verification of paid Pro/VIP entitlement token against live DB status."""
    if not token:
        return "free"
    payload = verify_entitlement_token(token)
    if not payload:
        return "free"
    order = (
        db.query(PaymentOrder)
        .filter(PaymentOrder.access_key == payload.get("key"))
        .first()
    )
    if not order or order.status != "approved":
        return "free"
    return order.plan if order.plan in ("pro", "vip") else "free"


class BettermentRadarRequest(BaseModel):
    percentile: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    rank: Optional[float] = Field(default=None, ge=1.0, le=500000.0)
    category: str = Field(min_length=1, max_length=24)
    branches: Optional[List[str]] = Field(default=None, max_length=50)
    cities: Optional[List[str]] = Field(default=None, max_length=50)


@app.post("/api/betterment-radar")
def betterment_radar(
    req: BettermentRadarRequest,
    x_entitlement_token: Optional[str] = Header(default=None, alias="X-Entitlement-Token"),
    db: Session = Depends(get_db),
):
    """
    CAP Round 1 -> Round 2 -> Round 3 Betterment & Spot-Round Drop Radar.
    Finds colleges that closed ABOVE the student's score in Round 1 but historically
    dropped INTO reach by Round 2/3, plus high-value Spot/ACAP watchlist targets.
    Server-enforces Free preview (Top 5) vs Paid Pro/VIP full access.
    """
    if req.percentile is None and req.rank is None:
        raise HTTPException(status_code=400, detail="Must provide either percentile or rank")

    scale = get_rank_scale(db)
    latest_year = scale.latest_year
    use_pct = req.percentile is not None
    student_pct = (
        float(req.percentile) if use_pct else float(scale.rank_to_pct(latest_year, req.rank))
    )
    student_rank = (
        float(scale.pct_to_rank(latest_year, req.percentile)) if use_pct else float(req.rank)
    )
    if not (0 < student_pct <= 100):
        raise HTTPException(status_code=400, detail="Percentile must be between 0 and 100")

    req_cat = (req.category or "GOPENS").upper().strip()
    chain = build_category_chain(req_cat, include_open_fallback=False)
    priority = {cat: i for i, group in enumerate(chain) for cat in group}
    requested_family = set(chain[0]) if chain else set()
    m_req = _CAT_RE.match(req_cat)
    req_prefix = m_req.group(1) if m_req else ""
    minority_colleges, _ = _get_college_sets(db)

    query = db.query(
        CollegeRecord.choice_code,
        CollegeRecord.college_code,
        CollegeRecord.college_name,
        CollegeRecord.city,
        CollegeRecord.branch_name,
        CollegeRecord.category,
        CollegeRecord.stage,
        CollegeRecord.percentile,
        CollegeRecord.year,
        CollegeRecord.round_number,
    ).filter(
        CollegeRecord.category.in_(list(priority.keys())),
        CollegeRecord.percentile.isnot(None),
        CollegeRecord.round_number.in_([1, 2, 3, 4]),
    )

    target_branches = [b.strip() for b in (req.branches or []) if b and b.strip()]
    target_cities = [c.strip() for c in (req.cities or []) if c and c.strip()]
    if target_branches:
        query = query.filter(CollegeRecord.branch_name.in_(target_branches))
    if target_cities:
        query = query.filter(CollegeRecord.city.in_(target_cities))
    if req_prefix == "G":
        query = query.filter(~CollegeRecord.college_code.in_(list(WOMENS_ONLY_COLLEGES)))
    if req_cat not in ("GOPENS", "GOPENH", "GOPENO", "LOPENS", "LOPENH", "LOPENO", "MI", "TFWS") and minority_colleges:
        query = query.filter(~CollegeRecord.college_code.in_(list(minority_colleges)))

    # Track closing percentile per (course_key, category, year, round_number) preferring Stage I/MH
    cells = {}
    meta = {}
    for r in query.all():
        key = r.choice_code or f"{r.college_code}|{r.branch_name}"
        st_prio = 0 if r.stage in ("I", "MH") else 1
        ckey = (key, r.category, r.year, r.round_number)
        cur = cells.get(ckey)
        if cur is None or (st_prio, r.percentile) < cur:
            cells[ckey] = (st_prio, r.percentile)
        if key not in meta:
            meta[key] = {
                "choice_code": r.choice_code,
                "college_code": r.college_code,
                "college_name": r.college_name,
                "city": r.city,
                "branch": r.branch_name,
            }

    # For each course, pick best (category_priority, -year) that has Round 1 AND at least Round 2 or Round 3
    by_course = {}
    for (key, cat, yr, rnd), (_, pct) in cells.items():
        by_course.setdefault(key, {}).setdefault((priority[cat], -yr, cat, yr), {})[rnd] = pct

    betterment_gems = []
    spot_watchlist = []
    biggest_drops = []

    for key, variants in by_course.items():
        chosen_variant = None
        chosen_rounds = None
        for vkey in sorted(variants.keys()):
            rmap = variants[vkey]
            if 1 in rmap and (4 in rmap or 3 in rmap or 2 in rmap):
                chosen_variant = vkey
                chosen_rounds = rmap
                break
        if not chosen_variant or not chosen_rounds:
            continue

        _, _, basis_cat, yr = chosen_variant
        m = meta[key]
        is_est = basis_cat not in requested_family
        is_min = m["college_code"] in minority_colleges

        def cal(p):
            if p is None:
                return None
            if not is_est:
                return round(float(p), 2)
            cp, _ = _calibrate_cutoff_for_category(
                req_cat, basis_cat, float(p), None, yr, is_minority_college=is_min
            )
            return round(float(cp if cp is not None else p), 2)

        r1 = cal(chosen_rounds.get(1))
        r2 = cal(chosen_rounds.get(2))
        r3 = cal(chosen_rounds.get(3))
        r4 = cal(chosen_rounds.get(4))
        final_pct = r4 if r4 is not None else (r3 if r3 is not None else r2)
        final_round_num = 4 if r4 is not None else (3 if r3 is not None else 2)
        if r1 is None or final_pct is None:
            continue

        drop_pct = round(r1 - final_pct, 2)
        r1_rank = int(round(scale.pct_to_rank(latest_year, r1)))
        final_rank = int(round(scale.pct_to_rank(latest_year, final_pct)))
        rank_relaxation = max(0, final_rank - r1_rank)
        gap_after_r3 = round(student_pct - final_pct, 2)

        row_obj = {
            **m,
            **get_college_links(m["college_code"]),
            **get_college_insights_summary(m["college_code"]),
            "year": yr,
            "basis_category": basis_cat,
            "is_estimate": is_est,
            "r1_percentile": r1,
            "r2_percentile": r2,
            "r3_percentile": r3,
            "r4_percentile": r4,
            "final_round": final_round_num,
            "final_percentile": final_pct,
            "r1_rank": r1_rank,
            "final_rank": final_rank,
            "drop_percentile": drop_pct,
            "rank_relaxation": rank_relaxation,
            "margin_after_r3": gap_after_r3,
        }

        # 1. Betterment Gems: missed R1 cutoff, but dropped into reach (or within 0.35%ile) by R2/R3/R4!
        if r1 > student_pct and final_pct <= student_pct + 0.35 and drop_pct >= 0.05:
            verdict = (
                f"Historically Unlocked by Round {final_round_num} — Do NOT Freeze R1!"
                if final_pct <= student_pct
                else "High-Probability Betterment Target (within 0.35%ile)"
            )
            betterment_gems.append({**row_obj, "verdict": verdict})
        # 2. Spot / ACAP Round Watchlist: just 0.35 to 2.2 %ile above final CAP round closing
        elif 0.35 < (final_pct - student_pct) <= 2.2:
            spot_watchlist.append(
                {
                    **row_obj,
                    "verdict": (
                        f"Missed Round {final_round_num} by {round(final_pct - student_pct, 2)} %ile — Strong Spot / ACAP Target"
                    ),
                }
            )

        # 3. Biggest drops in the student's competitive window (within ±4 %ile)
        if drop_pct >= 0.30 and abs(final_pct - student_pct) <= 4.0:
            biggest_drops.append(
                {
                    **row_obj,
                    "verdict": f"Dropped {drop_pct:.2f} %ile (+{rank_relaxation:,} ranks) from R1 to final round",
                }
            )

    # Sort best colleges first (lowest final closing rank = highest prestige)
    betterment_gems.sort(key=lambda x: (0 if x["margin_after_r3"] >= 0 else 1, x["final_rank"]))
    spot_watchlist.sort(key=lambda x: (abs(x["margin_after_r3"]), x["final_rank"]))
    biggest_drops.sort(key=lambda x: (-x["drop_percentile"], x["final_rank"]))

    tier = _resolve_entitlement_tier(x_entitlement_token, db)
    is_pro = tier in ("pro", "vip")
    FREE_GEMS = 5
    FREE_SPOT = 3
    FREE_DROPS = 5

    max_drop = max((x["drop_percentile"] for x in (betterment_gems + biggest_drops)), default=0.0)
    avg_drop = (
        round(sum(x["drop_percentile"] for x in betterment_gems) / len(betterment_gems), 2)
        if betterment_gems
        else 0.0
    )

    return {
        "tier": tier,
        "is_pro": is_pro,
        "student": {
            "percentile": round(student_pct, 4),
            "rank": round(student_rank),
            "category": req_cat,
            "rank_scale_year": latest_year,
        },
        "summary": {
            "total_betterment_gems": len(betterment_gems),
            "total_spot_watchlist": len(spot_watchlist),
            "total_biggest_drops": len(biggest_drops),
            "avg_gem_drop_percentile": avg_drop,
            "max_drop_percentile": max_drop,
            "locked_betterment_count": 0 if is_pro else max(0, len(betterment_gems) - FREE_GEMS),
            "locked_spot_count": 0 if is_pro else max(0, len(spot_watchlist) - FREE_SPOT),
        },
        "betterment_gems": betterment_gems[:80] if is_pro else betterment_gems[:FREE_GEMS],
        "spot_watchlist": spot_watchlist[:40] if is_pro else spot_watchlist[:FREE_SPOT],
        "biggest_drops": biggest_drops[:40] if is_pro else biggest_drops[:FREE_DROPS],
    }


class ROIFinderRequest(BaseModel):
    percentile: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    rank: Optional[float] = Field(default=None, ge=1.0, le=500000.0)
    category: str = Field(min_length=1, max_length=24)
    gender: str = Field(default="male", max_length=12)
    income_below_8l: bool = Field(default=True)
    max_annual_budget_inr: Optional[int] = Field(default=None, ge=0, le=500000)
    branches: Optional[List[str]] = Field(default=None, max_length=50)
    cities: Optional[List[str]] = Field(default=None, max_length=50)


def _compute_maharashtra_net_fee(
    sticker_annual_inr: int,
    category: str,
    gender: str,
    income_below_8l: bool,
) -> tuple[int, str]:
    """
    Estimate net annual payable fee under official Maharashtra Govt / MahaDBT rules.
    Standard FRA/DTE fee split is ~87% Tuition Fee + ~13% Development & Univ. Fee.
    """
    cat = (category or "GOPENS").upper().strip()
    is_female = (gender or "male").strip().lower() == "female" or cat.startswith("L")
    tuition = int(round(sticker_annual_inr * 0.87))
    dev_and_univ = max(4500, sticker_annual_inr - tuition)

    if "SC" in cat and "SEBC" not in cat:
        return min(5000, dev_and_univ), "SC Full Scholarship (MahaDBT)"
    if "ST" in cat and "STATE" not in cat:
        return min(5000, dev_and_univ), "ST Full Scholarship (MahaDBT)"
    if cat == "TFWS":
        return dev_and_univ, "TFWS 100% Tuition Fee Waiver"
    if any(k in cat for k in ("VJ", "NT1", "NT2", "NT3")) and income_below_8l:
        return dev_and_univ, "VJ/NT 100% Tuition Fee Waiver (MahaDBT < ₹8L)"
    if is_female and income_below_8l and (
        any(k in cat for k in ("OPEN", "OBC", "SEBC", "EWS")) or cat == "MI"
    ):
        return dev_and_univ, "Maharashtra Girls 100% Tuition Waiver (< ₹8L GR)"
    if income_below_8l and any(k in cat for k in ("OBC", "SEBC", "EWS", "OPEN")):
        net = int(round(tuition * 0.50)) + dev_and_univ
        scheme = (
            "EBC Rajarshi Shahu 50% Tuition Waiver (< ₹8L)"
            if "OPEN" in cat
            else "OBC/SEBC/EWS 50% Tuition Waiver (MahaDBT < ₹8L)"
        )
        return net, scheme
    return sticker_annual_inr, "Standard CAP Open / Full Fee (No Waiver Applied)"


@app.post("/api/roi-finder")
def roi_budget_finder(
    req: ROIFinderRequest,
    x_entitlement_token: Optional[str] = Header(default=None, alias="X-Entitlement-Token"),
    db: Session = Depends(get_db),
):
    """
    Smart Scholarship, Net-Fee Budget & ROI Finder.
    Combines real CAP reachability + verified Maharashtra FRA/Govt Fees +
    official MahaDBT/Girls/TFWS waivers + NIRF Median Salaries to rank reachable
    colleges by true net ROI payback. Server-enforces Free preview vs Paid Pro/VIP.
    """
    if req.percentile is None and req.rank is None:
        raise HTTPException(status_code=400, detail="Must provide either percentile or rank")

    pred_res = predict_colleges(
        PredictionRequest(
            percentile=req.percentile,
            rank=req.rank,
            category=req.category,
            branches=req.branches,
            cities=req.cities,
        ),
        db,
    )
    preds = pred_res["predictions"] if not pred_res.get("fallback_used") else []
    tier = _resolve_entitlement_tier(x_entitlement_token, db)
    is_pro = tier in ("pro", "vip")

    # Deduplicate to best reachable branch per college (or keep top matching college+branch combos)
    items = []
    seen = set()
    for p in preds:
        if p["prediction_category"] not in ("Historically Within Range", "Moderate"):
            continue
        code = p["college_code"]
        raw = VERIFIED_COLLEGE_INSIGHTS.get(code)
        if not raw:
            continue
        k = (code, p["branch"])
        if k in seen:
            continue
        seen.add(k)

        sticker_annual = raw["annual_open_inr"]
        net_annual, scheme_label = _compute_maharashtra_net_fee(
            sticker_annual, req.category, req.gender, req.income_below_8l
        )
        if is_pro and req.max_annual_budget_inr is not None and net_annual > req.max_annual_budget_inr:
            continue

        annual_savings = max(0, sticker_annual - net_annual)
        four_yr_sticker = sticker_annual * 4
        four_yr_net = net_annual * 4
        four_yr_savings = annual_savings * 4
        nirf_median_lpa = raw["nirf_median_lpa"]
        payback_years = (
            round(four_yr_net / (nirf_median_lpa * 100_000), 2)
            if nirf_median_lpa > 0
            else 99.0
        )
        roi_multiple = round((nirf_median_lpa * 100_000) / max(1, four_yr_net), 2)

        items.append(
            {
                "college_code": code,
                "college_name": p["college_name"],
                "city": p["city"],
                "branch": p["branch"],
                "choice_code": p.get("choice_code"),
                "prediction_category": p["prediction_category"],
                "chance_level": p.get("chance_level"),
                "cutoff_percentile": p["historical_percentile"],
                "cutoff_rank": p["historical_rank"],
                "official_website": p.get("official_website"),
                "website_domain": p.get("website_domain"),
                "cet_portal_url": p.get("cet_portal_url"),
                "institute_type": raw["institute_type"],
                "fee_source": (
                    "Maharashtra FRA" if raw["fee_source_type"] == "FRA" else "Govt./Institute Circular"
                ),
                "sticker_annual_fee_inr": sticker_annual,
                "net_annual_fee_inr": net_annual,
                "annual_savings_inr": annual_savings,
                "four_year_sticker_fee_inr": four_yr_sticker,
                "four_year_net_fee_inr": four_yr_net,
                "four_year_savings_inr": four_yr_savings,
                "scheme_applied": scheme_label,
                "nirf_median_lpa": nirf_median_lpa,
                "average_lpa": raw["average_lpa"],
                "highest_lpa": raw["highest_lpa"],
                "net_roi_payback_years": payback_years,
                "roi_multiple": roi_multiple,
            }
        )

    # Rank by best true net ROI payback, then higher NIRF median salary
    items.sort(key=lambda x: (x["net_roi_payback_years"], -x["nirf_median_lpa"]))

    FREE_LIMIT = 5
    _, sample_scheme = _compute_maharashtra_net_fee(
        150000, req.category, req.gender, req.income_below_8l
    )

    return {
        "tier": tier,
        "is_pro": is_pro,
        "student": pred_res["student"],
        "scheme_applied": sample_scheme,
        "sources": {
            "fra_portal_url": FRA_PORTAL_URL,
            "nirf_portal_url": NIRF_PORTAL_URL,
            "mahadbt_portal_url": MAHADBT_PORTAL_URL,
        },
        "summary": {
            "total_matches": len(items),
            "best_payback_years": items[0]["net_roi_payback_years"] if items else None,
            "highest_nirf_median_lpa": max((x["nirf_median_lpa"] for x in items), default=None),
            "max_four_year_savings_inr": max((x["four_year_savings_inr"] for x in items), default=0),
            "locked_count": 0 if is_pro else max(0, len(items) - FREE_LIMIT),
        },
        "results": items[:80] if is_pro else items[:FREE_LIMIT],
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
    target_year = req.year or scale.latest_year
    target_round = req.round_number or 4
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
            score = None
            for i, group in enumerate(chain):
                if c in group:
                    score = (i, 0 if c == requested else 1)
                    break
            if score is None:
                continue

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
            # No seat opened for this category or any Open/TFWS/EWS fallback in this round
            # (e.g. only an unrelated reserved/PWD/Orphan seat remained vacant in CAP Round 3/4).
            continue

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


# =============================================================================
# GOOGLE SIGN-IN PORTAL & CLOUD PROFILE SYNC
# =============================================================================

class GoogleAuthRequest(BaseModel):
    credential: str = Field(min_length=40, max_length=4096)


class ProfileSyncRequest(BaseModel):
    saved_input_type: Optional[str] = Field(default="percentile", max_length=16)
    saved_score: Optional[float] = Field(default=None, ge=0.0, le=500000.0)
    saved_category: Optional[str] = Field(default="GOPENS", max_length=24)
    bookmarks: Optional[List[dict]] = Field(default=None, max_length=60)


def _verify_google_id_token(id_token: str, expected_client_id: str) -> dict:
    """Verify a Google Identity Services ID token via Google's official tokeninfo endpoint."""
    qs = urllib.parse.urlencode({"id_token": id_token})
    url = f"https://oauth2.googleapis.com/tokeninfo?{qs}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CAP-Compass-Auth/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            info = json.loads(resp.read().decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired Google Sign-In credential. Please try again.",
        )

    if info.get("aud") != expected_client_id:
        raise HTTPException(
            status_code=401, detail="Google token audience does not match this portal."
        )
    if str(info.get("email_verified", "")).lower() != "true":
        raise HTTPException(
            status_code=401, detail="Google account email must be verified."
        )
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Untrusted token issuer.")
    try:
        if int(info.get("exp", 0)) < int(time.time()):
            raise HTTPException(status_code=401, detail="Google sign-in token expired.")
    except ValueError:
        raise HTTPException(status_code=401, detail="Malformed Google token expiry.")
    return info


def _serialize_user(u: UserAccount) -> dict:
    try:
        bms = json.loads(u.bookmarks_json) if u.bookmarks_json else []
        if not isinstance(bms, list):
            bms = []
    except Exception:
        bms = []
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "avatar_url": u.avatar_url,
        "saved_input_type": u.saved_input_type or "percentile",
        "saved_score": u.saved_score,
        "saved_category": u.saved_category or "GOPENS",
        "bookmarks": bms[:60],
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
    }


def _lookup_email_entitlement(email: str, db: Session) -> Optional[dict]:
    """Auto-restore an approved Pro/VIP pass if the student bought using this Google email."""
    if not email:
        return None
    order = (
        db.query(PaymentOrder)
        .filter(
            func.lower(PaymentOrder.email) == email.lower(),
            PaymentOrder.status == "approved",
        )
        .order_by(desc(PaymentOrder.approved_at), desc(PaymentOrder.created_at))
        .first()
    )
    if not order:
        return None
    return {
        "plan": order.plan,
        "access_key": order.access_key,
        "entitlement_token": issue_entitlement_token(order.access_key, order.plan),
        "status": "approved",
        "full_name": (order.full_name or "").split()[0] if order.full_name else "Student",
        "utr_number": mask_utr(order.utr_number),
    }


def _require_user(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> UserAccount:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in with Google required.")
    payload = verify_user_token(authorization[7:].strip())
    if not payload:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    user = db.query(UserAccount).filter(UserAccount.id == payload.get("uid")).first()
    if not user:
        raise HTTPException(status_code=401, detail="Account not found.")
    return user


@app.get("/api/auth/config")
def get_auth_config():
    cid = get_google_client_id()
    return {
        "google_enabled": bool(cid),
        "google_client_id": cid or None,
    }


@app.post("/api/auth/google")
def login_with_google(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    cid = get_google_client_id()
    if not cid:
        raise HTTPException(
            status_code=503,
            detail="Google Sign-In is not configured on the server yet. Set GOOGLE_CLIENT_ID in Render/.env.",
        )

    info = _verify_google_id_token(req.credential.strip(), cid)
    sub = sanitize_text(info.get("sub"), max_len=128)
    email = sanitize_email(info.get("email"))
    if not sub or not email:
        raise HTTPException(status_code=401, detail="Incomplete Google account profile.")

    name = sanitize_text(info.get("name"), max_len=100) or email.split("@")[0]
    pic = str(info.get("picture") or "").strip()
    if pic and not pic.startswith("https://"):
        pic = None

    user = (
        db.query(UserAccount)
        .filter(or_(UserAccount.google_sub == sub, UserAccount.email == email))
        .first()
    )
    now = datetime.now(timezone.utc)
    if user:
        user.google_sub = sub
        user.email = email
        user.full_name = name
        if pic:
            user.avatar_url = pic
        user.last_login_at = now
    else:
        user = UserAccount(
            google_sub=sub,
            email=email,
            full_name=name,
            avatar_url=pic,
            last_login_at=now,
        )
        db.add(user)
    db.commit()
    db.refresh(user)

    token = issue_user_token(user.id, user.email)
    entitlement = _lookup_email_entitlement(user.email, db)
    return {
        "token": token,
        "token_type": "bearer",
        "user": _serialize_user(user),
        "entitlement": entitlement,
    }


@app.get("/api/auth/me")
def get_current_user_profile(
    user: UserAccount = Depends(_require_user),
    db: Session = Depends(get_db),
):
    return {
        "user": _serialize_user(user),
        "entitlement": _lookup_email_entitlement(user.email, db),
    }


@app.post("/api/auth/sync")
def sync_user_profile(
    req: ProfileSyncRequest,
    user: UserAccount = Depends(_require_user),
    db: Session = Depends(get_db),
):
    if req.saved_input_type in ("percentile", "rank"):
        user.saved_input_type = req.saved_input_type
    if req.saved_score is not None:
        user.saved_score = float(req.saved_score)
    if req.saved_category:
        user.saved_category = sanitize_text(req.saved_category.upper(), max_len=24) or "GOPENS"
    if req.bookmarks is not None:
        cleaned_bms = []
        for item in req.bookmarks[:60]:
            if not isinstance(item, dict):
                continue
            cleaned_bms.append(
                {
                    "key": sanitize_text(item.get("key"), max_len=140) or "",
                    "college_code": sanitize_text(item.get("college_code"), max_len=16) or "",
                    "college_name": sanitize_text(item.get("college_name"), max_len=180) or "",
                    "city": sanitize_text(item.get("city"), max_len=60) or "",
                    "branch": sanitize_text(item.get("branch"), max_len=120) or "",
                    "historical_percentile": item.get("historical_percentile"),
                    "historical_rank": item.get("historical_rank"),
                    "prediction_category": sanitize_text(item.get("prediction_category"), max_len=40),
                }
            )
        user.bookmarks_json = json.dumps(cleaned_bms)

    db.commit()
    db.refresh(user)
    return {"synced": True, "user": _serialize_user(user)}


# =============================================================================
# INTERACTIVE MAHARASHTRA ENGINEERING COLLEGE MAP API
# =============================================================================

_MAP_CATALOG_CACHE: Optional[List[dict]] = None


def _get_map_base_catalog(db: Session) -> List[dict]:
    global _MAP_CATALOG_CACHE
    if _MAP_CATALOG_CACHE is not None:
        return _MAP_CATALOG_CACHE

    minority_colleges, open_colleges = _get_college_sets(db)
    scale = get_rank_scale(db)

    # Aggregate colleges, branch counts, and highest recent GOPENS/Open benchmark cutoff
    rows = (
        db.query(
            CollegeRecord.college_code,
            CollegeRecord.college_name,
            CollegeRecord.city,
            CollegeRecord.branch_name,
            CollegeRecord.category,
            CollegeRecord.year,
            CollegeRecord.percentile,
            CollegeRecord.merit_rank,
        )
        .filter(CollegeRecord.percentile.isnot(None))
        .all()
    )

    by_code: dict[str, dict] = {}
    for code, name, city, br, cat, yr, pct, rnk in rows:
        if not code:
            continue
        entry = by_code.get(code)
        if entry is None:
            entry = {
                "college_code": code,
                "college_name": name,
                "city": city or "Maharashtra",
                "branches": set(),
                "best_open": None,  # (prio, -yr, -pct, branch, pct, rnk)
            }
            by_code[code] = entry
        if br:
            entry["branches"].add(br)

        # Prefer latest year GOPENS/GOPENH/LOPENS highest-demand branch as map headline benchmark
        cat_prio = 0 if cat == "GOPENS" else (1 if cat in ("GOPENH", "LOPENS", "TFWS") else 2)
        cand = (cat_prio, -(yr or 0), -(pct or 0.0), br, pct, rnk, yr)
        if entry["best_open"] is None or cand[:3] < entry["best_open"][:3]:
            entry["best_open"] = cand

    catalog: List[dict] = []
    for code, entry in sorted(by_code.items(), key=lambda kv: kv[1]["college_name"]):
        loc = get_college_location(code, entry["college_name"], entry["city"])
        links = get_college_links(code)
        ins = get_college_insights_summary(code)
        bo = entry["best_open"]
        top_pct = round(float(bo[4]), 2) if bo and bo[4] is not None else None
        top_rnk = (
            round(float(bo[5]))
            if bo and bo[5] is not None and bo[4] is not None and scale.is_consistent(bo[6], bo[4], bo[5])
            else (round(scale.pct_to_rank(scale.latest_year, top_pct)) if top_pct is not None else None)
        )
        catalog.append(
            {
                "college_code": code,
                "college_name": entry["college_name"],
                "city": entry["city"],
                "lat": loc["lat"],
                "lng": loc["lng"],
                "is_exact_campus": loc["is_exact_campus"],
                "google_maps_url": loc["google_maps_url"],
                "branches_count": len(entry["branches"]),
                "branches": sorted(entry["branches"]),
                "top_branch": bo[3] if bo else None,
                "top_cutoff_percentile": top_pct,
                "top_cutoff_rank": top_rnk,
                "top_cutoff_year": bo[6] if bo else None,
                "is_autonomous": code in open_colleges,
                "is_minority": code in minority_colleges,
                **links,
                **ins,
            }
        )

    _MAP_CATALOG_CACHE = catalog
    return catalog


@app.get("/api/map/colleges")
def get_map_colleges(
    city: Optional[str] = None,
    branch: Optional[str] = None,
    search: Optional[str] = None,
    percentile: Optional[float] = None,
    rank: Optional[float] = None,
    category: str = "GOPENS",
    insights_only: bool = False,
    db: Session = Depends(get_db),
):
    """
    Returns geographic pins for all 400 Maharashtra engineering colleges.
    When percentile or rank is supplied, switches into Score Match Map mode and
    tags every matching college with its live prediction band (Within Range / Moderate / Ambitious).
    """
    catalog = _get_map_base_catalog(db)
    score_mode = percentile is not None or rank is not None

    match_by_code: dict[str, dict] = {}
    student_info = None
    if score_mode:
        pred_res = predict_colleges(
            PredictionRequest(
                percentile=percentile,
                rank=rank,
                category=(category or "GOPENS").upper().strip(),
                branch=branch or None,
                city=city or None,
            ),
            db,
        )
        student_info = pred_res.get("student")
        band_prio = {"Historically Within Range": 0, "Moderate": 1, "Ambitious": 2}
        for p in pred_res.get("predictions", []):
            code = p["college_code"]
            cur = match_by_code.get(code)
            p_key = (
                band_prio.get(p["prediction_category"], 9),
                p.get("historical_rank") or 999999,
            )
            if cur is None or p_key < cur["_key"]:
                match_by_code[code] = {
                    "_key": p_key,
                    "prediction_category": p["prediction_category"],
                    "chance_level": p.get("chance_level"),
                    "matched_branch": p["branch"],
                    "matched_percentile": p.get("historical_percentile"),
                    "matched_rank": p.get("historical_rank"),
                    "margin_percentile": p.get("margin_percentile"),
                    "matched_year": p.get("year"),
                    "matched_round": p.get("round"),
                    "matched_courses_count": (cur["matched_courses_count"] + 1) if cur else 1,
                }
            else:
                cur["matched_courses_count"] += 1

    q = (search or "").strip().lower()
    out = []
    for item in catalog:
        if city and item["city"].lower() != city.strip().lower():
            continue
        if branch and branch not in item["branches"]:
            continue
        if insights_only and item.get("nirf_median_lpa") is None and item.get("annual_fee_inr") is None:
            continue
        if q:
            if (
                q not in item["college_name"].lower()
                and q not in item["college_code"].lower()
                and q not in item["city"].lower()
            ):
                continue

        # Exclude full branches list from bulk map payload to keep response super light (~95KB)
        row = {k: v for k, v in item.items() if k != "branches"}
        if score_mode:
            m = match_by_code.get(item["college_code"])
            if not m:
                continue
            row.update({k: v for k, v in m.items() if k != "_key"})
        out.append(row)

    summary = {
        "total": len(out),
        "exact_campus_count": sum(1 for r in out if r["is_exact_campus"]),
        "within_range": sum(1 for r in out if r.get("prediction_category") == "Historically Within Range"),
        "moderate": sum(1 for r in out if r.get("prediction_category") == "Moderate"),
        "ambitious": sum(1 for r in out if r.get("prediction_category") == "Ambitious"),
    }
    return {
        "score_mode": score_mode,
        "student": student_info,
        "summary": summary,
        "colleges": out,
    }
