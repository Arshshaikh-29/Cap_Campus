# CAP Compass 2.0 — AI-Powered Admission Predictor

A production-quality engineering college counselling and prediction platform for Maharashtra state admissions.

## Tech Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn-inspired UI, Recharts, Lucide Icons.
- **Backend:** Python FastAPI, SQLAlchemy, Pydantic.
- **Database:** SQLite (Stores 79k+ CAP counseling records securely, scalable to PostgreSQL).

## Features

1. **Prediction Wizard:** Enter your CET percentile and category to receive categorized college recommendations (Historically Within Range, Moderate, Ambitious).
2. **College Explorer:** Search and filter historical cutoffs by city, branch, and college name.
3. **Compare Colleges:** Side-by-side comparison of historical cutoffs for up to 4 selected colleges.
4. **Data Normalization Engine:** Fully automated data ingestion from CSV into a relational database schema.

## Installation & Setup (Windows)

### 1. Prerequisites
- Python 3.10+
- Node.js LTS (v18+)

### 2. Backend Setup
Open a terminal in the project root:

```powershell
# Install requirements
py -m pip install -r backend/requirements.txt
pytest backend/tests/test_api.py

# Ingest data into SQLite (Run this once to parse the CSVs and build the database)
py backend/scripts/ingest_csv.py

# Run the backend API server
py -m uvicorn backend.api.main:app --reload --host 127.0.0.1 --port 8000
```

### 3. Frontend Setup
Open a second terminal in the project root:

```powershell
cd frontend
npm install

# Start Next.js development server
npm run dev
```

### 4. Access Application
Open [http://localhost:3000](http://localhost:3000) in your web browser.

FastAPI Docs are available at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## Known Dataset Limitations
- The current dataset contains quotas marked generally as "State Level" rather than explicitly mapped Home University records in some CSVs.
- This application provides decision support based on historical cutoffs, it does not guarantee admission or official allotment. Ensure to cross-check with official CET Cell documents.
