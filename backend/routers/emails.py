import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from errors import AppError, ok
from models import Candidate, Email, Job, Score
from schemas import EmailIn, EmailLLM, SendIn
from serializers import email_out
from services import llm, prompts

router = APIRouter(prefix="/api/emails", tags=["emails"])
_PLACEHOLDER = re.compile(r"\[[^\]\n]{1,60}\]|\{\{[^}]*\}\}|\{[A-Za-z_][\w ]*\}|<<[^>]*>>|<[A-Z][A-Za-z ]{1,40}>|_{3,}|\bXXX+\b")
_SCORE_LEAK = re.compile(r"\bscor(?:e|es|ed|ing)\b|\branked?\b|\branking\b|\brating\b|\bpercentile\b|\d+(?:\.\d+)?\s*(?:%|percent\b|/\s*100|out of 100)", re.I)


def find_problems(d: EmailLLM) -> list[str]:
    text, out = f"{d.subject}\n{d.body}", []
    if m := _PLACEHOLDER.search(text):
        out.append(f"it contains an unfilled placeholder '{m.group(0)}'")
    if m := _SCORE_LEAK.search(text):
        out.append(f"it mentions scores/rankings ('{m.group(0)}')")
    return out


def _facts(cand, score):
    p, f = cand.parsed_json or {}, []
    if p.get("current_title"):
        f.append(f"Current/most recent title: {p['current_title']}")
    wh = p.get("work_history") or []
    if wh and wh[0].get("company"):
        f.append(f"Most recent employer: {wh[0]['company']}")
    if p.get("skills"):
        f.append("Key skills: " + ", ".join(p["skills"][:6]))
    if p.get("total_experience_years") is not None:
        f.append(f"Years of experience: {p['total_experience_years']}")
    if score:
        f += [f"Strength: {s}" for s in (score.details or {}).get("strengths", [])[:2]]
    return f


@router.post("/generate")
def generate(body: EmailIn, db: Session = Depends(get_db)):
    cand = db.get(Candidate, body.candidate_id)
    if not cand:
        raise AppError("Candidate not found.", code="not_found", status=404)
    job = db.get(Job, body.job_id) if body.job_id else db.scalars(select(Job).where(Job.is_active).order_by(Job.id.desc())).first()
    if body.job_id and not job:
        raise AppError("Job not found.", code="not_found", status=404)
    score = db.scalars(select(Score).where(Score.candidate_id == cand.id, Score.job_id == job.id)).first() if job else None
    user = (f"Email type: {body.type}\nTone: {body.tone}\nCandidate name: {cand.name or 'Candidate'}\n"
            f"Role: {job.title if job else 'the open role'}\nRecruiter: {body.recruiter}\nCompany: {body.company}\n"
            "Profile facts you may reference:\n" + "\n".join(f"- {f}" for f in _facts(cand, score)))
    draft, problems = None, []
    for _ in range(2):
        prompt = user if not problems else user + "\n\nYour previous draft was rejected because " + "; ".join(problems) + ". Rewrite it fixing this."
        draft = llm.call_llm(prompts.EMAIL_SYSTEM, prompt, EmailLLM, temperature=0.5, max_tokens=1200)
        problems = find_problems(draft)
        if not problems:
            break
    if problems:
        raise AppError("Could not produce a clean email draft. Please try again.", code="email_invalid", status=502)
    row = Email(candidate_id=cand.id, job_id=job.id if job else None, type=body.type, tone=body.tone, to_email=cand.email,
                subject=draft.subject.strip(), body=draft.body.strip(), status="draft")
    db.add(row)
    db.commit()
    return ok(email_out(row))


@router.post("/send-simulated")
def send_simulated(body: SendIn, db: Session = Depends(get_db)):
    row = db.get(Email, body.email_id)
    if not row:
        raise AppError("Email not found.", code="not_found", status=404)
    if body.subject is not None:
        row.subject = body.subject
    if body.body is not None:
        row.body = body.body
    if problems := find_problems(EmailLLM(subject=row.subject or "-", body=row.body or "-")):
        raise AppError("Cannot send: " + "; ".join(problems) + ".", code="email_invalid", status=422)
    row.status, row.sent_at = "sent_simulated", datetime.now(timezone.utc)
    db.commit()
    return ok(email_out(row))
