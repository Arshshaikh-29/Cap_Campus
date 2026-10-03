import sqlite3
import re

req_category = 'GOPENS'
req_percentile = 90.0
req_rank = None

base_cat = re.sub(r'[HOS]$', '', req_category)
print(f"base_cat: {base_cat}")

conn = sqlite3.connect('cap_compass.sqlite3')
cur = conn.cursor()

# Query
query = f"SELECT college_code, college_name, branch_name, category, merit_rank, percentile FROM college_records WHERE year=2025 AND round_number=1 AND category LIKE '%{base_cat}%'"
cur.execute(query)
records = cur.fetchall()

print(f"Total records from query: {len(records)}")

results = []
for r in records:
    r_rank = r[4]
    r_perc = r[5]
    
    margin = None
    category_prediction = None
    
    if req_percentile is not None and r_perc is not None:
        margin = req_percentile - r_perc
        if margin >= 0:
            category_prediction = "Historically Within Range"
        elif margin >= -2.0:
            category_prediction = "Moderate"
        elif margin >= -5.0:
            category_prediction = "Ambitious"
            
    if category_prediction:
        results.append({
            "college": r[1],
            "branch": r[2],
            "cutoff": r_perc,
            "margin": margin,
            "pred": category_prediction
        })

print(f"Results after prediction logic: {len(results)}")
