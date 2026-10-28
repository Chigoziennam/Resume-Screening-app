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
    page_title="Resume Parsing and Job Recommendation System",
    page_icon="📄",
    layout="wide",
)


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


# ===== MAIN APP =====
st.title("📄 Resume Parsing, Job Categorization and Recommendation System")
st.write("Upload a resume to extract candidate information, education, skills, work experience, job category and job recommendations.")

uploaded_files = st.file_uploader(
    "Upload Resume",
    type=["pdf", "docx"],
    accept_multiple_files=True,
    help="Drag and drop files here. Limit 200MB per file. PDF, DOCX"
)

if uploaded_files:
    for uf in uploaded_files:
        st.success(f"Resume uploaded successfully: {uf.name}")

    if st.button("Analyze Resume", type="primary"):
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

            st.divider()

            # Candidate Information
            st.header("👤 Candidate Information")
            col1, col2 = st.columns(2)
            with col1:
                st.subheader("Email Address")
                email_val = candidate.get("email") or "Not detected"
                st.write(email_val)
            with col2:
                st.subheader("Phone Number")
                phone_val = candidate.get("phone") or "Not detected"
                st.write(phone_val)

            st.divider()

            # Extracted Skills
            st.header("⚡ Extracted Skills")
            all_skills = (
                skills.get("technical", []) +
                skills.get("tools", []) +
                skills.get("soft", [])
            )
            if all_skills:
                for skill in all_skills:
                    st.write(f"• {skill}")
            else:
                st.write("No skills detected")

            st.divider()

            # Education and Work Experience
            st.header("🎓 Education and Work Experience")
            if data.get("education"):
                for edu in data["education"]:
                    degree = edu.get("degree", "")
                    field = edu.get("field", "")
                    inst = edu.get("institution", "")
                    year = edu.get("year", "")
                    parts = [p for p in [degree, field] if p]
                    st.write(f"• {' in '.join(parts) if parts else 'Education entry'}")
                    if inst:
                        st.write(f"  {inst} {year}")

            if data.get("experience"):
                for exp in data["experience"]:
                    title = exp.get("title", "")
                    company = exp.get("company", "")
                    dates = exp.get("dates", "")
                    st.write(f"• {title}" + (f" at {company}" if company else "") + (f" ({dates})" if dates else ""))

            if not data.get("education") and not data.get("experience"):
                st.write("No education or experience detected")

            st.divider()

            # Predicted Job Category
            st.header("🎯 Predicted Job Category")
            ml_data = data.get("ml_classification", {})
            predicted = ml_data.get("predicted_category", data.get("jobCategory", "Unknown"))
            st.success(f"**{predicted.upper()}**")

            if ml_data.get("model_results"):
                with st.expander("View Individual Model Results"):
                    for name, result in ml_data["model_results"].items():
                        st.write(f"• **{name}:** {result['category']} ({result['confidence']}% confidence)")

            st.divider()

            # Recommended Jobs
            st.header("💼 Recommended Jobs")
            if data.get("recommendations"):
                for rec in data["recommendations"]:
                    title = rec.get("title", "")
                    reason = rec.get("reason", "")
                    score = rec.get("matchScore", 0)
                    st.write(f"• {title}" + (f" — {reason}" if reason else ""))
            else:
                st.write("Upload and analyze a resume to see job recommendations.")

            st.divider()

            # Strengths & Improvements
            if data.get("strengths") or data.get("improvements"):
                col1, col2 = st.columns(2)
                with col1:
                    if data.get("strengths"):
                        st.header("✅ Key Strengths")
                        for s in data["strengths"]:
                            st.write(f"• {s}")
                with col2:
                    if data.get("improvements"):
                        st.header("💡 Suggestions")
                        for s in data["improvements"]:
                            st.write(f"• {s}")
                st.divider()

    # ===== JOB MATCHING SECTION =====
    st.header("📊 Match Against Job Description")
    st.write("Paste a job description below to score candidates against specific requirements.")

    job_desc = st.text_area("Job Description", height=150, placeholder="Paste the full job description here...")

    if job_desc.strip() and st.button("Score Resumes Against Job", type="primary"):
        with st.spinner("Parsing job requirements..."):
            job_reqs = parse_job_description_llm(job_desc)

        if not job_reqs:
            st.error("Failed to parse job description. Check your OpenRouter API key.")
        else:
            st.success(f"Job Requirements parsed: **{job_reqs.get('title', 'Unknown')}**")

            with st.expander("Parsed Job Requirements"):
                st.write(f"• **Required Skills:** {', '.join(job_reqs.get('requiredSkills', []))}")
                st.write(f"• **Preferred Skills:** {', '.join(job_reqs.get('preferredSkills', []))}")
                st.write(f"• **Min Experience:** {job_reqs.get('minExperienceYears', 0)} years")
                st.write(f"• **Education:** {job_reqs.get('requiredEducation', 'Not specified')}")
                st.write(f"• **Keywords:** {', '.join(job_reqs.get('keywords', []))}")

            for res in results:
                if "error" in res:
                    continue
                data = res["data"]

                breakdown = score_resume(data, job_reqs)
                res["match_score"] = breakdown

                st.subheader(res["file"])

                overall = breakdown["overall"]
                grade = breakdown["grade"]
                if overall >= 75:
                    st.success(f"**{overall}%** — {grade}")
                elif overall >= 50:
                    st.warning(f"**{overall}%** — {grade}")
                else:
                    st.error(f"**{overall}%** — {grade}")

                st.write(f"• **Required Skills:** {breakdown['skills_required']['score']}% ({breakdown['skills_required']['weight']*100:.0f}% weight)")
                matched = breakdown["skills_required"].get("matched", [])
                missing = breakdown["skills_required"].get("missing", [])
                if matched:
                    st.write(f"  Matched: {', '.join(matched)}")
                if missing:
                    st.write(f"  Missing: {', '.join(missing)}")

                st.write(f"• **Preferred Skills:** {breakdown['skills_preferred']['score']}% ({breakdown['skills_preferred']['weight']*100:.0f}% weight)")

                st.write(f"• **Experience:** {breakdown['experience']['score']}% ({breakdown['experience']['weight']*100:.0f}% weight) — {breakdown['experience']['candidate_years']} years (required: {breakdown['experience']['required_years']}+)")

                edu = breakdown["education"]
                st.write(f"• **Education:** {edu['score']}% ({edu['weight']*100:.0f}% weight) — {edu['candidate_degree'] or 'Not detected'}" +
                         (f" in {edu['candidate_field']}" if edu['candidate_field'] else "") +
                         f" ({'Meets requirement' if edu['meets_requirement'] else 'Below requirement'})")

                st.write(f"• **Keywords:** {breakdown['keywords']['score']}% ({breakdown['keywords']['weight']*100:.0f}% weight)")

                st.divider()

    # Ranking summary
    if any("match_score" in r for r in results):
        scored = [(r["file"], r["match_score"]) for r in results if "match_score" in r]
        scored.sort(key=lambda x: x[1]["overall"], reverse=True)

        st.header("🏆 Candidate Ranking")
        for rank, (fname, breakdown) in enumerate(scored, 1):
            overall = breakdown["overall"]
            grade = breakdown["grade"]
            st.write(f"**#{rank}** {fname} — **{overall}%** ({grade})")

# Sidebar
with st.sidebar:
    st.header("About")
    st.write("""
    **Resume Parsing, Job Categorization and Recommendation System** combines:

    • NLP text extraction and pattern matching
    • ML Classifiers (KNN, LinearSVC, Random Forest) with TF-IDF for job categorization
    • LLM (GPT-4o-mini) for semantic resume analysis
    • Algorithmic Scoring engine for transparent job matching
    """)

    st.divider()
    st.subheader("ML Model Accuracy")
    try:
        classifier = get_classifier()
        accuracies = classifier.get_accuracy()
        for name, acc in accuracies.items():
            st.write(f"• {name}: {acc}%")
    except Exception:
        st.write("Train models first by analyzing a resume.")

    st.divider()
    st.write("Built with Python, Streamlit, scikit-learn & GPT-4o-mini")
    st.write("BSc Computer Science Project — University of Nigeria, Nsukka")
