from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from errors import AppError, ok
from models import Candidate, Job, Score, ShortlistDecision
from schemas import CompareIn, DecisionIn
from serializers import decision_out
from services import llm, prompts

router = APIRouter(prefix="/api/shortlist", tags=["shortlist"])


def _active_job_id(db):
    job = db.scalars(select(Job).where(Job.is_active).order_by(Job.id.desc())).first()
    return job.id if job else None


@router.post("/decision")
def decision(body: DecisionIn, db: Session = Depends(get_db)):
    if not db.get(Candidate, body.candidate_id):
        raise AppError("Candidate not found.", code="not_found", status=404)
    job_id = body.job_id if body.job_id is not None else _active_job_id(db)
    row = db.scalars(select(ShortlistDecision).where(
        ShortlistDecision.candidate_id == body.candidate_id,
        ShortlistDecision.job_id == job_id if job_id is not None else ShortlistDecision.job_id.is_(None))).first()
    if body.decision == "undecided":
        if row:
            db.delete(row)
            db.commit()
        return ok({"candidate_id": body.candidate_id, "job_id": job_id, "decision": "undecided"})
    if row is None:
        row = ShortlistDecision(candidate_id=body.candidate_id, job_id=job_id)
    row.decision, row.note = body.decision, body.note
    db.add(row)
    db.commit()
    return ok(decision_out(row))


@router.get("")
def list_decisions(job_id: int | None = None, db: Session = Depends(get_db)):
    job_id = job_id if job_id is not None else _active_job_id(db)
    q = select(ShortlistDecision).order_by(ShortlistDecision.id)
    if job_id is not None:
        q = q.where(ShortlistDecision.job_id == job_id)
    return ok([decision_out(d) for d in db.scalars(q)])


@router.post("/compare")
def compare(body: CompareIn, db: Session = Depends(get_db)):
    if not db.get(Job, body.job_id):
        raise AppError("Job not found.", code="not_found", status=404)
    rows = db.execute(select(Score, Candidate.name).join(Candidate, Candidate.id == Score.candidate_id)
                      .where(Score.job_id == body.job_id).order_by(Score.overall_score.desc(), Score.candidate_id)
                      .limit(body.top_n)).all()
    if len(rows) < 2:
        raise AppError("Score at least two candidates before comparing.", code="not_enough_scores", status=409)
    decisions = {d.candidate_id: d.decision for d in db.scalars(select(ShortlistDecision).where(ShortlistDecision.job_id == body.job_id))}
    facts = []
    for s, name in rows:
        d = s.details or {}
        facts.append({"name": name, "overall_score": s.overall_score, "skill_match": s.skill_match,
                      "experience_match": s.experience_match, "education_match": s.education_match,
                      "matched_skills": d.get("matched_skills", []), "missing_skills": d.get("missing_skills", []),
                      "strengths": d.get("strengths", []), "concerns": d.get("concerns", []),
                      "reasoning": d.get("reasoning", ""), "decision": decisions.get(s.candidate_id, "undecided")})
    summary = llm.call_llm(prompts.COMPARE_SYSTEM, "Stored screening results (best first):\n" + prompts.dumps(facts), max_tokens=800)
    return ok({"summary": summary, "candidate_ids": [s.candidate_id for s, _ in rows]})
