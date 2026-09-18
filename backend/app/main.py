from fastapi import FastAPI
from pydantic import BaseModel
from app.config import POLZA_API_KEY, POLZA_MODEL
from app.services.polza import PolzaClient

app = FastAPI(title="AI Content Twin", version="0.1.0")

class ChatRequest(BaseModel):
    messages: list[dict]
    model: str | None = None
    temperature: float = 0.7

@app.get("/health")
def health():
    return {"status": "ok", "polza_configured": bool(POLZA_API_KEY), "model_configured": bool(POLZA_MODEL)}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    return await PolzaClient().chat(request.messages, request.model, request.temperature)
