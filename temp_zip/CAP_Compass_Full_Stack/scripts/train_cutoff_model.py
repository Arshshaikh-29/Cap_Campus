"""Train year-to-year cutoff ML model. Predicts closing rank, never admission probability."""
from pathlib import Path
import re, json
import numpy as np
import pandas as pd
import joblib
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

ROOT=Path(__file__).resolve().parents[1]
parts=[]
for path in sorted((ROOT/"data").glob("*.csv")):
    frame=pd.read_csv(path,low_memory=False)
    m=re.search(r"(20\d{2})_CAP([123])",path.name)
    if m: frame["academic_year"]=int(m.group(1)); frame["round_number"]=int(m.group(2))
    parts.append(frame)
if not parts: raise SystemExit("No CSV data found under data/")
df=pd.concat(parts,ignore_index=True)
df["merit_rank"]=pd.to_numeric(df["merit_rank"],errors="coerce")
df=df.dropna(subset=["merit_rank","academic_year"])
# A cutoff is the largest admitted merit number recorded for an exact choice/category/stage/round/year.
keys=[c for c in ["college_code","choice_code","college_name","branch_name","category","quota_level","stage","round_number","academic_year"] if c in df]
annual=df.groupby(keys,dropna=False,as_index=False).agg(closing_rank=("merit_rank","max"))
identity=[c for c in ["college_code","choice_code","college_name","branch_name","category","quota_level","stage","round_number"] if c in annual]
features=[c for c in ["previous_closing_rank","college_code","choice_code","branch_name","category","quota_level","stage","round_number","previous_year"] if c in ["previous_closing_rank",*identity,"previous_year"]]
pairs=[]
for key, g in annual.groupby(identity,dropna=False):
    g=g.sort_values("academic_year")
    records=g.to_dict("records")
    for prev, nxt in zip(records,records[1:]):
        if int(nxt["academic_year"])-int(prev["academic_year"]) != 1: continue
        row={c:prev.get(c) for c in identity}
        row.update(previous_closing_rank=float(prev["closing_rank"]),previous_year=int(prev["academic_year"]),target_year=int(nxt["academic_year"]),target_closing_rank=float(nxt["closing_rank"]))
        pairs.append(row)
pairs=pd.DataFrame(pairs)
if pairs.empty: raise SystemExit("No consecutive year-to-year college/category cutoff pairs found")
cat=[c for c in features if c not in ["previous_closing_rank","previous_year","round_number"]]
num=[c for c in ["previous_closing_rank","previous_year","round_number"] if c in features]
prep=ColumnTransformer([("cat",Pipeline([("impute",SimpleImputer(strategy="most_frequent")),("encode",OrdinalEncoder(handle_unknown="use_encoded_value",unknown_value=-1))]),cat),("num",Pipeline([("impute",SimpleImputer(strategy="median"))]),num)])
model=Pipeline([("prep",prep),("regressor",HistGradientBoostingRegressor(max_iter=150,learning_rate=.06,max_leaf_nodes=20,l2_regularization=3.0,random_state=42))])
latest=int(pairs.target_year.max())
train=pairs[pairs.target_year<latest]; test=pairs[pairs.target_year==latest]
if train.empty or test.empty: raise SystemExit("Need two transitions for temporal validation")
model.fit(train[features],train.target_closing_rank)
pred=np.maximum(1,model.predict(test[features]))
mae=float(mean_absolute_error(test.target_closing_rank,pred)); persistence=float(mean_absolute_error(test.target_closing_rank,test.previous_closing_rank))
metrics={"task":"next-year historical closing-rank regression","not_a_probability":True,"training_transitions":sorted(int(x) for x in train.target_year.unique()),"validation_year":latest,"n_train":int(len(train)),"n_test":int(len(test)),"MAE":mae,"persistence_baseline_MAE":persistence,"RMSE":float(np.sqrt(mean_squared_error(test.target_closing_rank,pred))),"R2":float(r2_score(test.target_closing_rank,pred)),"interpretation":"Experimental cutoff estimate; compare MAE to persistence baseline. Not an admission probability."}
# Refit on all observed consecutive-year transitions for deployment.
model.fit(pairs[features],pairs.target_closing_rank)
(ROOT/"models").mkdir(exist_ok=True)
joblib.dump({"pipeline":model,"features":features,"metrics":metrics,"model_version":"year_to_year_cutoff_v2"},ROOT/"models"/"cutoff_model.joblib")
(ROOT/"models"/"metrics.json").write_text(json.dumps(metrics,indent=2))
print(json.dumps(metrics,indent=2))
