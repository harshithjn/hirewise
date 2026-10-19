import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

import config
import db
from errors import AppError, fail, ok
from routers import assistant, candidates, emails, interview, jobs, scoring, shortlist

log = logging.getLogger("hirewise")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="HireWise API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_origin_regex=config.CORS_ORIGIN_REGEX,
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
for r in (jobs, candidates, scoring, shortlist, interview, emails, assistant):
    app.include_router(r.router)


@app.exception_handler(AppError)
async def _app_error(_: Request, exc: AppError):
    return JSONResponse(fail(exc.code, exc.message), status_code=exc.status)


@app.exception_handler(StarletteHTTPException)
async def _http_error(_: Request, exc: StarletteHTTPException):
    return JSONResponse(fail("http_error", str(exc.detail)), status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def _validation_error(_: Request, exc: RequestValidationError):
    parts = [f"{'.'.join(str(p) for p in e['loc'] if p != 'body')}: {e['msg']}" for e in exc.errors()]
    return JSONResponse(fail("validation_error", "; ".join(parts) or "Invalid request."), status_code=422)


@app.exception_handler(Exception)
async def _unexpected(_: Request, exc: Exception):
    log.exception("Unhandled error")
    return JSONResponse(fail("internal_error", "Something went wrong. Please try again."), status_code=500)


@app.get("/api/health")
def health():
    return ok({"status": "ok", "model": config.LLM_MODEL, "llm_configured": bool(config.ANTHROPIC_API_KEY or config.GROQ_API_KEY)})


@app.post("/api/seed")
def seed_demo(session: Session = Depends(db.get_db)):
    from seed import load_seed

    return ok(load_seed(session))
