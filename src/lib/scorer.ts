export interface JobRequirements {
  title: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minExperienceYears: number;
  requiredEducation: string;
  requiredField: string[];
  keywords: string[];
}

export interface ResumeData {
  skills: { technical: string[]; soft: string[]; tools: string[] };
  experience: { title: string; company: string; dates: string; highlights: string[] }[];
  education: { degree: string; field: string; institution: string; year: string }[];
  candidate: { name: string; summary: string };
}

export interface ScoreBreakdown {
  skillsRequired: { score: number; weight: number; matched: string[]; missing: string[]; total: number };
  skillsPreferred: { score: number; weight: number; matched: string[]; total: number };
  experience: { score: number; weight: number; candidateYears: number; requiredYears: number; relevantRoles: string[] };
  education: { score: number; weight: number; meetsRequirement: boolean; fieldMatch: boolean; candidateDegree: string; candidateField: string };
  keywords: { score: number; weight: number; matched: string[]; total: number };
  overall: number;
  grade: string;
}

const WEIGHTS = {
  skillsRequired: 0.35,
  skillsPreferred: 0.10,
  experience: 0.25,
  education: 0.15,
  keywords: 0.15,
};

const DEGREE_LEVELS: Record<string, number> = {
  "phd": 5, "doctorate": 5, "ph.d": 5,
  "master": 4, "msc": 4, "mba": 4, "m.sc": 4, "ma": 4,
  "bachelor": 3, "bsc": 3, "b.sc": 3, "ba": 3, "b.a": 3, "b.eng": 3,
  "associate": 2, "diploma": 2, "hnd": 2, "ond": 1,
  "certificate": 1, "certification": 1,
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#]/g, "").trim();
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const aliases: Record<string, string[]> = {
    "javascript": ["js", "es6", "es2015", "ecmascript"],
    "typescript": ["ts"],
    "python": ["py", "python3"],
    "react": ["reactjs", "reactjsx"],
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
  };

  for (const [key, vals] of Object.entries(aliases)) {
    const group = [key, ...vals];
    if (group.includes(na) && group.includes(nb)) return true;
  }

  return false;
}

function matchSkills(candidateSkills: string[], required: string[]): { matched: string[]; missing: string[] } {
  const allCandidate = candidateSkills.map(normalize);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const req of required) {
    const found = candidateSkills.some((cs) => fuzzyMatch(cs, req));
    if (found) matched.push(req);
    else missing.push(req);
  }

  return { matched, missing };
}

function estimateYears(experience: ResumeData["experience"]): number {
  let total = 0;
  for (const exp of experience) {
    const dates = exp.dates || "";
    const years = dates.match(/(\d{4})/g);
    if (years && years.length >= 2) {
      const diff = Math.abs(parseInt(years[years.length - 1]) - parseInt(years[0]));
      total += diff || 1;
    } else if (dates.toLowerCase().includes("present") || dates.toLowerCase().includes("current")) {
      const startYear = dates.match(/(\d{4})/);
      if (startYear) {
        total += new Date().getFullYear() - parseInt(startYear[1]);
      } else {
        total += 1;
      }
    } else {
      total += 1;
    }
  }
  return total;
}

function getDegreeLevel(education: ResumeData["education"]): { level: number; degree: string; field: string } {
  let highest = { level: 0, degree: "None", field: "" };

  for (const edu of education) {
    const combined = `${edu.degree} ${edu.field}`.toLowerCase();
    for (const [key, level] of Object.entries(DEGREE_LEVELS)) {
      if (combined.includes(key) && level > highest.level) {
        highest = { level, degree: edu.degree, field: edu.field };
      }
    }
  }

  return highest;
}

function getRequiredDegreeLevel(req: string): number {
  const lower = req.toLowerCase();
  for (const [key, level] of Object.entries(DEGREE_LEVELS)) {
    if (lower.includes(key)) return level;
  }
  return 0;
}

function matchKeywords(resumeText: string, keywords: string[]): string[] {
  const lower = resumeText.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
}

function getGrade(score: number): string {
  if (score >= 90) return "Excellent Match";
  if (score >= 75) return "Strong Match";
  if (score >= 60) return "Good Match";
  if (score >= 45) return "Moderate Match";
  if (score >= 30) return "Weak Match";
  return "Poor Match";
}

export function scoreResume(resume: ResumeData, job: JobRequirements): ScoreBreakdown {
  const allSkills = [
    ...(resume.skills?.technical || []),
    ...(resume.skills?.tools || []),
    ...(resume.skills?.soft || []),
  ];

  const reqMatch = matchSkills(allSkills, job.requiredSkills);
  const reqScore = job.requiredSkills.length > 0
    ? (reqMatch.matched.length / job.requiredSkills.length) * 100
    : 100;

  const prefMatch = matchSkills(allSkills, job.preferredSkills);
  const prefScore = job.preferredSkills.length > 0
    ? (prefMatch.matched.length / job.preferredSkills.length) * 100
    : 100;

  const candidateYears = estimateYears(resume.experience);
  const relevantRoles = resume.experience
    .filter((e) => fuzzyMatch(e.title, job.title) || job.keywords.some((k) => e.title.toLowerCase().includes(k.toLowerCase())))
    .map((e) => e.title);
  let expScore: number;
  if (job.minExperienceYears <= 0) {
    expScore = 100;
  } else if (candidateYears >= job.minExperienceYears) {
    expScore = 100;
  } else {
    expScore = (candidateYears / job.minExperienceYears) * 100;
  }
  if (relevantRoles.length > 0) expScore = Math.min(100, expScore + 15);

  const candidateDeg = getDegreeLevel(resume.education);
  const reqDegLevel = getRequiredDegreeLevel(job.requiredEducation);
  const meetsReq = candidateDeg.level >= reqDegLevel;
  const fieldMatch = job.requiredField.length === 0 || job.requiredField.some((f) =>
    candidateDeg.field.toLowerCase().includes(f.toLowerCase()) || f.toLowerCase().includes(candidateDeg.field.toLowerCase())
  );
  let eduScore = 0;
  if (meetsReq && fieldMatch) eduScore = 100;
  else if (meetsReq) eduScore = 75;
  else if (candidateDeg.level > 0) eduScore = 40;

  const resumeText = [
    resume.candidate?.summary || "",
    ...allSkills,
    ...resume.experience.map((e) => `${e.title} ${e.company} ${e.highlights?.join(" ") || ""}`),
  ].join(" ");
  const kwMatched = matchKeywords(resumeText, job.keywords);
  const kwScore = job.keywords.length > 0 ? (kwMatched.length / job.keywords.length) * 100 : 100;

  const overall = Math.round(
    reqScore * WEIGHTS.skillsRequired +
    prefScore * WEIGHTS.skillsPreferred +
    expScore * WEIGHTS.experience +
    eduScore * WEIGHTS.education +
    kwScore * WEIGHTS.keywords
  );

  return {
    skillsRequired: { score: Math.round(reqScore), weight: WEIGHTS.skillsRequired, matched: reqMatch.matched, missing: reqMatch.missing, total: job.requiredSkills.length },
    skillsPreferred: { score: Math.round(prefScore), weight: WEIGHTS.skillsPreferred, matched: prefMatch.matched, total: job.preferredSkills.length },
    experience: { score: Math.round(expScore), weight: WEIGHTS.experience, candidateYears, requiredYears: job.minExperienceYears, relevantRoles },
    education: { score: Math.round(eduScore), weight: WEIGHTS.education, meetsRequirement: meetsReq, fieldMatch, candidateDegree: candidateDeg.degree, candidateField: candidateDeg.field },
    keywords: { score: Math.round(kwScore), weight: WEIGHTS.keywords, matched: kwMatched, total: job.keywords.length },
    overall,
    grade: getGrade(overall),
  };
}
