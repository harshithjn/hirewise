# HireWise

AI recruitment workflow: JD → resumes → scoring → shortlist → interview → outreach → assistant.

```bash
# API (needs GROQ_API_KEY or ANTHROPIC_API_KEY in backend/.env)
cd backend && ../.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
# UI
cd hirewise-web && npm run build && npx next start -H 0.0.0.0 -p 3000
```
Open http://localhost:3000 and click **Load demo data**.
