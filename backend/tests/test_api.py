import pytest
from fastapi.testclient import TestClient
from backend.api.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_get_filters():
    response = client.get("/api/filters")
    assert response.status_code == 200
    data = response.json()
    assert "categories" in data
    assert "branches" in data
    assert "cities" in data

def test_search_colleges():
    response = client.get("/api/colleges?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "results" in data
    assert len(data["results"]) <= 5

def test_predict_validation():
    # Should fail if neither percentile nor rank is provided
    response = client.post("/api/predict", json={
        "category": "GOPENS"
    })
    assert response.status_code == 400

def test_predict_success():
    response = client.post("/api/predict", json={
        "category": "GOPENS",
        "percentile": 95.0
    })
    assert response.status_code == 200
    assert "predictions" in response.json()
