from models import Candidate, Email, Job, Score, ShortlistDecision


def _iso(dt):
    return dt.isoformat() if dt else None


def job_out(j: Job) -> dict:
    return {"id": j.id, "title": j.title, "jd_text": j.jd_text, "structured": j.structured or {},
            "is_active": j.is_active, "created_at": _iso(j.created_at)}


def score_out(s: Score, candidate_name: str | None = None) -> dict:
    d = s.details or {}
    return {"id": s.id, "candidate_id": s.candidate_id, "candidate_name": candidate_name, "job_id": s.job_id,
            "overall_score": s.overall_score, "skill_match": s.skill_match, "experience_match": s.experience_match,
            "education_match": s.education_match, "matched_skills": d.get("matched_skills", []),
            "missing_skills": d.get("missing_skills", []), "strengths": d.get("strengths", []),
            "concerns": d.get("concerns", []), "reasoning": d.get("reasoning", ""), "capped": d.get("capped", False),
            "updated_at": _iso(s.updated_at)}


def decision_out(d: ShortlistDecision) -> dict:
    return {"id": d.id, "candidate_id": d.candidate_id, "job_id": d.job_id, "decision": d.decision,
            "note": d.note, "updated_at": _iso(d.updated_at)}


def candidate_out(c: Candidate, score: Score | None = None, decision: ShortlistDecision | None = None) -> dict:
    out = {"id": c.id, "name": c.name, "email": c.email, "source_filename": c.source_filename,
           "parsed": c.parsed_json or {}, "created_at": _iso(c.created_at)}
    if score is not None:
        out["score"] = score_out(score, c.name)
    if decision is not None:
        out["decision"] = decision.decision
    return out


def email_out(e: Email) -> dict:
    return {"id": e.id, "candidate_id": e.candidate_id, "job_id": e.job_id, "type": e.type, "tone": e.tone,
            "to_email": e.to_email, "subject": e.subject, "body": e.body, "status": e.status,
            "created_at": _iso(e.created_at), "sent_at": _iso(e.sent_at)}
