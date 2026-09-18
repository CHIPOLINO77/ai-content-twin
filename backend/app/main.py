from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.config import POLZA_API_KEY, POLZA_MODEL
from app.services.polza import PolzaClient
from app.services.content_analyzer import analyze_text
from app.services.content_profile import build_profile
from app.services.idea_generator import generate_ideas
from app.schemas import IdeaRequest, AnalyzeTextRequest, GenerateRequest

app = FastAPI(title="AI Content Twin", version="0.2.0")

class ChatRequest(BaseModel):
    messages: list[dict]
    model: str | None = None
    temperature: float = 0.7

@app.get("/health")
def health():
    return {"status": "ok", "polza_configured": bool(POLZA_API_KEY), "model_configured": bool(POLZA_MODEL)}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        return await PolzaClient().chat(request.messages, request.model, request.temperature)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@app.post("/api/analyze/text")
def analyze_text_route(request: AnalyzeTextRequest):
    return analyze_text(request.title, request.transcript)

@app.post("/api/profile")
async def profile(analyses: list[dict]):
    try:
        return await build_profile(analyses)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@app.post("/api/ideas")
async def ideas(request: IdeaRequest):
    try:
        return await generate_ideas(request.topic, request.count)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@app.post("/api/generate")
async def generate(request: GenerateRequest):
    try:
        result = await PolzaClient().chat(
            [{"role": "system", "content": "Ты AI Content Twin. Создавай практичный контент для автора."},
             {"role": "user", "content": request.prompt + "\n\nКонтекст:\n" + str(request.context)}],
            model=request.model,
            temperature=0.8,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
