import sys
import os
sys.path.append(os.path.abspath('backend/api'))

from main import predict_colleges, PredictionRequest
from database import SessionLocal

req = PredictionRequest(
    percentile=90.0,
    rank=None,
    category="GOPENS",
    branch=None,
    city=None
)

db = SessionLocal()
results = predict_colleges(req, db)
print(results['count'])
print(len(results['predictions']))
