from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from db import get_db
from errors import AppError, ok
from models import Job
from schemas import BiasCheckIn, BiasLLM, JDLLM, JDStructured, JobGenerateIn, JobSaveIn
from serializers import job_out
from services import llm, prompts

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _b(items):
    return "\n".join(f"- {i}" for i in items)


def assemble_jd(jd: JDLLM, title: str) -> str:
    s = [f"# {title}", "## Role Summary\n" + jd.role_summary, "## Responsibilities\n" + _b(jd.responsibilities),
         "## Required Qualifications\n" + _b(jd.required_qualifications)]
    if jd.preferred_qualifications:
        s.append("## Preferred Qualifications\n" + _b(jd.preferred_qualifications))
    s.append("## Skills\n" + (", ".join(jd.skills) or ", ".join(jd.must_have_skills + jd.nice_to_have_skills)))
    s.append("## Equal Opportunity Statement\n" + jd.eeo_statement)
    return "\n\n".join(s)


@router.post("/generate")
def generate(body: JobGenerateIn):
    brief = body.brief.model_dump(exclude_none=True)
    jd = llm.call_llm(prompts.JD_SYSTEM, "Hiring brief:\n" + prompts.dumps(brief), JDLLM, temperature=0.4)
    title = jd.title or body.brief.title
    st = JDStructured(**jd.model_dump(include=set(JDStructured.model_fields)))
    return ok({"jd_text": assemble_jd(jd, title), "structured": st.model_dump()})


@router.post("/bias-check")
def bias_check(body: BiasCheckIn):
    res = llm.call_llm(prompts.BIAS_SYSTEM, "Job description:\n\n" + body.jd_text, BiasLLM, max_tokens=2048)
    low = body.jd_text.lower()
    return ok({"flags": [f.model_dump() for f in res.flags if f.phrase.strip() and f.phrase.lower() in low]})


@router.post("")
def save_job(body: JobSaveIn, db: Session = Depends(get_db)):
    st = body.structured.model_dump() if isinstance(body.structured, JDStructured) else dict(body.structured)
    title = body.title or st.get("title")
    if not title:
        raise AppError("A job title is required.", code="validation_error", status=422)
    db.execute(update(Job).values(is_active=False))
    job = Job(title=title, jd_text=body.jd_text, structured=st, is_active=True)
    db.add(job)
    db.commit()
    return ok(job_out(job))


@router.get("/active")
def active_job(db: Session = Depends(get_db)):
    job = db.scalars(select(Job).where(Job.is_active).order_by(Job.id.desc())).first()
    return ok(job_out(job) if job else None)
