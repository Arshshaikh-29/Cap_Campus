from fastapi.testclient import TestClient
from backend.api.main import app

client = TestClient(app)

response = client.post(
    "/api/predict",
    json={
        "percentile": 90.0,
        "category": "GOPENS"
    }
)
print(response.status_code)
print(response.json())
