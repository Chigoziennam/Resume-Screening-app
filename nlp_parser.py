"""
NLP-based Resume Parser
Uses regex patterns and heuristics for text extraction,
combined with LLM (GPT-4o-mini) for semantic analysis.
"""

import re
import os
from typing import Dict, List, Optional
from openai import OpenAI
import json


def _get_api_key() -> Optional[str]:
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        try:
            import streamlit as st
            key = st.secrets.get("OPENROUTER_API_KEY")
        except Exception:
            pass
    return key


def extract_email(text: str) -> Optional[str]:
    match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
    return match.group(0) if match else None


def extract_phone(text: str) -> Optional[str]:
    match = re.search(r"[\+]?[\d\s\-\(\)]{10,}", text)
    return match.group(0).strip() if match else None


def extract_skills_nlp(text: str) -> Dict[str, List[str]]:
    technical_keywords = [
        "python", "java", "javascript", "typescript", "c++", "c#", "ruby", "go", "rust",
        "swift", "kotlin", "php", "html", "css", "sql", "r", "matlab", "scala",
        "react", "angular", "vue", "next.js", "node.js", "express", "django", "flask",
        "spring", "laravel", ".net", "tensorflow", "pytorch", "keras", "scikit-learn",
        "pandas", "numpy", "opencv", "docker", "kubernetes", "aws", "azure", "gcp",
        "git", "linux", "mongodb", "postgresql", "mysql", "redis", "elasticsearch",
        "graphql", "rest api", "microservices", "ci/cd", "jenkins", "terraform",
        "machine learning", "deep learning", "nlp", "computer vision", "data science",
        "artificial intelligence", "blockchain", "cloud computing", "devops",
        "supabase", "firebase", "vercel", "netlify", "heroku", "streamlit",
        "power bi", "tableau", "excel", "spss", "sas",
    ]
    soft_keywords = [
        "leadership", "communication", "teamwork", "problem solving", "critical thinking",
        "time management", "adaptability", "creativity", "collaboration", "presentation",
        "project management", "analytical", "decision making", "mentoring", "negotiation",
    ]
    tool_keywords = [
        "vs code", "visual studio", "intellij", "eclipse", "xcode", "android studio",
        "figma", "sketch", "photoshop", "illustrator", "jira", "confluence", "slack",
        "trello", "notion", "postman", "swagger", "github", "gitlab", "bitbucket",
    ]

    text_lower = text.lower()
    technical = [kw for kw in technical_keywords if kw in text_lower]
    soft = [kw for kw in soft_keywords if kw in text_lower]
    tools = [kw for kw in tool_keywords if kw in text_lower]

    return {"technical": technical, "soft": soft, "tools": tools}


def extract_education_nlp(text: str) -> List[Dict]:
    education = []
    degree_patterns = [
        r"(Ph\.?D|Doctorate|Doctor of)\s*(?:in|of)?\s*([\w\s]+?)(?:\s*[,\-|]|\s*\d{4}|\n)",
        r"(Master(?:'s)?|M\.?S\.?c?\.?|M\.?B\.?A\.?|M\.?A\.?)\s*(?:in|of)?\s*([\w\s]+?)(?:\s*[,\-|]|\s*\d{4}|\n)",
        r"(Bachelor(?:'s)?|B\.?S\.?c?\.?|B\.?A\.?|B\.?Eng\.?)\s*(?:in|of)?\s*([\w\s]+?)(?:\s*[,\-|]|\s*\d{4}|\n)",
        r"(HND|OND|Diploma|Certificate)\s*(?:in|of)?\s*([\w\s]+?)(?:\s*[,\-|]|\s*\d{4}|\n)",
    ]
    for pattern in degree_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            degree = match.group(1).strip()
            field = match.group(2).strip()[:50]
            education.append({"degree": degree, "field": field, "institution": "", "year": ""})

    return education


def parse_with_llm(text: str) -> Optional[Dict]:
    api_key = _get_api_key()
    if not api_key:
        return None

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

    prompt = """You are an expert resume parser and career advisor. Analyze the following resume text and extract structured information.

Return a JSON object with EXACTLY this structure (no markdown, no code fences, just raw JSON):
{
  "candidate": {
    "name": "Full name or 'Not detected'",
    "email": "Email or null",
    "phone": "Phone number or null",
    "location": "City/Country or null",
    "linkedin": "LinkedIn URL or null",
    "summary": "A 2-3 sentence professional summary of this candidate"
  },
  "education": [
    {
      "degree": "Degree name",
      "field": "Field of study",
      "institution": "School name",
      "year": "Graduation year or date range"
    }
  ],
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "dates": "Employment dates",
      "highlights": ["Key achievement 1", "Key achievement 2"]
    }
  ],
  "skills": {
    "technical": ["skill1", "skill2"],
    "soft": ["skill1", "skill2"],
    "tools": ["tool1", "tool2"]
  },
  "jobCategory": "The most fitting job category (e.g. Software Engineering, Data Science, Marketing, Finance, Healthcare, etc.)",
  "recommendations": [
    {
      "title": "Recommended job title",
      "reason": "Brief reason why this role fits",
      "matchScore": 85
    }
  ],
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["suggestion1", "suggestion2"]
}

Resume text:
""" + text[:8000]

    try:
        completion = client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=4000,
        )
        content = completion.choices[0].message.content or ""
        json_match = re.search(r"\{[\s\S]*\}", content)
        return json.loads(json_match.group(0) if json_match else content)
    except Exception:
        return None


def parse_job_description_llm(job_desc: str) -> Optional[Dict]:
    api_key = _get_api_key()
    if not api_key:
        return None

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

    prompt = """You are a job requirements parser. Extract structured requirements from the following job description.

Return ONLY a JSON object with this exact structure (no markdown, no fences):
{
  "title": "The job title",
  "requiredSkills": ["skill1", "skill2"],
  "preferredSkills": ["skill1", "skill2"],
  "minExperienceYears": 3,
  "requiredEducation": "Bachelor's degree or equivalent",
  "requiredField": ["Computer Science", "Software Engineering"],
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Rules:
- requiredSkills: skills explicitly stated as required or must-have
- preferredSkills: skills listed as nice-to-have, preferred, or bonus
- minExperienceYears: minimum years mentioned (0 if not specified)
- requiredEducation: degree level required (empty string if not specified)
- requiredField: fields of study mentioned (empty array if not specified)
- keywords: important domain terms, technologies, and concepts from the description

Job description:
""" + job_desc[:4000]

    try:
        completion = client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=2000,
        )
        content = completion.choices[0].message.content or ""
        json_match = re.search(r"\{[\s\S]*\}", content)
        return json.loads(json_match.group(0) if json_match else content)
    except Exception:
        return None
