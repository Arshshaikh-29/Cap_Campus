from pathlib import Path
import re
import numpy as np
import pandas as pd
import streamlit as st

st.set_page_config(page_title="CAP Compass | Admissions Intelligence", page_icon="🎓", layout="wide", initial_sidebar_state="expanded")
ROOT=Path(__file__).parent
DATA=ROOT/"data"

st.markdown("""<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap');
html, body, [class*="css"] {font-family:'DM Sans',sans-serif;}
[data-testid="stAppViewContainer"]{background:#f5f7fb;}
[data-testid="stSidebar"]{background:#101d33;border-right:1px solid #24334b;}
[data-testid="stSidebar"] *{color:#eaf1fb!important;}
[data-testid="stSidebar"] [data-testid="stSelectbox"] div[data-baseweb="select"]{background:#1d2d47;border-color:#3a4d68;}
.block-container{padding-top:1.6rem;padding-bottom:3rem;max-width:1500px;}
.hero{background:linear-gradient(115deg,#12233f 0%,#183e61 58%,#146b77 100%);padding:30px 34px;border-radius:22px;color:white;box-shadow:0 16px 38px rgba(16,36,65,.14);margin-bottom:22px;position:relative;overflow:hidden;}
.hero:after{content:'✦';position:absolute;right:42px;top:-30px;font-size:170px;color:rgba(255,255,255,.07);}
.eyebrow{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9de5e0;font-weight:700;}
.hero h1{font-family:Manrope,sans-serif;font-size:34px;font-weight:800;letter-spacing:-1px;margin:8px 0 5px;color:#fff;}
.hero p{color:#d5e5f4;margin:0;font-size:14px;max-width:760px;}
.section-kicker{color:#64748b;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:8px 0 4px;}
div[data-testid="stMetric"]{background:#fff;border:1px solid #e6ebf2;border-radius:16px;padding:16px 18px;box-shadow:0 5px 18px rgba(21,42,73,.035);}
div[data-testid="stMetricLabel"]{color:#64748b;font-size:12px;font-weight:600;} div[data-testid="stMetricValue"]{color:#152b48;font-family:Manrope,sans-serif;font-weight:800;}
.stTabs [data-baseweb="tab-list"]{gap:8px;background:#eaf0f6;padding:6px;border-radius:13px;}
.stTabs [data-baseweb="tab"]{border-radius:9px;padding:10px 16px;color:#52647c;font-weight:600;}
.stTabs [aria-selected="true"]{background:#fff;color:#163d60!important;box-shadow:0 2px 7px rgba(20,45,70,.08);}
[data-testid="stDataFrame"]{border:1px solid #e4eaf1;border-radius:12px;overflow:hidden;}
div.stButton>button,div.stDownloadButton>button{border-radius:10px;font-weight:700;border:1px solid #d8e2ed;}
.note{padding:13px 16px;border:1px solid #d9e8f0;background:#eff8fa;border-radius:12px;color:#31566c;font-size:13px;}
</style>""",unsafe_allow_html=True)

@st.cache_data(show_spinner="Loading historical CAP datasets…")
def load_data():
    frames=[]
    for file in sorted(DATA.glob("*.csv")):
        try:
            d=pd.read_csv(file,low_memory=False)
            m=re.search(r'(20\d{2})_CAP([123])',file.name)
            if m:
                d["academic_year"]=int(m.group(1)); d["round_number"]=int(m.group(2))
            d["source_file"]=file.name
            frames.append(d)
        except Exception as e:
            st.warning(f"Could not read {file.name}: {e}")
    return pd.concat(frames,ignore_index=True) if frames else pd.DataFrame()

df=load_data()
st.markdown('''<div class="hero"><div class="eyebrow">Maharashtra • Engineering Admissions</div><h1>CAP Compass</h1><p>Admissions intelligence for exploring historical cutoffs, comparing college–branch options, and preparing a structured preference-list draft.</p></div>''',unsafe_allow_html=True)
if df.empty:
    st.error("No CSV datasets found. Place the CAP CSV files inside the project's data/ folder."); st.stop()

# normalize expected fields while retaining original columns
aliases={"college_name":["college_name","institute_name","institute","college"],"branch_name":["branch_name","course_name","branch","course"],"merit_rank":["merit_rank","rank","closing_rank","cutoff_rank"],"category":["category","seat_category","reservation_category"]}
for target,candidates in aliases.items():
    if target not in df:
        source=next((c for c in candidates if c in df.columns),None)
        if source: df[target]=df[source]
for c in ["merit_rank","percentile","academic_year","round_number"]:
    if c in df: df[c]=pd.to_numeric(df[c],errors="coerce")
for c in ["college_name","branch_name","category"]:
    if c not in df: df[c]="Not available"
if "college_code" not in df: df["college_code"]=""
if "choice_code" not in df: df["choice_code"]=""
if "quota_level" not in df: df["quota_level"]="All / unspecified"

with st.sidebar:
    st.markdown("### 🎓 Candidate workspace")
    st.caption("Set your profile and narrow the historical comparison.")
    rank=st.number_input("MHT-CET merit rank",min_value=1,value=25000,step=100)
    cats=sorted(df.category.dropna().astype(str).unique())
    default_cat=cats.index("GOPENS") if "GOPENS" in cats else 0
    category=st.selectbox("Seat category",["All categories"]+cats,index=default_cat+1 if cats else 0)
    quotas=sorted(df.quota_level.dropna().astype(str).unique())
    quota=st.selectbox("Quota / seat level",["All"]+quotas)
    years=sorted(df.academic_year.dropna().astype(int).unique()) if "academic_year" in df else []
    selected_years=st.multiselect("Admission years",years,default=years)
    rounds=sorted(df.round_number.dropna().astype(int).unique()) if "round_number" in df else []
    selected_rounds=st.multiselect("CAP rounds",rounds,default=rounds)
    with st.expander("Additional filters"):
        districts=sorted(df.district.dropna().astype(str).unique()) if "district" in df else []
        selected_districts=st.multiselect("District",districts)
        branch_options=sorted(df.branch_name.dropna().astype(str).unique())
        selected_branches=st.multiselect("Branches",branch_options)
        college_options=sorted(df.college_name.dropna().astype(str).unique())
        selected_colleges=st.multiselect("Colleges",college_options)
    st.divider()
    st.caption("CAP Compass • Decision-support prototype")

f=df.copy()
if category!="All categories": f=f[f.category.astype(str)==category]
if quota!="All": f=f[f.quota_level.astype(str)==quota]
if selected_years and "academic_year" in f: f=f[f.academic_year.isin(selected_years)]
if selected_rounds and "round_number" in f: f=f[f.round_number.isin(selected_rounds)]
if selected_districts and "district" in f: f=f[f.district.astype(str).isin(selected_districts)]
if selected_branches: f=f[f.branch_name.astype(str).isin(selected_branches)]
if selected_colleges: f=f[f.college_name.astype(str).isin(selected_colleges)]
f=f.dropna(subset=["merit_rank"])
if f.empty:
    st.warning("No records match the current profile. Try widening the filters."); st.stop()
keys=[c for c in ["college_code","college_name","choice_code","branch_name","category","quota_level","stage"] if c in f]
g=f.groupby(keys,dropna=False).agg(median_cutoff=("merit_rank","median"),historical_max=("merit_rank","max"),historical_min=("merit_rank","min"),observations=("merit_rank","count"),years_seen=("academic_year","nunique") if "academic_year" in f else ("merit_rank","count")).reset_index()
g["rank_gap"]=g["median_cutoff"]-rank
g["band"]=np.select([rank<=g.median_cutoff*.75,rank<=g.median_cutoff,rank<=g.median_cutoff*1.25],["Safer historical range","Target historical range","Reach / borderline"],default="Reach / ambitious")
g["fit_score"]=np.clip(50+50*(g.median_cutoff-rank)/np.maximum(g.median_cutoff,1),0,100).round(1)
g=g.sort_values(["fit_score","observations"],ascending=False)

st.markdown('<div class="section-kicker">Overview</div>',unsafe_allow_html=True)
a,b,c,d=st.columns(4)
a.metric("Historical records",f"{len(f):,}",help="Rows remaining after selected filters")
b.metric("College–branch options",f"{len(g):,}")
c.metric("Years represented",str(f.academic_year.nunique()) if "academic_year" in f else "—")
d.metric("Rank entered",f"{rank:,}")
st.markdown('<div class="note">Historical range labels compare your entered rank with observed closing-rank distributions. They are not calibrated admission probabilities, eligibility checks, or allotment guarantees.</div>',unsafe_allow_html=True)

t1,t2,t3,t4=st.tabs(["✦ Recommendations","↗ Cutoff analytics","▤ Dataset & methodology","⇩ Export workspace"])
with t1:
    st.subheader("Your college–branch shortlist")
    st.caption("Use the bands as a starting point; verify official seat type, eligibility, and current-year rules before finalizing choices.")
    band=st.radio("View shortlist",["All bands","Safer historical range","Target historical range","Reach / borderline","Reach / ambitious"],horizontal=True)
    view=g if band=="All bands" else g[g.band==band]
    showcols=[c for c in ["college_name","branch_name","category","quota_level","median_cutoff","historical_max","historical_min","observations","years_seen","band","fit_score"] if c in view]
    st.dataframe(view[showcols].head(300),use_container_width=True,hide_index=True,height=440,
        column_config={"median_cutoff":st.column_config.NumberColumn("Median closing rank",format="%d"),"historical_max":st.column_config.NumberColumn("Largest observed rank",format="%d"),"historical_min":st.column_config.NumberColumn("Smallest observed rank",format="%d"),"fit_score":st.column_config.ProgressColumn("Relative fit index",min_value=0,max_value=100,format="%.0f")})
    st.caption(f"Showing {min(len(view),300):,} of {len(view):,} matching options.")
with t2:
    st.subheader("Historical closing-rank movement")
    trend=f.groupby(["academic_year","round_number"]).merit_rank.median().reset_index().sort_values(["academic_year","round_number"]) if {"academic_year","round_number"}.issubset(f.columns) else pd.DataFrame()
    if not trend.empty:
        chart=trend.pivot(index="academic_year",columns="round_number",values="merit_rank")
        st.line_chart(chart, use_container_width=True)
        st.dataframe(trend.rename(columns={"academic_year":"Year","round_number":"CAP round","merit_rank":"Median observed rank"}),use_container_width=True,hide_index=True)
    else: st.info("Year and round fields are required for the trend chart.")
    st.markdown("**Interpretation:** a larger closing-rank number indicates that an option historically reached a candidate with a numerically larger rank. Year-to-year seat matrices and applicant preferences can change outcomes.")
with t3:
    st.subheader("Data coverage and quality")
    st.write(f"Loaded **{len(list(DATA.glob('*.csv')))}** bundled CSV files and **{len(df):,}** records.")
    if "source_file" in df: st.dataframe(df.source_file.value_counts().rename_axis("Source file").reset_index(name="Rows"),use_container_width=True,hide_index=True)
    quality=pd.DataFrame({"Field":df.columns,"Missing values":df.isna().sum().values,"Data type":df.dtypes.astype(str).values})
    st.dataframe(quality,use_container_width=True,hide_index=True)
    st.info("Method: historical cutoff aggregation by available college, branch, category, quota, and stage keys. Relative fit index is a transparent rank-gap heuristic. No supervised admission outcome model or calibrated probability is claimed.")
with t4:
    st.subheader("Export your working files")
    st.download_button("↓ Download filtered CAP records",f.to_csv(index=False).encode("utf-8-sig"),"filtered_cap_records.csv","text/csv",use_container_width=True)
    st.download_button("↓ Download shortlist",g.to_csv(index=False).encode("utf-8-sig"),"cap_compass_shortlist.csv","text/csv",use_container_width=True)
    choice_cols=[c for c in ["college_code","college_name","choice_code","branch_name","category","quota_level","band"] if c in g]
    draft=g[choice_cols].drop_duplicates().copy(); draft.insert(0,"preference_order",range(1,len(draft)+1))
    st.download_button("↓ Download preference-list draft",draft.to_csv(index=False).encode("utf-8-sig"),"preference_list_draft.csv","text/csv",use_container_width=True)
    st.caption("The exported list is a planning draft, not an official CAP submission file.")

st.divider()
st.caption("CAP Compass • Historical-data decision support • Verify all admission decisions against the current official Maharashtra CAP brochure and portal.")
