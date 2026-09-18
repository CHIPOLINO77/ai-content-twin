# AI Content Twin

AI Content Twin — система, которая изучает стиль автора по его видео и помогает создавать новые идеи, хуки, сценарии и планы монтажа.

## MVP

- загрузка и анализ видео;
- транскрибация;
- извлечение структуры контента;
- Content Profile автора;
- генерация идей;
- генерация хуков и сценариев;
- Polza AI как LLM-провайдер.

## Backend

Стек: Python 3.11+, FastAPI, HTTPX.

### Запуск

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
```

В корне проекта создай `.env`:

```env
POLZA_API_KEY=your_key
POLZA_BASE_URL=https://api.polza.ai/api/v1
POLZA_MODEL=openai/gpt-5.5
```

Затем:

```bash
cd backend
uvicorn app.main:app --reload
```

### API

- `GET /health`
- `POST /api/chat`

Polza предоставляет OpenAI-совместимый API; Chat Completions доступен через `/v1/chat/completions`.

## Безопасность

Настоящий API-ключ хранится в локальном `.env`. Файл `.env` добавлен в `.gitignore` и не должен попадать в публичный репозиторий.

## Следующий этап

Видео → транскрибация → анализ стиля → Content Profile → идеи → хуки → сценарий → монтажный план.
