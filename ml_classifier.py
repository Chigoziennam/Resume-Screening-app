"""
ML-based Resume Classifier
Uses TF-IDF vectorization with KNN and Linear SVC classifiers
to categorize resumes into job categories.
"""

import pickle
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import LinearSVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import numpy as np

TRAINING_DATA = [
    ("Developed web applications using React, Node.js, JavaScript, HTML, CSS. Built REST APIs with Express and MongoDB. Deployed on AWS using Docker containers. Implemented CI/CD pipelines with Jenkins.", "Software Engineering"),
    ("Built full-stack applications with Python Django and PostgreSQL. Experience with microservices architecture, Kubernetes orchestration, and cloud infrastructure on GCP.", "Software Engineering"),
    ("Designed and implemented scalable backend systems using Java Spring Boot. Proficient in SQL databases, Redis caching, and message queues like RabbitMQ.", "Software Engineering"),
    ("Mobile app development with Swift and Kotlin. Published apps on App Store and Google Play. Experience with React Native for cross-platform development.", "Software Engineering"),
    ("Created responsive websites using HTML5, CSS3, JavaScript. Expert in Tailwind CSS, Bootstrap frameworks. Built SPAs with Vue.js and Angular.", "Software Engineering"),

    ("Applied machine learning algorithms for predictive analytics. Built classification models using scikit-learn, XGBoost. Performed feature engineering and model evaluation.", "Data Science"),
    ("Analyzed large datasets using Python, Pandas, NumPy. Created visualizations with Matplotlib and Tableau. Statistical analysis and hypothesis testing.", "Data Science"),
    ("Developed deep learning models using TensorFlow and PyTorch. Worked on NLP tasks including sentiment analysis and named entity recognition.", "Data Science"),
    ("Built data pipelines with Apache Spark and Airflow. Experience with big data technologies Hadoop, Hive. Data warehousing with Snowflake and Redshift.", "Data Science"),
    ("Research in computer vision and image recognition. Published papers on convolutional neural networks. Experience with OpenCV and image processing.", "Data Science"),

    ("Managed digital marketing campaigns across Google Ads, Facebook, Instagram. SEO optimization, content strategy, and social media management.", "Marketing"),
    ("Created marketing strategies for B2B SaaS products. Email marketing automation with HubSpot and Mailchimp. A/B testing and conversion optimization.", "Marketing"),
    ("Brand management and market research. Developed go-to-market strategies for product launches. Customer segmentation and targeting.", "Marketing"),
    ("Content marketing specialist creating blog posts, whitepapers, and case studies. SEO writing, keyword research, and content analytics.", "Marketing"),
    ("Social media marketing manager handling multiple platforms. Influencer partnerships, community management, and engagement analytics.", "Marketing"),

    ("Financial analysis and reporting. Built financial models in Excel. Experience with Bloomberg Terminal, capital markets, and portfolio management.", "Finance"),
    ("Accounting and auditing experience. Proficient in QuickBooks, SAP. Knowledge of GAAP and IFRS standards. Tax preparation and compliance.", "Finance"),
    ("Investment banking analyst performing DCF analysis, comparable company analysis. M&A due diligence and deal execution.", "Finance"),
    ("Risk management and compliance. Developed risk assessment frameworks. Experience with regulatory requirements including SOX and Basel III.", "Finance"),
    ("Financial planning and budgeting. Revenue forecasting, variance analysis. Corporate finance and treasury management.", "Finance"),

    ("Patient care and clinical assessment. Administered medications and treatments. Electronic health records management with Epic and Cerner.", "Healthcare"),
    ("Medical research and clinical trials. Data collection and analysis for healthcare studies. Knowledge of FDA regulations and GCP guidelines.", "Healthcare"),
    ("Healthcare administration and hospital management. Quality improvement initiatives. Patient satisfaction and outcomes measurement.", "Healthcare"),
    ("Public health program planning and epidemiology. Disease surveillance and outbreak investigation. Health education and community outreach.", "Healthcare"),
    ("Nursing care across multiple departments including ICU, emergency, and pediatrics. Vital signs monitoring and patient assessment.", "Healthcare"),

    ("Taught courses in mathematics and computer science at university level. Curriculum development and student assessment.", "Education"),
    ("Elementary school teacher with experience in classroom management. Created lesson plans aligned with national standards.", "Education"),
    ("Educational technology specialist implementing LMS platforms. Online course development and instructional design.", "Education"),
    ("Academic research and published papers in peer-reviewed journals. Supervised graduate students and managed research grants.", "Education"),

    ("Designed user interfaces for web and mobile applications. Created wireframes and prototypes in Figma and Sketch. User research and usability testing.", "Design"),
    ("Graphic design for print and digital media. Adobe Creative Suite expert including Photoshop, Illustrator, InDesign. Brand identity design.", "Design"),
    ("UX research and design. Conducted user interviews, created personas and journey maps. Accessibility compliance and inclusive design.", "Design"),

    ("Human resources management including recruitment, onboarding, and performance reviews. HRIS management with Workday and BambooHR.", "Human Resources"),
    ("Talent acquisition specialist. Sourced candidates through LinkedIn, job boards, and campus recruiting. Interview scheduling and candidate experience.", "Human Resources"),
    ("Employee relations and organizational development. Compensation and benefits administration. Diversity and inclusion initiatives.", "Human Resources"),

    ("Project management using Agile and Scrum methodologies. Led cross-functional teams of 10+ members. Budget management and stakeholder communication.", "Project Management"),
    ("Program manager overseeing multiple concurrent projects. Risk assessment and mitigation planning. Earned PMP certification.", "Project Management"),

    ("Legal research and case preparation. Contract drafting and review. Knowledge of corporate law, intellectual property, and employment law.", "Legal"),
    ("Paralegal experience in litigation support. Document review and e-discovery. Court filing and legal document management.", "Legal"),

    ("Civil engineering and structural design. AutoCAD and Revit proficiency. Construction project supervision and quality control.", "Engineering"),
    ("Electrical engineering with PCB design experience. Circuit simulation and testing. Embedded systems programming with C and assembly.", "Engineering"),
    ("Mechanical engineering and CAD modeling. Product design and manufacturing process optimization. Materials testing and quality assurance.", "Engineering"),
]


class ResumeClassifier:
    def __init__(self):
        self.models = {}
        self.vectorizer = None
        self._trained = False

    def train(self):
        texts = [item[0] for item in TRAINING_DATA]
        labels = [item[1] for item in TRAINING_DATA]

        self.vectorizer = TfidfVectorizer(
            max_features=5000,
            stop_words="english",
            ngram_range=(1, 2),
            min_df=1,
        )

        X = self.vectorizer.fit_transform(texts)

        self.models["KNN"] = KNeighborsClassifier(n_neighbors=3, metric="cosine")
        self.models["KNN"].fit(X, labels)

        self.models["LinearSVC"] = LinearSVC(max_iter=1000, random_state=42)
        self.models["LinearSVC"].fit(X, labels)

        self.models["RandomForest"] = RandomForestClassifier(n_estimators=100, random_state=42)
        self.models["RandomForest"].fit(X, labels)

        self._trained = True

    def classify(self, text: str) -> dict:
        if not self._trained:
            self.train()

        X = self.vectorizer.transform([text])
        results = {}
        for name, model in self.models.items():
            prediction = model.predict(X)[0]
            if hasattr(model, "predict_proba"):
                proba = model.predict_proba(X)[0]
                confidence = float(max(proba)) * 100
            elif hasattr(model, "decision_function"):
                decisions = model.decision_function(X)[0]
                exp_decisions = np.exp(decisions - np.max(decisions))
                proba = exp_decisions / exp_decisions.sum()
                confidence = float(max(proba)) * 100
            else:
                confidence = 0.0
            results[name] = {"category": prediction, "confidence": round(confidence, 1)}

        categories = [r["category"] for r in results.values()]
        from collections import Counter
        most_common = Counter(categories).most_common(1)[0][0]
        avg_confidence = sum(r["confidence"] for r in results.values() if r["category"] == most_common) / len(results)

        return {
            "predicted_category": most_common,
            "confidence": round(avg_confidence, 1),
            "model_results": results,
        }

    def get_accuracy(self) -> dict:
        if not self._trained:
            self.train()
        texts = [item[0] for item in TRAINING_DATA]
        labels = [item[1] for item in TRAINING_DATA]
        X = self.vectorizer.transform(texts)
        accuracies = {}
        for name, model in self.models.items():
            preds = model.predict(X)
            accuracies[name] = round(accuracy_score(labels, preds) * 100, 1)
        return accuracies


_classifier = None

def get_classifier() -> ResumeClassifier:
    global _classifier
    if _classifier is None:
        _classifier = ResumeClassifier()
        _classifier.train()
    return _classifier
