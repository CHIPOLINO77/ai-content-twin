from pydantic import BaseModel, Field
from typing import Any

class IdeaRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=500)
    count: int = Field(default=10, ge=1, le=20)
    platform: str = "shorts"

class AnalyzeTextRequest(BaseModel):
    title: str = ""
    transcript: str = Field(min_length=10, max_length=200000)

class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=2, max_length=10000)
    context: dict[str, Any] = {}
    model: str | None = None
