import os
import sys
from pathlib import Path
import pandas as pd
import re

ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(ROOT))

from backend.api.database import engine, Base, SessionLocal
from backend.api.models import CollegeRecord

def extract_city(college_name):
    if not isinstance(college_name, str):
        return "Unknown"
    
    # Often formatted as "Name, City" or "Name,City"
    parts = college_name.split(',')
    if len(parts) > 1:
        city = parts[-1].strip()
        # Some cleanup
        city = re.sub(r'[^a-zA-Z\s]', '', city).strip()
        if city:
            return city.title()
    
    # Try looking for " at "
    if " at " in college_name.lower():
        city = college_name.lower().split(" at ")[-1].strip()
        city = re.sub(r'[^a-zA-Z\s]', '', city).strip()
        if city:
            return city.title()

    return "Unknown"

def main():
    print("Initializing database...")
    Base.metadata.create_all(bind=engine)
    
    DATA_DIR = ROOT / "data"
    
    db = SessionLocal()
    
    try:
        # Check if data already exists to avoid duplicate ingestion
        existing = db.query(CollegeRecord).first()
        if existing:
            print("Database already contains records. Clearing existing records...")
            db.query(CollegeRecord).delete()
            db.commit()

        total_records = 0
        for path in sorted(DATA_DIR.glob("*_CAP[123]*.csv")):
            print(f"Processing {path.name}...")
            match = re.search(r"(20\d{2})_CAP([123])", path.name)
            year = int(match.group(1)) if match else 2023
            round_num = int(match.group(2)) if match else 1
            
            df = pd.read_csv(path, low_memory=False)
            df = df.where(pd.notna(df), None)
            
            records_to_insert = []
            for _, row in df.iterrows():
                # Extract city
                college_name = str(row.get('college_name', ''))
                city = extract_city(college_name)
                
                # Parse numeric values safely
                merit_rank = row.get('merit_rank')
                if pd.isna(merit_rank): merit_rank = None
                else: 
                    try: merit_rank = float(merit_rank)
                    except: merit_rank = None
                
                percentile = row.get('percentile')
                if pd.isna(percentile): percentile = None
                else: 
                    try: percentile = float(percentile)
                    except: percentile = None

                record = CollegeRecord(
                    college_code=str(row.get('college_code', '')),
                    college_name=college_name,
                    city=city,
                    choice_code=str(row.get('choice_code', '')),
                    branch_name=str(row.get('branch_name', '')),
                    quota_level=str(row.get('quota_level', '')),
                    stage=str(row.get('stage', '')),
                    category=str(row.get('category', '')),
                    merit_rank=merit_rank,
                    percentile=percentile,
                    year=year,
                    round_number=round_num
                )
                records_to_insert.append(record)
            
            # Batch insert
            db.bulk_save_objects(records_to_insert)
            db.commit()
            total_records += len(records_to_insert)
            print(f"Inserted {len(records_to_insert)} records from {path.name}")
            
        print(f"Ingestion complete. Total records: {total_records}")
    
    except Exception as e:
        print(f"Error during ingestion: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
