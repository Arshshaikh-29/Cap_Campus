import math
import re
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc, or_
from pydantic import BaseModel
from .database import engine, Base, get_db
from .models import CollegeRecord

app = FastAPI(title="CAP Compass API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas
class PredictionRequest(BaseModel):
    percentile: Optional[float] = None
    rank: Optional[float] = None
    category: str
    branch: Optional[str] = None
    city: Optional[str] = None

class ComparisonRequest(BaseModel):
    college_codes: List[str]
    category: str
    round_number: Optional[int] = 3
    year: Optional[int] = 2025

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "CAP Compass API"}

@app.get("/api/filters")
def get_filters(db: Session = Depends(get_db)):
    cities = [r[0] for r in db.query(CollegeRecord.city).distinct().filter(CollegeRecord.city != "Unknown", CollegeRecord.city.isnot(None)).all()]
    branches = [r[0] for r in db.query(CollegeRecord.branch_name).distinct().filter(CollegeRecord.branch_name.isnot(None)).all()]
    categories = [r[0] for r in db.query(CollegeRecord.category).distinct().filter(CollegeRecord.category.isnot(None)).all()]
    
    return {
        "cities": sorted(cities),
        "branches": sorted(branches),
        "categories": sorted(categories)
    }

@app.get("/api/colleges")
def search_colleges(
    search: str = None,
    city: str = None,
    branch: str = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(CollegeRecord.college_code, CollegeRecord.college_name, CollegeRecord.city).distinct()
    
    if search:
        query = query.filter(CollegeRecord.college_name.ilike(f"%{search}%"))
    if city:
        query = query.filter(CollegeRecord.city == city)
    if branch:
        query = query.filter(CollegeRecord.branch_name == branch)
        
    total = query.count()
    colleges = query.order_by(CollegeRecord.college_name).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "results": [{"college_code": c[0], "college_name": c[1], "city": c[2]} for c in colleges]
    }

@app.get("/api/colleges/{college_code}")
def get_college_details(college_code: str, db: Session = Depends(get_db)):
    college = db.query(CollegeRecord).filter(CollegeRecord.college_code == college_code).first()
    if not college:
        raise HTTPException(status_code=404, detail="College not found")
        
    # Get branches and recent cutoffs
    records = db.query(CollegeRecord).filter(CollegeRecord.college_code == college_code).order_by(desc(CollegeRecord.year), desc(CollegeRecord.round_number)).all()
    
    branches = list(set([r.branch_name for r in records]))
    
    return {
        "college_code": college.college_code,
        "college_name": college.college_name,
        "city": college.city,
        "branches": branches,
        "recent_cutoffs": records[:100] # limiting to avoid massive payload
    }

_CAT_RE = re.compile(r'^(PWDR|DEFR|PWD|DEF|G|L)(OPEN|OBC|SEBC|SC|ST|VJ|NT1|NT2|NT3)[SHO]?$')


def _family(base: str) -> List[str]:
    """All seat-type variants (State / Home / Other university) of a base category."""
    return [f"{base}S", f"{base}H", f"{base}O"]


def build_category_chain(category: str) -> List[List[str]]:
    """
    Ordered list of category groups to look up for a student.

    The dataset only contains the State Level part of the CAP cutoff lists, so many
    courses have no row for the student's exact seat type. We fall back, in order, to
    seat types the student is genuinely eligible for or that are a conservative proxy:
      1. exact seat type (any of S/H/O)
      2. same caste, general (non-ladies / non-DEF / non-PWD) seats
      3. general OPEN seats (every candidate can compete for these)
      4. TFWS – its cutoff is usually at or above the open cutoff, so it is a safe estimate
    """
    cat = (category or "").upper().strip()
    chain: List[List[str]] = []

    def add(group: List[str]):
        group = [g for g in group if not any(g in existing for existing in chain)]
        if group:
            chain.append(group)

    m = _CAT_RE.match(cat)
    if m:
        prefix, caste = m.groups()
        add(_family(f"{prefix}{caste}"))
        if prefix != "G":
            add(_family(f"G{caste}"))
        if prefix == "L" and caste != "OPEN":
            add(_family("LOPEN"))
        if caste != "OPEN":
            add(_family("GOPEN"))
    else:
        # EWS, TFWS, MI, ORPHAN and any other special category
        add([cat])
        add(_family("GOPEN"))

    add(["TFWS"])
    return chain


def _classify_percentile(student: float, cutoff: float):
    margin = student - cutoff
    if margin >= 0:
        return margin, "Historically Within Range"
    if margin >= -3.0:
        return margin, "Moderate"
    if margin >= -8.0:
        return margin, "Ambitious"
    return margin, None


def _classify_rank(student: float, cutoff: float):
    margin = cutoff - student  # positive = student rank is better than cutoff
    if margin >= 0:
        return margin, "Historically Within Range"
    if student <= cutoff * 1.25:
        return margin, "Moderate"
    if student <= cutoff * 1.6:
        return margin, "Ambitious"
    return margin, None


@app.post("/api/predict")
def predict_colleges(req: PredictionRequest, db: Session = Depends(get_db)):
    if req.percentile is None and req.rank is None:
        raise HTTPException(status_code=400, detail="Must provide either percentile or rank")

    use_percentile = req.percentile is not None
    chain = build_category_chain(req.category)
    priority = {cat: i for i, group in enumerate(chain) for cat in group}
    requested_family = set(chain[0]) if chain else set()

    query = db.query(
        CollegeRecord.choice_code, CollegeRecord.college_code, CollegeRecord.college_name,
        CollegeRecord.city, CollegeRecord.branch_name, CollegeRecord.category,
        CollegeRecord.percentile, CollegeRecord.merit_rank,
        CollegeRecord.year, CollegeRecord.round_number,
    ).filter(CollegeRecord.category.in_(list(priority.keys())))

    if use_percentile:
        query = query.filter(CollegeRecord.percentile.isnot(None))
    else:
        query = query.filter(CollegeRecord.merit_rank.isnot(None))
    if req.branch:
        query = query.filter(CollegeRecord.branch_name == req.branch)
    if req.city:
        # Some colleges have city "Unknown" in the source data; match on the name too.
        query = query.filter(or_(
            CollegeRecord.city == req.city,
            CollegeRecord.college_name.ilike(f"%{req.city}%"),
        ))

    # For every course (choice code) keep the best row:
    #   most relevant category -> latest year -> final closing cutoff across rounds
    best = {}
    for r in query.all():
        key = r.choice_code or f"{r.college_code}|{r.branch_name}"
        # closing cutoff = lowest percentile / highest rank admitted in any round
        closing = r.percentile if use_percentile else -r.merit_rank
        rank_key = (priority[r.category], -r.year, closing)
        if key not in best or rank_key < best[key][0]:
            best[key] = (rank_key, r)

    candidates = []
    for _, r in best.values():
        if use_percentile:
            margin, label = _classify_percentile(req.percentile, r.percentile)
        else:
            margin, label = _classify_rank(req.rank, r.merit_rank)
        candidates.append((margin, label, r))

    def to_dict(margin, label, r):
        return {
            "college_code": r.college_code,
            "college_name": r.college_name,
            "city": r.city,
            "branch": r.branch_name,
            "historical_percentile": r.percentile,
            "historical_rank": r.merit_rank,
            "student_percentile": req.percentile,
            "student_rank": req.rank,
            "margin": margin,
            "prediction_category": label,
            "basis_category": r.category,
            "is_estimate": r.category not in requested_family,
            "year": r.year,
            "round": r.round_number,
        }

    results = [to_dict(m, l, r) for m, l, r in candidates if l]
    fallback_used = False
    if not results and candidates:
        # Nothing within reach: show the closest options instead of an empty page.
        fallback_used = True
        nearest = sorted(candidates, key=lambda c: -c[0])[:25]
        results = [to_dict(m, "Ambitious", r) for m, _, r in nearest]

    if use_percentile:
        results.sort(key=lambda x: x["historical_percentile"] or 0, reverse=True)
    else:
        results.sort(key=lambda x: x["historical_rank"] or float("inf"))

    return {
        "count": len(results),
        "fallback_used": fallback_used,
        "categories_considered": [c for group in chain for c in group],
        "predictions": results,
    }

@app.post("/api/compare")
def compare_colleges(req: ComparisonRequest, db: Session = Depends(get_db)):
    if len(req.college_codes) > 4:
        raise HTTPException(status_code=400, detail="Can compare at most 4 colleges")
        
    records = db.query(CollegeRecord).filter(
        CollegeRecord.college_code.in_(req.college_codes),
        CollegeRecord.category == req.category,
        CollegeRecord.year == req.year,
        CollegeRecord.round_number == req.round_number
    ).all()
    
    return {"comparison": records}

@app.get("/api/analytics/options")
def get_analytics_options(college_code: str, db: Session = Depends(get_db)):
    """Branches recorded for a college with the categories available for each."""
    college = db.query(CollegeRecord).filter(CollegeRecord.college_code == college_code).first()
    if not college:
        raise HTTPException(status_code=404, detail="College not found")

    rows = db.query(
        CollegeRecord.branch_name, CollegeRecord.category, func.count(CollegeRecord.id)
    ).filter(CollegeRecord.college_code == college_code).group_by(
        CollegeRecord.branch_name, CollegeRecord.category
    ).all()

    branches = {}
    for branch_name, cat, n in rows:
        b = branches.setdefault(branch_name, {"name": branch_name, "records": 0, "categories": []})
        b["records"] += n
        b["categories"].append(cat)
    for b in branches.values():
        b["categories"].sort()

    return {
        "college_code": college.college_code,
        "college_name": college.college_name,
        "city": college.city,
        "branches": sorted(branches.values(), key=lambda b: -b["records"]),
    }


def _closing_cells(rows):
    """Closing cutoff per (category, year, round): lowest percentile / highest rank admitted."""
    cells = {}
    for r in rows:
        c = cells.setdefault((r.category, r.year, r.round_number), {"percentile": None, "merit_rank": None})
        if r.percentile is not None:
            c["percentile"] = r.percentile if c["percentile"] is None else min(c["percentile"], r.percentile)
        if r.merit_rank is not None:
            c["merit_rank"] = r.merit_rank if c["merit_rank"] is None else max(c["merit_rank"], r.merit_rank)
    return cells


def _final_round(cells, category, year):
    """Cell of the last available round for a category in a year."""
    rounds = sorted(rn for (cat, y, rn) in cells if cat == category and y == year)
    return (rounds[-1], cells[(category, year, rounds[-1])]) if rounds else (None, None)


@app.get("/api/analytics/cutoffs")
def get_cutoff_analytics(college_code: str, branch: str, category: str = "GOPENS", db: Session = Depends(get_db)):
    requested = (category or "GOPENS").upper().strip()
    chain = build_category_chain(requested)

    rows = db.query(CollegeRecord).filter(
        CollegeRecord.college_code == college_code,
        CollegeRecord.branch_name == branch,
    ).all()
    cells = _closing_cells(rows)
    available = {}
    for (cat, _, _) in cells:
        available[cat] = available.get(cat, 0) + 1

    # Resolve which category's history to show per year to prevent dropping data
    # when category codes change (e.g., from Home University to State Level).
    yr_cells = {}
    for (cat, y, rn), vals in cells.items():
        yr_cells.setdefault((y, rn), {})[cat] = vals

    trends = []
    for (y, rn) in sorted(yr_cells.keys()):
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
                elif best_cat is None or available.get(c, 0) > available.get(best_cat, 0):
                    best_cat = c
                    
        if best_cat is None:
            best_cat = max(cats_in_yr.keys(), key=lambda c: available.get(c, 0))

        trends.append({
            "category": best_cat,
            "year": y,
            "round_number": rn,
            **cats_in_yr[best_cat]
        })

    if trends:
        freq = {}
        for t in trends:
            freq[t["category"]] = freq.get(t["category"], 0) + 1
        basis = max(freq.keys(), key=lambda c: (freq[c], c == trends[-1]["category"]))
    else:
        basis = None

    # ---- Summary statistics -------------------------------------------------
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
            return round(a[key] - b[key], 4) if a and b and a.get(key) is not None and b.get(key) is not None else None

        yoy_pct = delta(latest, prev, "percentile")
        yoy_rank = delta(latest, prev, "merit_rank")
        latest_rounds = [t for t in trends if t["year"] == latest_year]
        first_round = latest_rounds[0] if latest_rounds else None
        round_drop_pct = (
            delta(first_round, latest, "percentile")
            if first_round and first_round["round_number"] != latest["round_number"] else None
        )

        final_pcts = [finals[y]["percentile"] for y in years if finals[y]["percentile"] is not None]
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

    # ---- All categories for this course (latest year, final round) ----------
    category_comparison = []
    if cells:
        latest_year_all = max(y for (_, y, _) in cells)
        for cat in available:
            rn, cell = _final_round(cells, cat, latest_year_all)
            if cell and cell["percentile"] is not None:
                category_comparison.append({"category": cat, "round_number": rn, "year": latest_year_all, **cell})
        category_comparison.sort(key=lambda c: -c["percentile"])

    # ---- Every branch of this college, same category logic -------------------
    branch_comparison = []
    priority = {cat: i for i, group in enumerate(chain) for cat in group}
    college_rows = db.query(
        CollegeRecord.branch_name, CollegeRecord.category, CollegeRecord.year,
        CollegeRecord.round_number, CollegeRecord.percentile, CollegeRecord.merit_rank,
    ).filter(
        CollegeRecord.college_code == college_code,
        CollegeRecord.category.in_(list(priority.keys())),
        CollegeRecord.percentile.isnot(None),
    ).all()
    best = {}
    for r in college_rows:
        # most relevant category -> latest year -> latest round -> lowest closing percentile
        key = (priority[r.category], -r.year, -r.round_number, r.percentile)
        if r.branch_name not in best or key < best[r.branch_name][0]:
            best[r.branch_name] = (key, r)
    for _, r in best.values():
        branch_comparison.append({
            "branch": r.branch_name, "category": r.category, "year": r.year,
            "round_number": r.round_number, "percentile": r.percentile, "merit_rank": r.merit_rank,
        })
    branch_comparison.sort(key=lambda b: -b["percentile"])

    return {
        "college_code": college_code,
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
