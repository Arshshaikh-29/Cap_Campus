# CAP Compass validation report

Validation performed in the package-generation environment on 2026-09-28.

- Python compile check: passed for API and training script.
- FastAPI TestClient: `/api/health`, `/api/meta`, `/api/trends`, and `/api/recommendations?rank=25000&limit=5` returned HTTP 200.
- Bundled source CSVs: 9 files (2023–2025, CAP rounds 1–3).
- Model training: temporal split, train 2023–2024, test 2025; 45,553 training rows and 34,104 validation rows.
- Regression validation: MAE 35,079.16 ranks; RMSE 47,159.17; R² 0.3044.

Interpretation: the baseline has substantial error and must not be marketed as admission probability or used as an official counselling decision. Model performance varies across categories, colleges, branches and seat pools; further stratified evaluation and official rule validation are required.

Not verified in this environment: Windows-specific installation, npm install/build/browser rendering, deployment, official CAP eligibility correctness, and PostgreSQL deployment. SQLite is used only as a local metadata/cache initialization; CSVs remain the current data source of truth.
