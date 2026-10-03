"""Train a historical closing-rank regression baseline; not an admission probability model."""
from pathlib import Path
import re, json
import numpy as np
import pandas as pd
import joblib
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder
from sklearn.impute import SimpleImputer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

ROOT=Path(__file__).resolve().parents[1]
parts=[]
for path in sorted((ROOT/"data").glob("*.csv")):
    frame=pd.read_csv(path, low_memory=False)
    match=re.search(r"(20\d{2})_CAP([123])",path.name)
    if match:
        frame["academic_year"]=int(match.group(1)); frame["round_number"]=int(match.group(2))
    parts.append(frame)
if not parts: raise SystemExit("No CSV data found under data/")
df=pd.concat(parts,ignore_index=True)
df["merit_rank"]=pd.to_numeric(df["merit_rank"],errors="coerce")
df=df.dropna(subset=["merit_rank","academic_year"])
features=[c for c in ["college_code","branch_name","category","quota_level","stage","round_number","academic_year"] if c in df]
latest=int(df.academic_year.max()); train=df[df.academic_year<latest]; test=df[df.academic_year==latest]
if train.empty or test.empty: raise SystemExit("Need at least two years for temporal validation; refusing random-split performance claim.")
prep=ColumnTransformer([("categorical",Pipeline([("impute",SimpleImputer(strategy="most_frequent")),("encode",OrdinalEncoder(handle_unknown="use_encoded_value",unknown_value=-1))]),features)], remainder="drop")
model=Pipeline([("prep",prep),("regressor",HistGradientBoostingRegressor(max_iter=120,learning_rate=.08,max_leaf_nodes=31,l2_regularization=1.0,random_state=42))])
model.fit(train[features],train.merit_rank)
pred=model.predict(test[features])
metrics={"task":"historical closing-rank regression","not_a_probability":True,"train_years":sorted(int(x) for x in train.academic_year.unique()),"validation_year":latest,"n_train":int(len(train)),"n_test":int(len(test)),"MAE":float(mean_absolute_error(test.merit_rank,pred)),"RMSE":float(np.sqrt(mean_squared_error(test.merit_rank,pred))),"R2":float(r2_score(test.merit_rank,pred))}
(ROOT/"models").mkdir(exist_ok=True)
joblib.dump({"pipeline":model,"features":features,"metrics":metrics},ROOT/"models"/"cutoff_model.joblib")
(ROOT/"models"/"metrics.json").write_text(json.dumps(metrics,indent=2))
print(json.dumps(metrics,indent=2))
