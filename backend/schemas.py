from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator


def _none_to_list(v):
    return [] if v is None else v


def _round_int(v):
    return round(v) if isinstance(v, float) else v


NullList = Annotated[list, BeforeValidator(_none_to_list)]
Pct = Annotated[int, BeforeValidator(_round_int), Field(ge=0, le=100)]


class Brief(BaseModel):
    title: str = Field(min_length=1)
    department: str | None = None
    experience_min_years: int | None = Field(default=None, ge=0, le=50)
    experience_max_years: int | None = Field(default=None, ge=0, le=50)
    location: str | None = None
    employment_type: str | None = "Full-time"
    must_have: list[str] = []
    nice_to_have: list[str] = []
    notes: str | None = None


class JobGenerateIn(BaseModel):
    brief: Brief


class JDStructured(BaseModel):
    title: str
    must_have_skills: list[str]
    nice_to_have_skills: list[str] = []
    min_experience_years: int = Field(ge=0, le=50)


class JDLLM(JDStructured):
    role_summary: str
    responsibilities: list[str] = Field(min_length=6, max_length=8)
    required_qualifications: list[str] = Field(min_length=1)
    preferred_qualifications: list[str] = []
    skills: list[str] = []
    eeo_statement: str


class BiasCheckIn(BaseModel):
    jd_text: str = Field(min_length=20)


class BiasFlag(BaseModel):
    phrase: str
    suggestion: str


class BiasLLM(BaseModel):
    flags: list[BiasFlag] = []


class JobSaveIn(BaseModel):
    title: str | None = None
    jd_text: str = Field(min_length=1)
    structured: JDStructured | dict = {}


class EducationItem(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)
    degree: str | None = None
    institution: str | None = None
    year: str | None = None


class WorkItem(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)
    title: str | None = None
    company: str | None = None
    start: str | None = None
    end: str | None = None
    highlights: NullList = []


class ProjectItem(BaseModel):
    name: str | None = None
    description: str | None = None


def _coerce_project(v):
    return {"name": v} if isinstance(v, str) else v


def _coerce_cert(v):
    return " - ".join(str(x) for x in v.values() if x) if isinstance(v, dict) else v


class ParsedResume(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    total_experience_years: float | None = Field(default=None, ge=0, le=60)
    current_title: str | None = None
    skills: NullList = []
    education: list[EducationItem] = []
    work_history: list[WorkItem] = []
    certifications: Annotated[list[str], BeforeValidator(lambda v: [_coerce_cert(x) for x in _none_to_list(v)])] = []
    projects: Annotated[list[ProjectItem], BeforeValidator(lambda v: [_coerce_project(x) for x in _none_to_list(v)])] = []
    summary: str | None = None

    @field_validator("education", "work_history", mode="before")
    @classmethod
    def _lists(cls, v):
        return _none_to_list(v)


class ScoreRunIn(BaseModel):
    job_id: int


class ScoreLLM(BaseModel):
    overall_score: Pct
    skill_match: Pct
    experience_match: Pct
    education_match: Pct
    matched_skills: NullList = []
    missing_skills: NullList = []
    strengths: NullList = []
    concerns: NullList = []
    reasoning: str

    @field_validator("strengths", "concerns")
    @classmethod
    def _max3(cls, v):
        return v[:3]


class DecisionIn(BaseModel):
    candidate_id: int
    decision: Literal["shortlisted", "rejected", "hold", "undecided"]
    job_id: int | None = None
    note: str | None = None


class CompareIn(BaseModel):
    job_id: int
    top_n: int = Field(default=3, ge=2, le=10)


class Counts(BaseModel):
    technical: int = Field(default=4, ge=0, le=10)
    behavioral: int = Field(default=3, ge=0, le=10)
    gap_probing: int = Field(default=3, ge=0, le=10)


class InterviewIn(BaseModel):
    candidate_id: int
    job_id: int
    level: Literal["junior", "mid", "senior", "lead"] = "senior"
    counts: Counts = Counts()


class InterviewQuestion(BaseModel):
    question: str
    what_it_tests: str
    ideal_answer_points: list[str] = Field(min_length=3)
    red_flags: NullList = []

    @field_validator("ideal_answer_points")
    @classmethod
    def _max4(cls, v):
        return v[:4]


class InterviewKitLLM(BaseModel):
    technical: list[InterviewQuestion] = []
    behavioral: list[InterviewQuestion] = []
    gap_probing: list[InterviewQuestion] = []


class RegenerateIn(BaseModel):
    candidate_id: int
    job_id: int
    level: Literal["junior", "mid", "senior", "lead"] = "senior"
    category: Literal["technical", "behavioral", "gap_probing"]
    current_question: str
    avoid: list[str] = []


class EmailIn(BaseModel):
    candidate_id: int
    job_id: int | None = None
    type: Literal["invite", "update", "rejection", "offer_followup"]
    tone: Literal["formal", "friendly"] = "friendly"
    recruiter: str = Field(min_length=1)
    company: str = Field(min_length=1)


class EmailLLM(BaseModel):
    subject: str = Field(min_length=1)
    body: str = Field(min_length=1)


class SendIn(BaseModel):
    email_id: int
    subject: str | None = None
    body: str | None = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    job_id: int | None = None


class ReportIn(BaseModel):
    job_id: int
