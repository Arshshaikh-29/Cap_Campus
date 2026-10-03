# CAP Compass ML/API test report

## Training design
- Target: next-year historical closing merit rank for matching college/choice/category/stage/round groups.
- Features: prior closing rank, prior year, round and college/choice/branch/category/quota/stage identifiers.
- Temporal validation: train on 2023→2024 transitions; test on 2024→2025 transitions.

## Measured validation
- Training transitions: 6,832
- Validation transitions: 10,597
- MAE: 23,202 ranks
- Persistence baseline MAE (use previous year's cutoff unchanged): 22,604 ranks
- RMSE: 30,678 ranks
- R²: 0.698

## Interpretation
The ML model currently underperforms the persistence baseline on MAE. It is therefore not presented as a reliable probability or as a superior decision-maker. The `/api/ml-recommendations` endpoint displays the experimental model forecast separately, while Reach/Target/Safer labels are anchored to the latest observed historical cutoff. Exact category and branch filtering is used. Bundled quota labels are State Level, so Home University eligibility is not established.

## Checks performed
- Python syntax compilation passed for `backend/api/main.py`.
- Direct endpoint call returned matching recommendations for rank 15,000, GOPENS, Computer Engineering.
- Frontend production build was not verified in this environment because Vite dependencies were unavailable locally; run `npm install` then `npm run build` on the user's machine.
