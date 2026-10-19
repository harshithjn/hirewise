import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
_use_groq = bool(GROQ_API_KEY) and not ANTHROPIC_API_KEY
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-120b" if _use_groq else "claude-sonnet-5-5")
LLM_CONCURRENCY = int(os.getenv("LLM_CONCURRENCY", "2" if _use_groq else "4"))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'hirewise_api.db'}")
CORS_ORIGINS = ["http://localhost:3000"]
CORS_ORIGIN_REGEX = r"http://(127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):3000"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
