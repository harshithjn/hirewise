import logging
import re
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

import config
from db import get_db
from errors import AppError, ok
from models import Candidate, Job, Score, ShortlistDecision
from schemas import ParsedResume
from serializers import candidate_out
from services import llm, prompts
from services.resume_text import extract_text

log = logging.getLogger("hirewise")
router = APIRouter(prefix="/api/candidates", tags=["candidates"])


def _norm_name(n):
    return re.sub(r"[^a-z]", "", (n or "").lower())


def _process(filename: str, data: bytes) -> dict:
    try:
        text = extract_text(filename, data)
        if not text:
            return {"filename": filename, "warning": True,
                    "error": "No extractable text (scanned or image-only file?). Upload a text-based copy."}
        parsed = llm.call_llm(prompts.RESUME_SYSTEM, "Resume text:\n\n" + text, ParsedResume)
        p = parsed.model_dump()
        if p["email"] and p["email"].lower() not in text.lower():
            p["email"] = None
        return {"filename": filename, "parsed": p, "raw_text": text}
    except AppError as exc:
        return {"filename": filename, "error": exc.message}
    except Exception:  # noqa: BLE001
        log.exception("Failed to parse %s", filename)
        return {"filename": filename, "error": "Unexpected error while parsing this file."}


@router.post("/parse")
async def parse(files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    blobs, failed = [], []
    for f in files:
        data = await f.read()
        name = f.filename or "unnamed"
        if len(data) > config.MAX_UPLOAD_BYTES:
            failed.append({"filename": name, "reason": "File is larger than 10 MB."})
        elif not data:
            failed.append({"filename": name, "reason": "File is empty."})
        else:
            blobs.append((name, data))

    def run_all():
        with ThreadPoolExecutor(max_workers=config.LLM_CONCURRENCY) as ex:
            return list(ex.map(lambda b: _process(*b), blobs))

    results = await run_in_threadpool(run_all)
    existing = db.scalars(select(Candidate)).all()
    emails = {c.email.lower(): c for c in existing if c.email}
    names = {_norm_name(c.name): c for c in existing if c.name}
    saved, duplicates, warnings = [], [], []
    for r in results:
        if "error" in r:
            failed.append({"filename": r["filename"], "reason": r["error"]})
            if r.get("warning"):
                warnings.append(f"{r['filename']}: {r['error']}")
            continue
        p = r["parsed"]
        email = (p.get("email") or "").lower() or None
        nn = _norm_name(p.get("name"))
        match = (emails.get(email) if email else None) or (names.get(nn) if nn else None)
        if match:
            duplicates.append({"filename": r["filename"], "name": p.get("name"), "email": p.get("email"), "duplicate_of": match.id})
            continue
        c = Candidate(name=p.get("name"), email=p.get("email"), source_filename=r["filename"], parsed_json=p, raw_text=r["raw_text"])
        db.add(c)
        db.flush()
        if email:
            emails[email] = c
        if nn:
            names[nn] = c
        saved.append(c)
    db.commit()
    return ok({"candidates": [candidate_out(c) for c in saved], "failed": failed, "duplicates": duplicates, "warnings": warnings})


@router.get("")
def list_candidates(job_id: int | None = None, db: Session = Depends(get_db)):
    cands = db.scalars(select(Candidate).order_by(Candidate.id)).all()
    if job_id is None:
        job = db.scalars(select(Job).where(Job.is_active).order_by(Job.id.desc())).first()
        job_id = job.id if job else None
    scores, decisions = {}, {}
    if job_id is not None:
        scores = {s.candidate_id: s for s in db.scalars(select(Score).where(Score.job_id == job_id))}
        decisions = {d.candidate_id: d for d in db.scalars(select(ShortlistDecision).where(ShortlistDecision.job_id == job_id).order_by(ShortlistDecision.id))}
    return ok([candidate_out(c, scores.get(c.id), decisions.get(c.id)) for c in cands])
