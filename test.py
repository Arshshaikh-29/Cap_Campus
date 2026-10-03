import sqlite3
conn = sqlite3.connect('cap_compass.sqlite3')
cur = conn.cursor()
cur.execute("SELECT * FROM college_records WHERE year=2025 AND round_number=1 AND category LIKE '%GOPEN%' LIMIT 5;")
records = cur.fetchall()
for r in records:
    print(r)
print(len(records))
