import sqlite3

conn = sqlite3.connect('cap_compass.sqlite3')
count = conn.execute("SELECT COUNT(*) FROM college_records WHERE year=2025 AND round_number=1 AND branch_name = 'Computer Engineering'").fetchone()
print("Computer Engineering count in 2025 R1:", count)
count2 = conn.execute("SELECT COUNT(*) FROM college_records WHERE year=2025 AND round_number=1 AND category LIKE '%GOPEN%' AND branch_name = 'Computer Engineering'").fetchone()
print("Computer Engineering count in 2025 R1 GOPEN:", count2)
