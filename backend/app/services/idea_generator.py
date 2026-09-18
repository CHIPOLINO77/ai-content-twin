import json
from app.services.polza import PolzaClient

async def generate_ideas(topic: str, count: int, profile: dict | None = None, model: str | None = None):
    client = PolzaClient()
    system = """Ты Content Twin. Генерируй идеи коротких видео в стиле автора.
Верни только JSON-массив объектов: title, hook, angle, payoff, why_it_fits.
Не копируй фразы автора дословно, если это не короткая общеупотребительная формулировка."""
    payload = {"topic": topic, "count": count, "profile": profile or {}}
    result = await client.chat(
        [{"role": "system", "content": system},
         {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
        model=model,
        temperature=0.85,
    )
    text = result["choices"][0]["message"]["content"]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw": text}
