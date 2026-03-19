import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_endpoint():
    """Test basic health check"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_health_ready_endpoint():
    """Test readiness check"""
    response = client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert "models_loaded" in data
    assert "timestamp" in data

def test_analyze_endpoint():
    """Test analyze endpoint with valid data"""
    response = client.post("/analyze", json={
        "texts": [
            "Le certificat d'économies d'énergie",
            "Les CEE pour la rénovation énergétique"
        ],
        "language": "fr"
    })
    assert response.status_code == 200
    data = response.json()
    assert "terms" in data
    assert "terms_to_avoid" in data

def test_analyze_missing_texts():
    """Test analyze without texts"""
    response = client.post("/analyze", json={
        "language": "fr"
    })
    assert response.status_code == 422  # Validation error

def test_analyze_invalid_language():
    """Test analyze with invalid language"""
    response = client.post("/analyze", json={
        "texts": ["test"],
        "language": "invalid"
    })
    assert response.status_code == 500
