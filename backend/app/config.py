import os
from dotenv import load_dotenv

load_dotenv()

POLZA_API_KEY = os.getenv("POLZA_API_KEY", "")
POLZA_BASE_URL = os.getenv("POLZA_BASE_URL", "https://api.polza.ai/api/v1")
POLZA_MODEL = os.getenv("POLZA_MODEL", "")
