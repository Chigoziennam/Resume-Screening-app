"""
Algorithmic Scoring Engine for Resume-Job Matching
Calculates transparent match scores using weighted rubric.
No AI involved in scoring — only deterministic rules.
"""

import re
from typing import Dict, List, Tuple

WEIGHTS = {
    "skills_required": 0.35,
    "skills_preferred": 0.10,
    "experience": 0.25,
    "education": 0.15,
    "keywords": 0.15,
}

DEGREE_LEVELS = {
    "phd": 5, "doctorate": 5, "ph.d": 5,
    "master": 4, "msc": 4, "mba": 4, "m.sc": 4, "ma": 4,
    "bachelor": 3, "bsc": 3, "b.sc": 3, "ba": 3, "b.a": 3, "b.eng": 3,
    "associate": 2, "diploma": 2, "hnd": 2, "ond": 1,
    "certificate": 1, "certification": 1,
}

SKILL_ALIASES = {
    "javascript": ["js", "es6", "es2015", "ecmascript"],
    "typescript": ["ts"],
    "python": ["py", "python3"],
    "react": ["reactjs", "react.js"],
    "node": ["nodejs", "node.js"],
    "nextjs": ["next", "next.js"],
    "postgresql": ["postgres", "psql"],
    "mongodb": ["mongo"],
    "aws": ["amazon web services"],
    "gcp": ["google cloud"],
    "css": ["css3", "cascading style sheets"],
    "html": ["html5"],
    "ml": ["machine learning"],
    "ai": ["artificial intelligence"],
    "nlp": ["natural language processing"],
    "sql": ["mysql", "sqlite", "mssql"],
    "c#": ["csharp"],
    "c++": ["cpp"],
}


def normalize(s: str) -> str:
    return re.sub(r"[^a-z0-9+#]", "", s.lower()).strip()


def fuzzy_match(a: str, b: str) -> bool:
    na, nb = normalize(a), normalize(b)
    if na == nb:
        return True
    if na in nb or nb in na:
        return True
    for key, vals in SKILL_ALIASES.items():
        group = [key] + vals
        if na in group and nb in group:
            return True
    return False


def match_skills(candidate_skills: List[str], required: List[str]) -> Tuple[List[str], List[str]]:
    matched, missing = [], []
    for req in required:
        if any(fuzzy_match(cs, req) for cs in candidate_skills):
            matched.append(req)
        else:
            missing.append(req)
    return matched, missing


def estimate_years(experience: List[Dict]) -> int:
    total = 0
    for exp in experience:
        dates = exp.get("dates", "")
        years = re.findall(r"(\d{4})", dates)
        if len(years) >= 2:
            diff = abs(int(years[-1]) - int(years[0]))
            total += diff or 1
        elif "present" in dates.lower() or "current" in dates.lower():
            start = re.search(r"(\d{4})", dates)
            if start:
                from datetime import datetime
                total += datetime.now().year - int(start.group(1))
            else:
                total += 1
        else:
            total += 1
    return total


def get_degree_level(education: List[Dict]) -> Dict:
    highest = {"level": 0, "degree": "None", "field": ""}
    for edu in education:
        combined = f"{edu.get('degree', '')} {edu.get('field', '')}".lower()
        for key, level in DEGREE_LEVELS.items():
            if key in combined and level > highest["level"]:
                highest = {"level": level, "degree": edu.get("degree", ""), "field": edu.get("field", "")}
    return highest


def get_required_degree_level(req: str) -> int:
    lower = req.lower()
    for key, level in DEGREE_LEVELS.items():
        if key in lower:
            return level
    return 0


def match_keywords(resume_text: str, keywords: List[str]) -> List[str]:
    lower = resume_text.lower()
    return [kw for kw in keywords if kw.lower() in lower]


def get_grade(score: int) -> str:
    if score >= 90: return "Excellent Match"
    if score >= 75: return "Strong Match"
    if score >= 60: return "Good Match"
    if score >= 45: return "Moderate Match"
    if score >= 30: return "Weak Match"
    return "Poor Match"


def score_resume(resume_data: Dict, job_requirements: Dict) -> Dict:
    all_skills = (
        resume_data.get("skills", {}).get("technical", []) +
        resume_data.get("skills", {}).get("tools", []) +
        resume_data.get("skills", {}).get("soft", [])
    )

    req_skills = job_requirements.get("requiredSkills", [])
    req_matched, req_missing = match_skills(all_skills, req_skills)
    req_score = (len(req_matched) / len(req_skills) * 100) if req_skills else 100

    pref_skills = job_requirements.get("preferredSkills", [])
    pref_matched, _ = match_skills(all_skills, pref_skills)
    pref_score = (len(pref_matched) / len(pref_skills) * 100) if pref_skills else 100

    candidate_years = estimate_years(resume_data.get("experience", []))
    required_years = job_requirements.get("minExperienceYears", 0)
    relevant_roles = [
        e.get("title", "") for e in resume_data.get("experience", [])
        if fuzzy_match(e.get("title", ""), job_requirements.get("title", ""))
        or any(k.lower() in e.get("title", "").lower() for k in job_requirements.get("keywords", []))
    ]

    if required_years <= 0:
        exp_score = 100
    elif candidate_years >= required_years:
        exp_score = 100
    else:
        exp_score = (candidate_years / required_years) * 100
    if relevant_roles:
        exp_score = min(100, exp_score + 15)

    candidate_deg = get_degree_level(resume_data.get("education", []))
    req_deg_level = get_required_degree_level(job_requirements.get("requiredEducation", ""))
    meets_req = candidate_deg["level"] >= req_deg_level
    req_fields = job_requirements.get("requiredField", [])
    field_match = len(req_fields) == 0 or any(
        candidate_deg["field"].lower() in f.lower() or f.lower() in candidate_deg["field"].lower()
        for f in req_fields
    )

    if meets_req and field_match:
        edu_score = 100
    elif meets_req:
        edu_score = 75
    elif candidate_deg["level"] > 0:
        edu_score = 40
    else:
        edu_score = 0

    resume_text = " ".join([
        resume_data.get("candidate", {}).get("summary", ""),
        *all_skills,
        *[f"{e.get('title', '')} {e.get('company', '')} {' '.join(e.get('highlights', []))}"
          for e in resume_data.get("experience", [])]
    ])
    kw_matched = match_keywords(resume_text, job_requirements.get("keywords", []))
    kw_total = len(job_requirements.get("keywords", []))
    kw_score = (len(kw_matched) / kw_total * 100) if kw_total else 100

    overall = round(
        req_score * WEIGHTS["skills_required"] +
        pref_score * WEIGHTS["skills_preferred"] +
        exp_score * WEIGHTS["experience"] +
        edu_score * WEIGHTS["education"] +
        kw_score * WEIGHTS["keywords"]
    )

    return {
        "skills_required": {
            "score": round(req_score), "weight": WEIGHTS["skills_required"],
            "matched": req_matched, "missing": req_missing, "total": len(req_skills)
        },
        "skills_preferred": {
            "score": round(pref_score), "weight": WEIGHTS["skills_preferred"],
            "matched": pref_matched, "total": len(pref_skills)
        },
        "experience": {
            "score": round(exp_score), "weight": WEIGHTS["experience"],
            "candidate_years": candidate_years, "required_years": required_years,
            "relevant_roles": relevant_roles
        },
        "education": {
            "score": round(edu_score), "weight": WEIGHTS["education"],
            "meets_requirement": meets_req, "field_match": field_match,
            "candidate_degree": candidate_deg["degree"], "candidate_field": candidate_deg["field"]
        },
        "keywords": {
            "score": round(kw_score), "weight": WEIGHTS["keywords"],
            "matched": kw_matched, "total": kw_total
        },
        "overall": overall,
        "grade": get_grade(overall),
    }
