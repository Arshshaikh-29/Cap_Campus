# Project scope and methodology

**System:** CAP Compass, historical engineering admission cutoff explorer and choice-list assistant.

**Data:** Bundled cleaned CAP1–CAP3 CSVs for 2023–2025. Source files are preserved; filename supplies year and round.

**Analytics:** Group historical closing ranks by college, branch, category, quota and stage. Median cutoff is the central reference; max/min are observed range endpoints. A rank smaller than a closing rank is historically within that cutoff.

**Risk bands:** Safer/target/reach labels are heuristics based on median cutoff multiples, not probabilities.

**ML extension:** `scripts/train_cutoff_model.py` fits a RandomForestRegressor for historical cutoff rank and reports temporal holdout metrics. It does not predict student-specific allotment. Do not claim probability/accuracy of admission.

**Future production requirements:** official eligibility/seat matrix and reservation rules; applicant-level anonymized allotment outcomes; leakage-safe temporal validation; calibrated classification; fairness and drift review; official source citations; audit logs.
