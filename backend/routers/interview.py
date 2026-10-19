from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from errors import AppError, ok
from models import Candidate, Job, Score
from schemas import InterviewIn, InterviewKitLLM, InterviewQuestion, RegenerateIn
from services import llm, prompts

router = APIRouter(prefix="/api/interview", tags=["interview"])


def _norm(s):
    return " ".join(str(s).lower().split())


def _load(db, cid, jid):
    cand, job = db.get(Candidate, cid), db.get(Job, jid)
    if not cand:
        raise AppError("Candidate not found.", code="not_found", status=404)
    if not job:
        raise AppError("Job not found.", code="not_found", status=404)
    score = db.scalars(select(Score).where(Score.candidate_id == cid, Score.job_id == jid)).first()
    return cand, job, score


def _gaps(cand, job, score):
    if score:
        d = score.details or {}
        return {"missing_skills": d.get("missing_skills", []), "concerns": d.get("concerns", [])}
    have = {_norm(s) for s in (cand.parsed_json or {}).get("skills", [])}
    return {"missing_skills": [s for s in (job.structured or {}).get("must_have_skills", []) if _norm(s) not in have], "concerns": []}


def _context(cand, job, score, level):
    p, st = cand.parsed_json or {}, job.structured or {}
    return {"level": level, "job": {"title": job.title, "must_have_skills": st.get("must_have_skills", []),
                                    "nice_to_have_skills": st.get("nice_to_have_skills", [])},
            "candidate": {"current_title": p.get("current_title"), "total_experience_years": p.get("total_experience_years"),
                          "skills": p.get("skills", []), "work_history": p.get("work_history", [])[:4]},
            "gaps": _gaps(cand, job, score), "strengths": (score.details or {}).get("strengths", []) if score else []}


@router.post("/generate")
def generate(body: InterviewIn, db: Session = Depends(get_db)):
    cand, job, score = _load(db, body.candidate_id, body.job_id)
    c = body.counts
    user = prompts.dumps(_context(cand, job, score, body.level)) + f"\n\nRequested counts: technical={c.technical}, behavioral={c.behavioral}, gap_probing={c.gap_probing}"
    kit = llm.call_llm(prompts.INTERVIEW_SYSTEM, user, InterviewKitLLM, temperature=0.5, max_tokens=8000)
    data = {"technical": kit.technical[: c.technical], "behavioral": kit.behavioral[: c.behavioral], "gap_probing": kit.gap_probing[: c.gap_probing]}
    return ok({k: [q.model_dump() for q in v] for k, v in data.items()})


@router.post("/regenerate")
def regenerate(body: RegenerateIn, db: Session = Depends(get_db)):
    cand, job, score = _load(db, body.candidate_id, body.job_id)
    user = (prompts.dumps(_context(cand, job, score, body.level)) + f"\n\nCategory: {body.category}\nReplace this question: {body.current_question}"
            + "\nAvoid these questions:\n" + "\n".join(f"- {q}" for q in [body.current_question, *body.avoid]))
    return ok(llm.call_llm(prompts.REGENERATE_SYSTEM, user, InterviewQuestion, temperature=0.7, max_tokens=1200).model_dump())
