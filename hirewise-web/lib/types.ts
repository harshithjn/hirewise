export type Job = {
  id: number; title: string; jd_text: string; is_active: boolean;
  structured: { title?: string; must_have_skills?: string[]; nice_to_have_skills?: string[]; min_experience_years?: number };
};
export type Parsed = {
  name: string | null; email: string | null; phone: string | null; location: string | null;
  total_experience_years: number | null; current_title: string | null; skills: string[];
  education: { degree: string | null; institution: string | null; year: string | null }[];
  work_history: { title: string | null; company: string | null; start: string | null; end: string | null; highlights: string[] }[];
  certifications: string[]; projects: { name: string | null; description: string | null }[]; summary: string | null;
};
export type Score = {
  id: number; candidate_id: number; candidate_name: string | null; job_id: number;
  overall_score: number; skill_match: number; experience_match: number; education_match: number;
  matched_skills: string[]; missing_skills: string[]; strengths: string[]; concerns: string[];
  reasoning: string; capped: boolean;
};
export type Decision = "shortlisted" | "rejected" | "hold" | "undecided";
export type Candidate = {
  id: number; name: string | null; email: string | null; source_filename: string | null; parsed: Parsed;
  score?: Score; decision?: Decision;
};
export type ParseResult = {
  candidates: Candidate[];
  failed: { filename: string; reason: string }[];
  duplicates: { filename: string; name: string | null; email: string | null; duplicate_of: number }[];
  warnings: string[];
};
export type Question = { question: string; what_it_tests: string; ideal_answer_points: string[]; red_flags: string[] };
export type Kit = { technical: Question[]; behavioral: Question[]; gap_probing: Question[] };
export type EmailRec = {
  id: number; candidate_id: number; type: string; tone: string; to_email: string | null;
  subject: string; body: string; status: string;
};
export type ChatMsg = { role: "user" | "assistant"; content: string };
