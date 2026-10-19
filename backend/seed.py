"""Demo data: one job + 8 fictional candidates (2 strong, 3 partial, 2 weak, 1 messy). Callum Reyes lacks one must-have (Spark)."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Candidate, Job

JOB_TITLE = "Lead Data Platform Engineer"
STRUCTURED = {"title": JOB_TITLE, "must_have_skills": ["Python", "SQL", "Airflow", "Spark", "dbt", "Data modeling"],
              "nice_to_have_skills": ["Kafka", "Terraform"], "min_experience_years": 5}
JD_TEXT = """# Lead Data Platform Engineer

## Role Summary
Vantage Logistics (fictional) is hiring a Lead Data Platform Engineer to own the pipelines behind our customer analytics product. You will work remotely in US time zones with a team of 12 engineers.

## Responsibilities
- Design, build and operate batch and streaming pipelines on AWS (S3, Glue, Redshift)
- Own data models that analysts and ML engineers rely on
- Orchestrate workflows in Airflow and transform data with Spark and dbt
- Add testing, monitoring and alerting to every production pipeline
- Mentor two mid-level engineers
- Partner with analysts and ML engineers to turn requirements into datasets
- Help move part of the platform to streaming

## Required Qualifications
- 5+ years in data engineering
- Strong Python and SQL
- Production experience with Airflow, Spark and dbt
- Strong data modeling skills

## Preferred Qualifications
- Kafka
- Terraform

## Skills
Python, SQL, Airflow, Spark, dbt, AWS, data modeling, Kafka, Terraform

## Equal Opportunity Statement
Vantage Logistics is an equal opportunity employer and welcomes applicants of all backgrounds.
"""


def _w(title, company, start, end, *h):
    return {"title": title, "company": company, "start": start, "end": end, "highlights": list(h)}


def _edu(d, i, y):
    return {"degree": d, "institution": i, "year": y}


CANDIDATES = [
    {"name": "Anika Rao", "email": "anika.rao@example.com", "phone": "+1 415 555 0142", "location": "Austin, TX",
     "total_experience_years": 8, "current_title": "Lead Data Platform Engineer",
     "skills": ["Python", "SQL", "Airflow", "Spark", "dbt", "AWS", "Glue", "Redshift", "Kafka", "Terraform", "Data modeling"],
     "education": [_edu("BSc Computer Science", "State University", "2016")],
     "work_history": [_w("Lead Data Platform Engineer", "Northwind Retail", "2021", "Present", "Led migration of 120 Airflow DAGs to Spark on Glue, cutting runtime 45%", "Introduced dbt tests and data-quality alerts", "Mentored 3 engineers"),
                      _w("Data Engineer", "Brightpath Health", "2016", "2021", "Built dimensional models in Redshift", "Owned Kafka ingestion")],
     "certifications": ["AWS Certified Data Analytics"], "projects": [], "summary": "Data engineer with 8 years building production pipelines on AWS."},
    {"name": "Callum Reyes", "email": "callum.reyes@example.com", "phone": "+1 312 555 0177", "location": "Chicago, IL",
     "total_experience_years": 7, "current_title": "Lead Analytics Engineer",
     "skills": ["Python", "SQL", "Airflow", "dbt", "Snowflake", "Data modeling", "Kafka", "Terraform"],
     "education": [_edu("BS Statistics", "Lakeshore University", "2017")],
     "work_history": [_w("Lead Analytics Engineer", "Harbor Logistics", "2020", "Present", "Designed a dimensional warehouse in Snowflake", "Runs 200+ dbt models with CI tests", "Manages 2 analytics engineers"),
                      _w("Data Engineer", "Quill Media", "2017", "2020", "Airflow pipelines in Python", "Kafka consumers for clickstream")],
     "certifications": [], "projects": [], "summary": "Analytics engineering lead; warehouse-centric (Snowflake) with no Spark experience stated."},
    {"name": "Mei Tanaka", "email": "mei.tanaka@example.com", "phone": None, "location": "Denver, CO",
     "total_experience_years": 4, "current_title": "Data Engineer", "skills": ["Python", "SQL", "Airflow", "Postgres", "Docker"],
     "education": [_edu("BS Information Systems", "Mesa College", "2020")],
     "work_history": [_w("Data Engineer", "Summit Insurance", "2021", "Present", "Maintains 30 Airflow DAGs", "Writes SQL transforms in Postgres"),
                      _w("Junior Analyst", "Summit Insurance", "2020", "2021", "Reporting in SQL")],
     "certifications": [], "projects": [], "summary": "Four years in data engineering on a smaller stack."},
    {"name": "Oliver Brandt", "email": "oliver.brandt@example.com", "phone": "+1 206 555 0109", "location": "Seattle, WA",
     "total_experience_years": 6, "current_title": "Software Engineer (Data Platform)", "skills": ["Python", "Java", "SQL", "Spark", "Kubernetes", "AWS"],
     "education": [_edu("MS Computer Science", "Cascade Tech", "2018")],
     "work_history": [_w("Software Engineer (Data Platform)", "Pinecrest Software", "2018", "Present", "Spark batch jobs on EMR", "Built internal ingestion service in Java")],
     "certifications": [], "projects": [], "summary": "Backend engineer who moved onto a data platform team; no Airflow or dbt shown."},
    {"name": "Zara Hussain", "email": "zara.hussain@example.com", "phone": None, "location": "Remote, US",
     "total_experience_years": 5, "current_title": "Analytics Engineer", "skills": ["SQL", "dbt", "Looker", "Data modeling", "BigQuery", "Python (basic)"],
     "education": [_edu("BA Economics", "Riverside College", "2019")],
     "work_history": [_w("Analytics Engineer", "Fernhill Retail", "2019", "Present", "Owns 150 dbt models", "Dimensional models in BigQuery")],
     "certifications": ["dbt Analytics Engineering Certification"], "projects": [],
     "summary": "Analytics engineer strong on modeling and dbt; light on orchestration and big-data processing."},
    {"name": "Noah Fischer", "email": "noah.fischer@example.com", "phone": None, "location": "Pune, India",
     "total_experience_years": 1.5, "current_title": "Junior Data Analyst", "skills": ["SQL", "Excel", "Python (coursework)", "Tableau"],
     "education": [_edu("BTech Information Technology", "Western Institute of Technology", "2023")],
     "work_history": [_w("Junior Data Analyst", "Orbit Consulting", "2023", "Present", "Weekly dashboards in Tableau")],
     "certifications": [], "projects": [{"name": "Sales dashboard", "description": "Tableau project from a course"}], "summary": "Early-career analyst."},
    {"name": "Ingrid Larsen", "email": "ingrid.larsen@example.com", "phone": "+1 612 555 0191", "location": "Minneapolis, MN",
     "total_experience_years": 10, "current_title": "Database Administrator", "skills": ["SQL Server", "T-SQL", "SSIS", "Oracle", "Backup and recovery"],
     "education": [_edu("BS Information Technology", "Northern State", "2014")],
     "work_history": [_w("Database Administrator", "Granite Bank", "2014", "Present", "Administers SQL Server clusters", "SSIS ETL packages")],
     "certifications": ["Microsoft Certified: Azure Database Administrator Associate"], "projects": [],
     "summary": "Ten years as a DBA; traditional ETL, no Python or modern stack shown."},
    {"name": "Luca Moretti", "email": None, "phone": "555.0133", "location": None, "total_experience_years": None, "current_title": None,
     "skills": ["python", "sql", "spark?", "etl"], "education": [], "work_history": [_w(None, "various startups", None, None, "did data stuff")],
     "certifications": [], "projects": [], "summary": None},
]

RAW_MESSY = """LUCA MORETTI   tel 555.0133
~~ about me ~~
data guy. 6ish yrs?? startups mostly. did ETL + dashboards, some spark (i think v2) maybe airflow once
SKILLS: python / sql / spark? / etl / "pipelines"
exp: various startups 2017-now (freelance gaps) - did data stuff
edu: -- see linkedin --
"""


def render_resume(c: dict) -> str:
    if c["name"] == "Luca Moretti":
        return RAW_MESSY
    lines = [c["name"], c["email"] or "", c["phone"] or "", c["location"] or "", "", c["summary"] or "", "",
             "SKILLS: " + ", ".join(c["skills"]), "", "EXPERIENCE"]
    for w in c["work_history"]:
        lines.append(f"{w['title']} - {w['company']} ({w['start']}-{w['end']})")
        lines += [f"  * {h}" for h in w["highlights"]]
    lines += ["", "EDUCATION"] + [f"{e['degree']}, {e['institution']} {e['year']}" for e in c["education"]]
    if c["certifications"]:
        lines += ["", "CERTIFICATIONS"] + c["certifications"]
    return "\n".join(lines)


def load_seed(db: Session) -> dict:
    job = db.scalars(select(Job).where(Job.title == JOB_TITLE)).first()
    if job is None:
        job = Job(title=JOB_TITLE, jd_text=JD_TEXT, structured=STRUCTURED)
        db.add(job)
        db.flush()
    for other in db.scalars(select(Job).where(Job.id != job.id, Job.is_active)):
        other.is_active = False
    job.is_active = True
    existing = {c.name for c in db.scalars(select(Candidate))}
    added = 0
    for c in CANDIDATES:
        if c["name"] not in existing:
            db.add(Candidate(name=c["name"], email=c["email"], source_filename="seed", parsed_json=c, raw_text=render_resume(c)))
            added += 1
    db.commit()
    return {"job_id": job.id, "candidates_added": added, "candidates_total": len(CANDIDATES)}
