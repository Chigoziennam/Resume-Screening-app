"""
Resume Screening Application
Hybrid System: NLP extraction + ML classification + LLM semantic analysis + Algorithmic scoring
Built with Streamlit, scikit-learn, and GPT-4o-mini
"""

import streamlit as st
import pdfplumber
from docx import Document
import os
import json
from io import BytesIO

from nlp_parser import (
    extract_email, extract_phone, extract_skills_nlp,
    extract_education_nlp, parse_with_llm, parse_job_description_llm
)
from ml_classifier import get_classifier
from scorer import score_resume

st.set_page_config(
    page_title="Resume Screening App",
    page_icon="📄",
    layout="wide",
)

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    .main-header { text-align: center; padding: 2rem 0 2.5rem; }
    .main-header h1 {
        font-family: 'Inter', sans-serif; font-size: 3.2rem; font-weight: 800;
        background: linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #818cf8 100%);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        margin-bottom: 0.5rem; letter-spacing: -1px;
    }
    .main-header p { color: #9ca3af; font-size: 1.05rem; font-family: 'Inter', sans-serif; }
    .badge {
        display: inline-block; padding: 6px 16px; border-radius: 50px;
        background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2);
        color: #a5b4fc; font-size: 0.75rem; letter-spacing: 2px; text-transform: uppercase;
        margin-bottom: 1rem; font-family: 'Inter', sans-serif;
    }
    .skill-tag {
        display: inline-block; padding: 5px 14px; margin: 3px;
        border-radius: 20px; font-size: 0.82rem; font-family: 'Inter', sans-serif;
        border: 1px solid transparent; transition: all 0.2s;
    }
    .tech-tag { background: rgba(99,102,241,0.12); color: #a5b4fc; border-color: rgba(99,102,241,0.15); }
    .soft-tag { background: rgba(245,158,11,0.12); color: #fcd34d; border-color: rgba(245,158,11,0.15); }
    .tool-tag { background: rgba(16,185,129,0.12); color: #6ee7b7; border-color: rgba(16,185,129,0.15); }
    .match-tag {
        display: inline-block; padding: 3px 12px; margin: 2px;
        border-radius: 14px; font-size: 0.78rem; font-family: 'Inter', sans-serif;
    }
    .match-yes { background: rgba(16,185,129,0.12); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.2); }
    .match-no { background: rgba(239,68,68,0.12); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }
    .section-card {
        background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
        border-radius: 16px; padding: 1.5rem; margin-bottom: 1rem;
        backdrop-filter: blur(10px);
    }
    .grade-badge {
        display: inline-block; padding: 8px 20px; border-radius: 12px;
        font-size: 1.1rem; font-weight: 700; font-family: 'Inter', sans-serif;
    }
    .grade-excellent { background: rgba(16,185,129,0.15); color: #6ee7b7; }
    .grade-good { background: rgba(245,158,11,0.15); color: #fcd34d; }
    .grade-poor { background: rgba(239,68,68,0.15); color: #fca5a5; }
    div[data-testid="stFileUploader"] {
        border: 2px dashed rgba(99,102,241,0.3); border-radius: 16px; padding: 1.2rem;
        background: rgba(99,102,241,0.03); transition: all 0.3s;
    }
    div[data-testid="stFileUploader"]:hover { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.06); }
    .stMetric { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 0.8rem; }
    section[data-testid="stSidebar"] { background: #0d0d1a; border-right: 1px solid rgba(255,255,255,0.06); }
    h2, h3 { font-family: 'Inter', sans-serif !important; }
    .stButton>button[kind="primary"] {
        background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
        border: none !important; font-weight: 600 !important; letter-spacing: 0.5px;
        border-radius: 12px !important; padding: 0.6rem 2rem !important;
    }
    .stButton>button[kind="primary"]:hover {
        background: linear-gradient(135deg, #818cf8, #a78bfa) !important;
        box-shadow: 0 4px 20px rgba(99,102,241,0.3) !important;
    }
</style>
""", unsafe_allow_html=True)


def extract_text_from_pdf(file) -> str:
    try:
        with pdfplumber.open(file) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception as e:
        st.error(f"PDF extraction failed: {e}")
        return ""


def extract_text_from_docx(file) -> str:
    try:
        doc = Document(file)
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception as e:
        st.error(f"DOCX extraction failed: {e}")
        return ""


def clean_text(text: str) -> str:
    import re
    text = re.sub(r"http\S+|www\S+", " ", text)
    text = re.sub(r"[^\x00-\x7F]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def display_skills(skills: dict):
    for category, items in skills.items():
        if items:
            label = {"technical": "Technical", "soft": "Soft Skills", "tools": "Tools & Platforms"}.get(category, category)
            css_class = {"technical": "tech-tag", "soft": "soft-tag", "tools": "tool-tag"}.get(category, "tech-tag")
            st.markdown(f"**{label}**")
            tags = " ".join(f'<span class="skill-tag {css_class}">{s}</span>' for s in items)
            st.markdown(tags, unsafe_allow_html=True)
            st.write("")


def display_score_bar(label: str, score: int, weight: float, color: str):
    col1, col2, col3 = st.columns([3, 1, 1])
    with col1:
        st.markdown(f"**{label}**")
    with col2:
        st.caption(f"{round(weight*100)}% weight")
    with col3:
        if score >= 75:
            st.markdown(f"<span style='color:#6ee7b7;font-weight:700'>{score}%</span>", unsafe_allow_html=True)
        elif score >= 50:
            st.markdown(f"<span style='color:#fcd34d;font-weight:700'>{score}%</span>", unsafe_allow_html=True)
        else:
            st.markdown(f"<span style='color:#fca5a5;font-weight:700'>{score}%</span>", unsafe_allow_html=True)
    st.progress(score / 100)


# ===== MAIN APP =====
st.markdown("""
<div class="main-header">
    <span class="badge">● Hybrid AI Resume Screening</span>
    <h1>Resume Intelligence</h1>
    <p>Upload resumes for instant analysis — NLP extraction, ML classification, and transparent job matching</p>
</div>
""", unsafe_allow_html=True)

uploaded_files = st.file_uploader(
    "Upload Resume(s)",
    type=["pdf", "docx"],
    accept_multiple_files=True,
    help="Drop PDF or DOCX resumes here"
)

if uploaded_files:
    if st.button("🔍 Analyze Resumes", type="primary", use_container_width=True):
        results = []
        progress = st.progress(0, text="Starting analysis...")

        for idx, file in enumerate(uploaded_files):
            progress.progress((idx) / len(uploaded_files), text=f"Analyzing {file.name}...")

            if file.name.lower().endswith(".pdf"):
                raw_text = extract_text_from_pdf(BytesIO(file.read()))
            elif file.name.lower().endswith(".docx"):
                raw_text = extract_text_from_docx(BytesIO(file.read()))
            else:
                continue

            if not raw_text.strip():
                results.append({"file": file.name, "error": "Could not extract text"})
                continue

            text = clean_text(raw_text)

            nlp_skills = extract_skills_nlp(text)
            nlp_education = extract_education_nlp(text)
            email = extract_email(text)
            phone = extract_phone(text)

            classifier = get_classifier()
            ml_result = classifier.classify(text)

            llm_result = parse_with_llm(text)

            if llm_result:
                result = llm_result
                result["ml_classification"] = ml_result
                if not result.get("skills", {}).get("technical"):
                    result["skills"] = nlp_skills
            else:
                result = {
                    "candidate": {"name": "Not detected", "email": email, "phone": phone, "location": None, "linkedin": None, "summary": ""},
                    "education": nlp_education,
                    "experience": [],
                    "skills": nlp_skills,
                    "jobCategory": ml_result["predicted_category"],
                    "recommendations": [],
                    "strengths": [],
                    "improvements": [],
                    "ml_classification": ml_result,
                }

            results.append({"file": file.name, "data": result, "raw_text": text})

        progress.progress(1.0, text="Analysis complete!")
        st.session_state["results"] = results

if "results" in st.session_state and st.session_state["results"]:
    results = st.session_state["results"]

    if len(results) > 1:
        tabs = st.tabs([r.get("file", f"Resume {i+1}") for i, r in enumerate(results)])
    else:
        tabs = [st.container()]

    for i, (tab, res) in enumerate(zip(tabs, results)):
        with tab:
            if "error" in res:
                st.error(f"Error: {res['error']}")
                continue

            data = res["data"]
            candidate = data.get("candidate", {})
            skills = data.get("skills", {})
            total_skills = len(skills.get("technical", [])) + len(skills.get("soft", [])) + len(skills.get("tools", []))

            # Metrics row
            c1, c2, c3, c4 = st.columns(4)
            with c1:
                st.metric("Skills Found", total_skills)
            with c2:
                st.metric("Experience", f"{len(data.get('experience', []))} roles")
            with c3:
                st.metric("Education", len(data.get("education", [])))
            with c4:
                ml = data.get("ml_classification", {})
                st.metric("ML Confidence", f"{ml.get('confidence', 0)}%")

            # Candidate Profile
            st.subheader("👤 Candidate Profile")
            col1, col2 = st.columns(2)
            with col1:
                st.write(f"**Name:** {candidate.get('name', 'Not detected')}")
                st.write(f"**Email:** {candidate.get('email') or 'Not detected'}")
                st.write(f"**Phone:** {candidate.get('phone') or 'Not detected'}")
            with col2:
                st.write(f"**Location:** {candidate.get('location') or 'Not detected'}")
                if candidate.get("linkedin"):
                    st.write(f"**LinkedIn:** {candidate['linkedin']}")
            if candidate.get("summary"):
                st.info(candidate["summary"])

            # Job Category (ML + LLM)
            st.subheader("🎯 Job Classification")
            ml_data = data.get("ml_classification", {})

            col1, col2 = st.columns(2)
            with col1:
                st.markdown(f"**ML Classification (TF-IDF + Classifiers):**")
                st.success(f"**{ml_data.get('predicted_category', 'Unknown')}** ({ml_data.get('confidence', 0)}% confidence)")
                if ml_data.get("model_results"):
                    with st.expander("Individual Model Results"):
                        for name, result in ml_data["model_results"].items():
                            st.write(f"**{name}:** {result['category']} ({result['confidence']}%)")
            with col2:
                if data.get("jobCategory"):
                    st.markdown(f"**LLM Classification (GPT-4o-mini):**")
                    st.success(f"**{data['jobCategory']}**")

            # Education
            if data.get("education"):
                st.subheader("🎓 Education")
                for edu in data["education"]:
                    degree = edu.get("degree", "")
                    field = edu.get("field", "")
                    inst = edu.get("institution", "")
                    year = edu.get("year", "")
                    st.write(f"**{degree}** in {field}")
                    if inst:
                        st.caption(f"{inst} {'· ' + year if year else ''}")

            # Experience
            if data.get("experience"):
                st.subheader("💼 Work Experience")
                for exp in data["experience"]:
                    with st.container():
                        col1, col2 = st.columns([3, 1])
                        with col1:
                            st.write(f"**{exp.get('title', '')}** at {exp.get('company', '')}")
                        with col2:
                            st.caption(exp.get("dates", ""))
                        if exp.get("highlights"):
                            for h in exp["highlights"]:
                                st.write(f"  ▸ {h}")

            # Skills
            if skills:
                st.subheader("⚡ Skills")
                display_skills(skills)

            # Recommendations
            if data.get("recommendations"):
                st.subheader("🚀 Job Recommendations")
                cols = st.columns(min(len(data["recommendations"]), 3))
                for j, rec in enumerate(data["recommendations"]):
                    with cols[j % len(cols)]:
                        score_color = "🟢" if rec.get("matchScore", 0) >= 80 else "🟡" if rec.get("matchScore", 0) >= 60 else "🔴"
                        st.markdown(f"**{rec.get('title', '')}** {score_color} {rec.get('matchScore', 0)}%")
                        st.caption(rec.get("reason", ""))

            # Strengths & Improvements
            col1, col2 = st.columns(2)
            with col1:
                if data.get("strengths"):
                    st.subheader("✨ Key Strengths")
                    for s in data["strengths"]:
                        st.write(f"✓ {s}")
            with col2:
                if data.get("improvements"):
                    st.subheader("💡 Suggestions")
                    for s in data["improvements"]:
                        st.write(f"→ {s}")

    # ===== JOB MATCHING SECTION =====
    st.divider()
    st.subheader("📊 Match Against Job Description")
    st.caption("Paste a job description below. The LLM parses requirements, then the algorithmic scoring engine calculates a transparent match — no AI in scoring.")

    job_desc = st.text_area("Job Description", height=150, placeholder="Paste the full job description here...")

    if job_desc.strip() and st.button("🎯 Score Resumes Against Job", type="primary", use_container_width=True):
        with st.spinner("Parsing job requirements with LLM..."):
            job_reqs = parse_job_description_llm(job_desc)

        if not job_reqs:
            st.error("Failed to parse job description. Check your OpenRouter API key.")
        else:
            st.success(f"Job Requirements parsed: **{job_reqs.get('title', 'Unknown')}**")

            with st.expander("Parsed Job Requirements"):
                col1, col2 = st.columns(2)
                with col1:
                    st.write("**Required Skills:**", ", ".join(job_reqs.get("requiredSkills", [])))
                    st.write("**Preferred Skills:**", ", ".join(job_reqs.get("preferredSkills", [])))
                    st.write("**Min Experience:**", f"{job_reqs.get('minExperienceYears', 0)} years")
                with col2:
                    st.write("**Education:**", job_reqs.get("requiredEducation", "Not specified"))
                    st.write("**Fields:**", ", ".join(job_reqs.get("requiredField", [])) or "Any")
                    st.write("**Keywords:**", ", ".join(job_reqs.get("keywords", [])))

            for res in results:
                if "error" in res:
                    continue
                data = res["data"]

                breakdown = score_resume(data, job_reqs)
                res["match_score"] = breakdown

                st.markdown(f"### {res['file']}")

                # Overall score
                overall = breakdown["overall"]
                grade = breakdown["grade"]
                if overall >= 75:
                    st.success(f"**{overall}%** — {grade}")
                elif overall >= 50:
                    st.warning(f"**{overall}%** — {grade}")
                else:
                    st.error(f"**{overall}%** — {grade}")

                # Category breakdowns
                display_score_bar("Required Skills", breakdown["skills_required"]["score"], breakdown["skills_required"]["weight"], "#818cf8")
                matched = breakdown["skills_required"].get("matched", [])
                missing = breakdown["skills_required"].get("missing", [])
                if matched or missing:
                    tags = ""
                    for s in matched:
                        tags += f'<span class="match-tag match-yes">✓ {s}</span>'
                    for s in missing:
                        tags += f'<span class="match-tag match-no">✗ {s}</span>'
                    st.markdown(tags, unsafe_allow_html=True)

                display_score_bar("Preferred Skills", breakdown["skills_preferred"]["score"], breakdown["skills_preferred"]["weight"], "#a78bfa")
                pref_matched = breakdown["skills_preferred"].get("matched", [])
                if pref_matched:
                    tags = " ".join(f'<span class="match-tag match-yes">✓ {s}</span>' for s in pref_matched)
                    st.markdown(tags, unsafe_allow_html=True)

                display_score_bar("Experience", breakdown["experience"]["score"], breakdown["experience"]["weight"], "#fbbf24")
                st.caption(f"{breakdown['experience']['candidate_years']} years (required: {breakdown['experience']['required_years']}+)"
                          + (f" · Relevant: {', '.join(breakdown['experience']['relevant_roles'])}" if breakdown['experience']['relevant_roles'] else ""))

                display_score_bar("Education", breakdown["education"]["score"], breakdown["education"]["weight"], "#22d3ee")
                edu = breakdown["education"]
                st.caption(f"{edu['candidate_degree'] or 'Not detected'}"
                          + (f" in {edu['candidate_field']}" if edu['candidate_field'] else "")
                          + f" · {'Meets requirement' if edu['meets_requirement'] else 'Below requirement'}"
                          + (f" · Field match" if edu['field_match'] else ""))

                display_score_bar("Keywords", breakdown["keywords"]["score"], breakdown["keywords"]["weight"], "#34d399")
                kw_matched = breakdown["keywords"].get("matched", [])
                if kw_matched:
                    tags = " ".join(f'<span class="match-tag match-yes">{s}</span>' for s in kw_matched)
                    st.markdown(tags, unsafe_allow_html=True)

                st.info("**How scoring works:** The LLM extracts resume data and parses job requirements. Scores are calculated algorithmically: skill matching uses fuzzy comparison with alias mapping, experience compares estimated years, education checks degree level and field relevance. No AI is involved in scoring — only transparent, auditable rules.")
                st.divider()

    # Ranking summary if multiple resumes scored
    if any("match_score" in r for r in results):
        scored = [(r["file"], r["match_score"]) for r in results if "match_score" in r]
        scored.sort(key=lambda x: x[1]["overall"], reverse=True)

        st.subheader("🏆 Candidate Ranking")
        for rank, (fname, breakdown) in enumerate(scored, 1):
            overall = breakdown["overall"]
            grade = breakdown["grade"]
            if overall >= 75:
                st.write(f"**#{rank}** {fname} — **{overall}%** ({grade}) 🟢")
            elif overall >= 50:
                st.write(f"**#{rank}** {fname} — **{overall}%** ({grade}) 🟡")
            else:
                st.write(f"**#{rank}** {fname} — **{overall}%** ({grade}) 🔴")

# Sidebar
with st.sidebar:
    st.markdown("### About")
    st.markdown("""
    **Resume Intelligence** is a hybrid resume screening system that combines:

    - **NLP** text extraction and pattern matching
    - **ML Classifiers** (KNN, LinearSVC, Random Forest) with TF-IDF for job categorization
    - **LLM** (GPT-4o-mini) for semantic resume analysis
    - **Algorithmic Scoring** engine for transparent job matching

    The scoring rubric weights:
    - Required Skills: 35%
    - Experience: 25%
    - Education: 15%
    - Preferred Skills: 10%
    - Keywords: 15%
    """)

    st.markdown("---")
    st.markdown("**ML Model Accuracy**")
    try:
        classifier = get_classifier()
        accuracies = classifier.get_accuracy()
        for name, acc in accuracies.items():
            st.write(f"{name}: {acc}%")
    except Exception:
        st.write("Train models first by analyzing a resume.")

    st.markdown("---")
    st.caption("Built with Python, Streamlit, scikit-learn & GPT-4o-mini")
    st.caption("BSc Computer Science Project — University of Nigeria, Nsukka")
