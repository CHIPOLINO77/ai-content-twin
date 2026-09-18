import httpx
from app.config import POLZA_API_KEY, POLZA_BASE_URL, POLZA_MODEL

class PolzaClient:
    def __init__(self):
        self.base_url = POLZA_BASE_URL.rstrip("/")
        self.api_key = POLZA_API_KEY
        self.model = POLZA_MODEL

    async def chat(self, messages, model=None, temperature=0.7):
        if not self.api_key:
            raise RuntimeError("POLZA_API_KEY is not configured")
        payload = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if not payload["model"]:
            raise RuntimeError("POLZA_MODEL is not configured")
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            return response.json()
