from pathlib import Path
import re, sqlite3
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
DB_PATH = ROOT / "cap_compass.sqlite3"
app = FastAPI(title="CAP Compass API", version="2.0.0", description="Historical Maharashtra engineering CAP exploration and shortlist API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=False, allow_methods=["GET"], allow_headers=["*"])

def load_data():
    frames=[]
    for path in sorted(DATA_DIR.glob("*_CAP[123]*.csv")):
        try:
            df=pd.read_csv(path, low_memory=False)
            match=re.search(r"(20\d{2})_CAP([123])", path.name)
            if match:
                df["_year"]=int(match.group(1)); df["_round"]=int(match.group(2))
            frames.append(df)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Could not load {path.name}: {exc}")
    if not frames: raise HTTPException(status_code=503, detail=f"No CSV files found in {DATA_DIR}")
    return pd.concat(frames, ignore_index=True).where(pd.notna(pd.concat(frames, ignore_index=True)), None)

@app.on_event("startup")
def initialize_database():
    # SQLite cache provides a persistent local catalog; source CSVs remain the source of truth.
    df=load_data()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS dataset_info (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        conn.execute("INSERT OR REPLACE INTO dataset_info(key,value) VALUES('record_count',?)", (str(len(df)),))
        conn.execute("INSERT OR REPLACE INTO dataset_info(key,value) VALUES('source_files',?)", (", ".join(p.name for p in sorted(DATA_DIR.glob('*.csv'))),))

@app.get("/api/health")
def health():
    return {"status":"ok","service":"CAP Compass API","database":"sqlite cache initialized" if DB_PATH.exists() else "not initialized"}

@app.get("/api/meta")
def meta():
    df=load_data()
    cats=sorted({str(x) for x in df.get("category", pd.Series(dtype=str)).dropna().unique()})
    years=sorted({int(x) for x in df.get("_year", pd.Series(dtype=int)).dropna().unique()})
    rounds=sorted({int(x) for x in df.get("_round", pd.Series(dtype=int)).dropna().unique()})
    return {"dataset_files":[p.name for p in sorted(DATA_DIR.glob("*_CAP[123]*.csv"))],"count":len(df),"categories":cats,"years":years,"rounds":rounds}

@app.get("/api/records")
def records(year: int|None=None, round_number: int|None=Query(default=None, ge=1, le=3), category: str|None=None, limit: int=Query(default=100000, ge=1, le=150000)):
    df=load_data()
    if year is not None: df=df[df["_year"]==year]
    if round_number is not None: df=df[df["_round"]==round_number]
    if category: df=df[df["category"].astype(str).str.casefold()==category.casefold()]
    df=df.head(limit)
    return {"count":len(df),"records":df.to_dict(orient="records")}

@app.get("/api/recommendations")
def recommendations(rank: int=Query(gt=0), category: str|None=None, year: int|None=None, round_number: int|None=Query(default=None, ge=1, le=3), search: str|None=None, limit: int=Query(default=100, ge=1, le=500)):
    df=load_data()
    if category: df=df[df["category"].astype(str).str.casefold()==category.casefold()]
    if year is not None: df=df[df["_year"]==year]
    if round_number is not None: df=df[df["_round"]==round_number]
    if search:
        mask=pd.Series(False,index=df.index)
        for col in ["college_name","branch_name","college_code","choice_code"]:
            if col in df: mask |= df[col].astype(str).str.contains(search,case=False,na=False)
        df=df[mask]
    df["merit_rank"]=pd.to_numeric(df["merit_rank"],errors="coerce")
    cols=[c for c in ["college_code","college_name","choice_code","branch_name","category","quota_level","stage","merit_rank","percentile","_year","_round"] if c in df]
    df=df.dropna(subset=["merit_rank"]).sort_values("merit_rank",ascending=False).drop_duplicates([c for c in ["college_code","branch_name","category","_year","_round"] if c in df])
    result=df[cols].head(limit).copy(); result["rank_signal"]=result["merit_rank"].apply(lambda x:"within historical closing rank" if x>=rank else "beyond historical closing rank")
    return {"count":len(result),"rank_input":rank,"interpretation":"Historical comparison only; not an admission probability or allotment guarantee.","recommendations":result.to_dict(orient="records")}

@app.get("/api/trends")
def trends(category: str|None=None):
    df=load_data()
    if category: df=df[df["category"].astype(str).str.casefold()==category.casefold()]
    df["merit_rank"]=pd.to_numeric(df["merit_rank"],errors="coerce")
    grouped=df.dropna(subset=["merit_rank"]).groupby(["_year","_round"],as_index=False).agg(records=("merit_rank","size"),median_closing_rank=("merit_rank","median"))
    return {"trends":grouped.to_dict(orient="records")}

@app.get("/api/model/status")
def model_status():
    metrics_path=ROOT/"models"/"metrics.json"
    return {"trained_model_available":(ROOT/"models"/"cutoff_model.joblib").exists(),"metrics":__import__("json").loads(metrics_path.read_text()) if metrics_path.exists() else None}

@app.get("/api/predict-cutoff")
def predict_cutoff(college_code: str, branch_name: str, category: str, quota_level: str="", stage: str="", round_number: int=Query(default=3,ge=1,le=3), academic_year: int=2026):
    """Experimental point estimate of historical closing rank; never an admission chance."""
    import joblib
    artifact=ROOT/"models"/"cutoff_model.joblib"
    if not artifact.exists(): raise HTTPException(status_code=503,detail="Model not trained. Run: py scripts/train_cutoff_model.py")
    bundle=joblib.load(artifact)
    row={"college_code":college_code,"branch_name":branch_name,"category":category,"quota_level":quota_level,"stage":stage,"round_number":round_number,"academic_year":academic_year}
    features=bundle["features"]
    estimate=float(bundle["pipeline"].predict(pd.DataFrame([{k:row.get(k) for k in features}]))[0])
    return {"estimated_historical_closing_rank":max(1,round(estimate)),"model_task":"historical closing-rank regression","admission_probability":None,"warning":"Experimental estimate trained on 2023–2024 and evaluated on 2025. It is not a calibrated admission probability, official allotment result, or guarantee.","validation_metrics":bundle["metrics"]}


@app.get("/api/ml-recommendations")
def ml_recommendations(rank: int=Query(gt=0), category: str="GOPENS", branch: str="Computer Engineering", target_year: int=2026, city: str|None=None, limit: int=Query(default=5000, ge=1, le=10000)):
    """Rank college/branch options using trained cutoff regression plus observed history. Not admission probability."""
    import joblib
    artifact=ROOT/"models"/"cutoff_model.joblib"
    if not artifact.exists(): raise HTTPException(status_code=503, detail="Trained model missing. Run py scripts/train_cutoff_model.py")
    df=load_data()
    for col in ["merit_rank", "_year", "_round"]: df[col]=pd.to_numeric(df[col],errors="coerce")
    # OPEN is a UI-friendly alias for the actual Maharashtra CAP GOPENS seat category.
    category_alias={"OPEN":"GOPENS","GENERAL":"GOPENS"}
    wanted=category_alias.get(category.upper(),category.upper())
    df=df[df["category"].astype(str).str.upper()==wanted]
    def norm(x): return re.sub(r"[^a-z0-9]+","",str(x).lower())
    if city and city.strip().lower() not in {"all cities", "any city"}:
        # The bundled CSVs have no city/address field; city filtering uses institution-name text only.
        df=df[df["college_name"].astype(str).str.contains(re.escape(city.strip()), case=False, na=False)]
    if branch and branch.lower() not in {"any branch","all branches"}:
        exact=df["branch_name"].map(norm)==norm(branch)
        # Only exact matches are returned; related branches are not silently substituted.
        df=df[exact]
    if df.empty: return {"count":0,"rank_input":rank,"category":wanted,"branch":branch,"city":city or "All cities","recommendations":[],"warning":"No exact category/branch matches found in the bundled dataset."}
    keys=[c for c in ["college_code","choice_code","college_name","branch_name","category"] if c in df]
    latest=df.sort_values(["_year","_round"]).dropna(subset=["merit_rank"]).groupby(keys,as_index=False).tail(1).copy()
    bundle=joblib.load(artifact); features=bundle["features"]
    # Predict a next-cycle closing rank for each matching historical college/branch/category row.
    pred_input=latest.copy(); pred_input["previous_closing_rank"]=pred_input["merit_rank"].astype(float); pred_input["previous_year"]=pred_input["_year"].astype(int)
    pred_input["round_number"]=3
    feature_map={"college_code":"college_code","choice_code":"choice_code","college_name":"college_name","branch_name":"branch_name","category":"category","quota_level":"quota_level","stage":"stage","round_number":"round_number","previous_year":"previous_year","previous_closing_rank":"previous_closing_rank"}
    X=pd.DataFrame({f:(pred_input[feature_map[f]] if f in feature_map and feature_map[f] in pred_input else None) for f in features})
    estimates=bundle["pipeline"].predict(X)
    latest["predicted_closing_rank"]=[max(1,int(round(float(x)))) for x in estimates]
    latest["historical_closing_rank"]=latest["merit_rank"].astype(int)
    # Classification is anchored to observed latest cutoffs; ML forecast is shown separately
    # because temporal validation is not better than a simple last-year persistence baseline.
    latest["rank_difference"]=latest["historical_closing_rank"]-int(rank)
    def band(c): return "Safer" if c>=rank*1.30 else ("Target" if c>=rank else "Reach")
    latest["recommendation"]=latest["historical_closing_rank"].map(band)
    latest["fit_reason"]=latest["rank_difference"].apply(lambda d:"Predicted cutoff is beyond your rank" if d>=0 else "Predicted cutoff is more competitive than your rank")
    latest=latest.sort_values(["recommendation","rank_difference"],ascending=[True,False],key=lambda s:s.map({"Safer":0,"Target":1,"Reach":2}) if s.name=="recommendation" else s.abs())
    metrics=bundle.get("metrics",{})
    cols=[c for c in ["college_code","college_name","choice_code","branch_name","category","quota_level","stage","_year","_round","historical_closing_rank","predicted_closing_rank","rank_difference","recommendation","fit_reason"] if c in latest]
    out=latest[cols].copy().rename(columns={"_year":"latest_data_year","_round":"latest_data_round"})
    return {"count":len(out),"rank_input":rank,"category":wanted,"branch":branch,"city":city or "All cities","prediction_year":target_year,"model_task":"year-to-year historical closing-rank regression; recommendations anchored to latest observed cutoff","validation_metrics":metrics,"admission_probability":None,"quota_note":"Bundled records are labeled State Level; Home University eligibility cannot be verified from these files.","warning":"ML estimates are experimental. Validation error is material; use actual historical cutoffs and official seat matrix/rules. This is not an allotment guarantee.","recommendations":out.to_dict(orient="records")}
