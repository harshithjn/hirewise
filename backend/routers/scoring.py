import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

import config
from db import get_db
from errors import AppError, ok
from models import Candidate, Job, Score
from schemas import ScoreLLM, ScoreRunIn
from serializers import score_out
from services import llm, prompts

log = logging.getLogger("hirewise")
router = APIRouter(prefix="/api/scoring", tags=["scoring"])
MUST_HAVE_CAP = 60
_PII = ("name", "email", "phone")


def _norm(s):
    return " ".join(str(s).lower().split())


def _is_must_have(skill, must_haves):
    s = _norm(skill)
    return any(m and (m == s or m in s or s in m) for m in map(_norm, must_haves))


def apply_cap(result: ScoreLLM, must_haves) -> bool:
    if any(_is_must_have(s, must_haves) for s in result.missing_skills) and result.overall_score > MUST_HAVE_CAP:
        result.overall_score = MUST_HAVE_CAP
        return True
    return False


def job_context(job: Job) -> dict:
    st = job.structured or {}
    return {"title": job.title, "must_have_skills": st.get("must_have_skills", []),
            "nice_to_have_skills": st.get("nice_to_have_skills", []),
            "min_experience_years": st.get("min_experience_years"), "description": job.jd_text[:6000]}


def _score_one(cid, profile, ctx):
    try:
        user = (f"JOB\n{prompts.dumps(ctx)}\n\nCANDIDATE (candidate ref: {cid}; identifying details removed)\n{prompts.dumps(profile)}")
        return cid, llm.call_llm(prompts.SCORING_SYSTEM, user, ScoreLLM, temperature=0, max_tokens=2048), None
    except AppError as exc:
        return cid, None, exc.message
    except Exception:  # noqa: BLE001
        log.exception("Scoring failed for %s", cid)
        return cid, None, "Unexpected error while scoring."


@router.post("/run")
def run(body: ScoreRunIn, db: Session = Depends(get_db)):
    job = db.get(Job, body.job_id)
    if not job:
        raise AppError("Job not found.", code="not_found", status=404)
    cands = db.scalars(select(Candidate).order_by(Candidate.id)).all()
    if not cands:
        raise AppError("No candidates to score yet. Upload resumes first.", code="no_candidates", status=409)
    ctx = job_context(job)
    tasks = [(c.id, {k: v for k, v in (c.parsed_json or {}).items() if k not in _PII}) for c in cands]
    with ThreadPoolExecutor(max_workers=config.LLM_CONCURRENCY) as ex:
        results = list(ex.map(lambda t: _score_one(t[0], t[1], ctx), tasks))
    by_id = {c.id: c for c in cands}
    existing = {s.candidate_id: s for s in db.scalars(select(Score).where(Score.job_id == job.id))}
    failed = []
    for cid, res, err in results:
        if err:
            failed.append({"candidate_id": cid, "name": by_id[cid].name, "reason": err})
            continue
        capped = apply_cap(res, ctx["must_have_skills"])
        row = existing.get(cid) or Score(candidate_id=cid, job_id=job.id)
        row.overall_score, row.skill_match = res.overall_score, res.skill_match
        row.experience_match, row.education_match = res.experience_match, res.education_match
        row.details = {"matched_skills": res.matched_skills, "missing_skills": res.missing_skills, "strengths": res.strengths,
                       "concerns": res.concerns, "reasoning": res.reasoning, "capped": capped}
        db.add(row)
        existing[cid] = row
    db.commit()
    scores = sorted(existing.values(), key=lambda s: -s.overall_score)
    return ok({"scores": [score_out(s, by_id[s.candidate_id].name) for s in scores if s.candidate_id in by_id], "failed": failed})


@router.get("")
def list_scores(job_id: int, db: Session = Depends(get_db)):
    rows = db.execute(select(Score, Candidate.name).join(Candidate, Candidate.id == Score.candidate_id)
                      .where(Score.job_id == job_id).order_by(Score.overall_score.desc(), Score.candidate_id)).all()
    return ok([score_out(s, n) for s, n in rows])
