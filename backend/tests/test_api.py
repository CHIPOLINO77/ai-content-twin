import json

from fastapi.testclient import TestClient

from app.main import app
from app import main

client = TestClient(app)

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_frontend_and_static_assets():
    assert client.get("/").status_code == 200
    assert client.get("/static/app.js").status_code == 200
    assert client.get("/static/style.css").status_code == 200

def test_analyze_text():
    r = client.post(
        "/api/analyze/text",
        json={"title": "Test", "transcript": "Почему это работает? Это важный тест. Это действительно важный тест."},
    )
    assert r.status_code == 200
    assert r.json()["word_count"] > 0

def test_upload_rejects_non_video():
    r = client.post("/api/upload", files={"file": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 400

def test_upload_persists_video():
    r = client.post("/api/upload", files={"file": ("sample.mp4", b"fake-video", "video/mp4")})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "uploaded"
    stored = client.get(f"/api/videos/{data['id']}")
    assert stored.status_code == 200
    assert stored.json()["filename"] == "sample.mp4"

def test_video_analysis_requires_transcript():
    r = client.post("/api/upload", files={"file": ("sample2.mp4", b"fake", "video/mp4")})
    video_id = r.json()["id"]
    r = client.post(f"/api/videos/{video_id}/analyze")
    assert r.status_code == 409

def test_transcription_pipeline_can_be_mocked(monkeypatch):
    r = client.post("/api/upload", files={"file": ("sample3.mp4", b"fake", "video/mp4")})
    video_id = r.json()["id"]

    monkeypatch.setattr(main.Transcriber, "transcribe", classmethod(lambda cls, path: "Почему это работает? Это тестовый транскрипт."))
    r = client.post(f"/api/videos/{video_id}/transcribe")
    assert r.status_code == 200
    assert r.json()["status"] == "transcribed"

    r = client.post(f"/api/videos/{video_id}/analyze")
    assert r.status_code == 200
    assert r.json()["word_count"] > 0

def test_profile_build_can_be_mocked(monkeypatch):
    async def fake_build(analyses):
        return {"voice": "test", "tone": "clear", "topics": ["testing"]}

    monkeypatch.setattr(main, "build_profile", fake_build)
    r = client.post("/api/profile/build")
    assert r.status_code == 200
    assert r.json()["voice"] == "test"
    stored = client.get("/api/profile")
    assert stored.status_code == 200
    assert json.loads(json.dumps(stored.json()["profile"]))["voice"] == "test"
