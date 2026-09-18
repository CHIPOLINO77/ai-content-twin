import json
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import POLZA_API_KEY, POLZA_MODEL
from app.db import init_db, insert_video, get_video, list_videos, update_video, save_analysis, get_analyses, save_profile, get_profile
from app.services.polza import PolzaClient
from app.services.content_analyzer import analyze_text
from app.services.content_profile import build_profile
from app.services.idea_generator import generate_ideas
from app.services.transcriber import Transcriber
from app.schemas import IdeaRequest, AnalyzeTextRequest, GenerateRequest

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "uploads"
DATA_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024

app = FastAPI(title="AI Content Twin", version="0.4.1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
FRONTEND_DIR = Path(__file__).resolve().parents[2].parent / "frontend"

@app.on_event("startup")
def startup():
    init_db()

@app.get("/", include_in_schema=False)
def frontend():
    return FileResponse(FRONTEND_DIR / "index.html")

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

class ChatRequest(BaseModel):
    messages: list[dict]
    model: str | None = None
    temperature: float = 0.7

@app.get("/health")
def health():
    return {
        "status": "ok",
        "polza_configured": bool(POLZA_API_KEY),
        "model_configured": bool(POLZA_MODEL),
    }

@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    allowed = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in allowed:
        raise HTTPException(400, "Unsupported video format")

    fid = uuid4().hex
    target = DATA_DIR / (fid + suffix)
    size = 0
    try:
        with target.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    target.unlink(missing_ok=True)
                    raise HTTPException(413, "Video is larger than 2 GB")
                out.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        target.unlink(missing_ok=True)
        raise HTTPException(500, f"Upload failed: {exc}")

    insert_video(fid, file.filename or target.name, str(target), size)
    return {"id": fid, "filename": file.filename, "size": size, "status": "uploaded"}

@app.get("/api/videos")
def videos():
    return list_videos()

@app.get("/api/videos/{video_id}")
def video(video_id: str):
    item = get_video(video_id)
    if not item:
        raise HTTPException(404, "Video not found")
    return item

@app.post("/api/videos/{video_id}/transcribe")
def transcribe_video(video_id: str):
    item = get_video(video_id)
    if not item:
        raise HTTPException(404, "Video not found")
    if item["status"] == "transcribing":
        return {"id": video_id, "status": "transcribing"}
    update_video(video_id, status="transcribing", error="")
    try:
        transcript = Transcriber.transcribe(item["path"])
        update_video(video_id, status="transcribed", transcript=transcript)
        return {"id": video_id, "status": "transcribed", "transcript": transcript}
    except Exception as exc:
        update_video(video_id, status="error", error=str(exc))
        raise HTTPException(502, f"Transcription failed: {exc}")

@app.post("/api/videos/{video_id}/analyze")
def analyze_video(video_id: str):
    item = get_video(video_id)
    if not item:
        raise HTTPException(404, "Video not found")
    if not item["transcript"]:
        raise HTTPException(409, "Video has no transcript")
    result = analyze_text(item["filename"], item["transcript"])
    save_analysis(video_id, json.dumps(result, ensure_ascii=False))
    update_video(video_id, status="analyzed")
    return result

@app.post("/api/profile")
async def profile(analyses: list[dict]):
    try:
        result = await build_profile(analyses)
        save_profile(json.dumps(result, ensure_ascii=False))
        return result
    except Exception as exc:
        raise HTTPException(502, str(exc))

@app.post("/api/profile/build")
async def build_stored_profile():
    analyses = get_analyses()
    if not analyses:
        raise HTTPException(409, "Analyze at least one video first")
    payload = []
    for item in analyses:
        try:
            payload.append(json.loads(item["data"]))
        except json.JSONDecodeError:
            continue
    if not payload:
        raise HTTPException(409, "No valid analyses found")
    try:
        result = await build_profile(payload)
        save_profile(json.dumps(result, ensure_ascii=False))
        return result
    except Exception as exc:
        raise HTTPException(502, str(exc))

@app.get("/api/profile")
def stored_profile():
    item = get_profile()
    if not item:
        raise HTTPException(404, "Profile not built yet")
    return {"profile": json.loads(item["data"]), "updated_at": item["updated_at"]}

@app.post("/api/ideas")
async def ideas(request: IdeaRequest):
    try:
        return await generate_ideas(request.topic, request.count)
    except Exception as exc:
        raise HTTPException(502, str(exc))

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        return await PolzaClient().chat(request.messages, request.model, request.temperature)
    except Exception as exc:
        raise HTTPException(502, str(exc))

@app.post("/api/analyze/text")
def analyze_text_route(request: AnalyzeTextRequest):
    return analyze_text(request.title, request.transcript)

@app.post("/api/generate")
async def generate(request: GenerateRequest):
    try:
        return await PolzaClient().chat(
            [
                {"role": "system", "content": "Ты AI Content Twin. Создавай практичный контент для автора."},
                {"role": "user", "content": request.prompt + "\n\nКонтекст:\n" + str(request.context)},
            ],
            request.model,
            0.8,
        )
    except Exception as exc:
        raise HTTPException(502, str(exc))
