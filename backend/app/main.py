from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
from uuid import uuid4
from app.config import POLZA_API_KEY, POLZA_MODEL
from app.services.polza import PolzaClient
from app.services.content_analyzer import analyze_text
from app.services.content_profile import build_profile
from app.services.idea_generator import generate_ideas
from app.schemas import IdeaRequest, AnalyzeTextRequest, GenerateRequest

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "uploads"
DATA_DIR.mkdir(parents=True, exist_ok=True)
app = FastAPI(title="AI Content Twin", version="0.3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
FRONTEND_DIR = Path(__file__).resolve().parents[2].parent / "frontend"

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
    return {"status":"ok","polza_configured":bool(POLZA_API_KEY),"model_configured":bool(POLZA_MODEL)}

@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    allowed={".mp4",".mov",".mkv",".webm",".avi",".m4v"}
    suffix=Path(file.filename or "").suffix.lower()
    if suffix not in allowed: raise HTTPException(400,"Unsupported video format")
    data=await file.read()
    if len(data)>2*1024*1024*1024: raise HTTPException(413,"Video is larger than 2 GB")
    fid=uuid4().hex; target=DATA_DIR/(fid+suffix); target.write_bytes(data)
    return {"id":fid,"filename":file.filename,"size":len(data),"status":"uploaded"}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try: return await PolzaClient().chat(request.messages,request.model,request.temperature)
    except Exception as e: raise HTTPException(502,str(e))

@app.post("/api/analyze/text")
def analyze_text_route(request: AnalyzeTextRequest):
    return analyze_text(request.title,request.transcript)

@app.post("/api/profile")
async def profile(analyses:list[dict]):
    try: return await build_profile(analyses)
    except Exception as e: raise HTTPException(502,str(e))

@app.post("/api/ideas")
async def ideas(request:IdeaRequest):
    try: return await generate_ideas(request.topic,request.count)
    except Exception as e: raise HTTPException(502,str(e))

@app.post("/api/generate")
async def generate(request:GenerateRequest):
    try:
        return await PolzaClient().chat([{"role":"system","content":"Ты AI Content Twin. Создавай практичный контент для автора."},{"role":"user","content":request.prompt+"\n\nКонтекст:\n"+str(request.context)}],request.model,0.8)
    except Exception as e: raise HTTPException(502,str(e))
