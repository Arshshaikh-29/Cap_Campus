# CAP Compass — Integrated Full-Stack Project

A local full-stack prototype for exploring historical Maharashtra engineering CAP cutoff data. React/Vite is the user interface; FastAPI serves bundled CSV records; the Streamlit analysis app and cutoff-model training script are retained as companion tools.

## Requirements (Windows)
- Python 3.10+ (`py --version`)
- Node.js LTS (`node -v`, `npm -v`)
- VS Code optional

## Run the integrated React + FastAPI application
1. Extract the ZIP and open `CAP_Compass_Full_Stack` in VS Code.
2. Start the API in a terminal:

```powershell
py -m pip install -r backend/requirements.txt
py -m uvicorn backend.api.main:app --reload --host 127.0.0.1 --port 8000
```

3. In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

4. Open `http://localhost:5173`. API docs: `http://127.0.0.1:8000/docs`; health: `http://127.0.0.1:8000/api/health`.

### One-click Windows launcher
Double-click `run_all_windows.bat`. It opens separate terminal windows for API and frontend. If Windows blocks scripts, run the commands above manually.

## Optional Streamlit companion
From project root:

```powershell
py -m pip install -r backend/requirements.txt
py -m streamlit run backend/app.py
```

Open `http://localhost:8501`.

## Database and API capabilities
- FastAPI initializes a local SQLite metadata cache (`cap_compass.sqlite3`) on startup; the bundled CSVs remain the source of truth.
- API endpoints: `/api/health`, `/api/meta`, `/api/records`, `/api/recommendations`, `/api/trends`, `/api/model/status`, `/api/predict-cutoff`.
- `/api/predict-cutoff` returns an experimental historical closing-rank point estimate, never an admission probability.
- `/api/ml-recommendations?rank=15000&category=GOPENS&branch=Computer%20Engineering&target_year=2026` returns exact-branch matches, latest observed cutoff, ML forecast, and historical-fit band. `OPEN` is accepted as an alias for `GOPENS`.

## Optional model training
From project root:

```powershell
py -m pip install -r backend/requirements.txt
py scripts/train_cutoff_model.py
```

Training script uses a temporal holdout (2023–2024 train, 2025 validation) and writes `models/cutoff_model.joblib` plus `models/metrics.json`. A pre-trained baseline and its measured metrics are bundled. The updated year-to-year model is trained on consecutive cutoff transitions. Temporal validation (2024 transitions train, 2025 transitions test) reports MAE 23,202 ranks versus a last-year persistence baseline MAE 22,604; therefore this ML model does not yet beat the simple baseline. It is experimental and not a calibrated admission probability. The recommendation endpoint anchors Reach/Target/Safer to the latest observed cutoff and shows the ML forecast separately. Read `docs/TEST_REPORT.md`.

## Data / limitations
- Bundled data: 2023–2025 CAP Rounds 1–3.
- The React interface now obtains records from the FastAPI `/api/records` endpoint rather than reading CSV files directly in the browser.
- The application is a local prototype. It does not submit official choices, verify live seat availability, or guarantee allotment. Check current official CAP rules, seat matrix, category eligibility and dates.
- Data values are historical and may contain source-cleaning limitations. Validate against official releases before relying on them.

## Windows one-click launch
Run `run_all_windows.bat` from the extracted project root; it opens separate terminals for API and frontend.

## Rank-based College Predictor (updated)
The React College Explorer defaults to merit rank 15,000, OPEN (mapped to the dataset's GOPENS label), and Computer Engineering. It compares the selected rank against the latest available year/round record for each college-branch pair and sorts options as Safer, Target, then Reach. These are heuristic historical bands, not admission probabilities.

**Dataset limitation:** bundled cleaned files contain `quota_level = State Level` rather than verified Home University/Other Than Home University seat eligibility. The quota selector is currently a preference field only; it does not certify or filter official HU eligibility. Confirm exact CAP seat type, candidate's university, category, gender, eligibility and current-year seat matrix in official counselling documents before relying on a choice list.

### Start
Terminal 1 (project root): `py -m uvicorn backend.api.main:app --reload --host 127.0.0.1 --port 8000`
Terminal 2: `cd frontend`, `npm install`, `npm run dev`; open `http://localhost:5173`.
