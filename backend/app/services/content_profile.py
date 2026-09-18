import json
from app.services.polza import PolzaClient

SYSTEM = """Ты аналитик контента. Построй Content Profile автора по данным его видео.
Верни JSON с ключами: voice, tone, hook_patterns, pacing, recurring_phrases,
topics, structure, audience, strengths, generation_rules. Не выдумывай факты,
если их нет в исходных данных."""

async def build_profile(analyses: list[dict], model: str | None = None) -> dict:
    client = PolzaClient()
    prompt = json.dumps(analyses, ensure_ascii=False)
    result = await client.chat(
        [{"role": "system", "content": SYSTEM},
         {"role": "user", "content": prompt}],
        model=model,
        temperature=0.2,
    )
    text = result["choices"][0]["message"]["content"]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw_profile": text}
