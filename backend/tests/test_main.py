import os
import sys
from fastapi.testclient import TestClient

# Ensure project root (backend/) is on sys.path so tests can import main.py
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app

client = TestClient(app)


def test_root():
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "running"


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json().get("status") == "healthy"


def test_docs_available():
    resp = client.get("/docs")
    # FastAPI's docs should be reachable; accept 200 or 307 redirects depending on config
    assert resp.status_code in (200, 307)
    assert "OpenAPI" in resp.text or "Swagger" in resp.text or "swagger-ui" in resp.text.lower()


def test_create_project_requires_auth():
    payload = {"name": "test", "document_type": "docx", "topic": "testing"}
    resp = client.post("/api/projects/", json=payload)
    # Without a valid Firebase token, the endpoint should reject the request (401 or 403)
    assert resp.status_code in (401, 403)


def test_options_projects_preflight():
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
    }
    resp = client.options("/api/projects/", headers=headers)
    # Expect a successful preflight (200 or 204) when CORS is configured for localhost
    assert resp.status_code in (200, 204)
