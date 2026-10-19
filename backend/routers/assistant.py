from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from errors import AppError, ok
from models import Candidate, Job, Score, ShortlistDecision
from schemas import ChatIn, ReportIn
from services import llm, prompts

router = APIRouter(prefix="/api/assistant", tags=["assistant"])
HISTORY = 6


def build_context(db: Session, job: Job | None) -> dict:
    scores = {s.candidate_id: s for s in db.scalars(select(Score).where(Score.job_id == job.id))} if job else {}
    decisions = {d.candidate_id: d.decision for d in db.scalars(select(ShortlistDecision).where(ShortlistDecision.job_id == job.id))} if job else {}
    cands = []
    for c in db.scalars(select(Candidate).order_by(Candidate.id)):
        p, s = c.parsed_json or {}, scores.get(c.id)
        item = {"id": c.id, "name": c.name, "current_title": p.get("current_title"), "location": p.get("location"),
                "total_experience_years": p.get("total_experience_years"), "skills": p.get("skills", []),
                "education": p.get("education", []), "certifications": p.get("certifications", []),
                "decision": decisions.get(c.id, "undecided")}
        if s:
            d = s.details or {}
            item["screening"] = {"overall_score": s.overall_score, "skill_match": s.skill_match, "experience_match": s.experience_match,
                                 "education_match": s.education_match, "matched_skills": d.get("matched_skills", []),
                                 "missing_skills": d.get("missing_skills", []), "strengths": d.get("strengths", []),
                                 "concerns": d.get("concerns", []), "reasoning": d.get("reasoning", "")}
        cands.append(item)
    return {"active_job": {"title": job.title, "description": job.jd_text[:5000], "requirements": job.structured} if job else None,
            "candidates": cands}


@router.post("/chat")
def chat(body: ChatIn, db: Session = Depends(get_db)):
    if body.messages[-1].role != "user":
        raise AppError("The last message must be from the user.", code="validation_error", status=422)
    job = db.get(Job, body.job_id) if body.job_id else db.scalars(select(Job).where(Job.is_active).order_by(Job.id.desc())).first()
    hist = body.messages[-HISTORY:]
    transcript = "\n".join(f"{m.role.upper()}: {m.content}" for m in hist[:-1])
    user = ("DATA:\n" + prompts.dumps(build_context(db, job)) + ("\n\nConversation so far:\n" + transcript if transcript else "")
            + "\n\nUser question: " + hist[-1].content)
    return ok({"answer": llm.call_llm(prompts.CHAT_SYSTEM, user, max_tokens=1200)})


@router.post("/report")
def report(body: ReportIn, db: Session = Depends(get_db)):
    job = db.get(Job, body.job_id)
    if not job:
        raise AppError("Job not found.", code="not_found", status=404)
    cands = build_context(db, job)["candidates"]
    scored = sorted((c for c in cands if "screening" in c), key=lambda c: -c["screening"]["overall_score"])
    gaps = Counter(g for c in scored for g in c["screening"]["missing_skills"])
    facts = {"job_title": job.title,
             "pipeline_counts": {"candidates": len(cands), "scored": len(scored), **Counter(c["decision"] for c in cands)},
             "average_score": round(sum(c["screening"]["overall_score"] for c in scored) / len(scored), 1) if scored else None,
             "top_candidates": [{"name": c["name"], "overall_score": c["screening"]["overall_score"], "strengths": c["screening"]["strengths"],
                                 "missing_skills": c["screening"]["missing_skills"], "decision": c["decision"]} for c in scored[:5]],
             "common_gaps": [{"skill": k, "candidates_missing": v} for k, v in gaps.most_common(6)]}
    return ok({"markdown": llm.call_llm(prompts.REPORT_SYSTEM, "Facts:\n" + prompts.dumps(facts), max_tokens=1500), "facts": facts})
