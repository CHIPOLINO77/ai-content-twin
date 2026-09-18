from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)

def test_health():
    r=client.get("/health")
    assert r.status_code==200 and r.json()["status"]=="ok"

def test_analyze_text():
    r=client.post("/api/analyze/text",json={"title":"Test","transcript":"Почему это работает? Это важный тест. Это действительно важный тест."})
    assert r.status_code==200
    assert r.json()["word_count"]>0

def test_upload_rejects_non_video():
    r=client.post("/api/upload",files={"file":("x.txt",b"hello","text/plain")})
    assert r.status_code==400
