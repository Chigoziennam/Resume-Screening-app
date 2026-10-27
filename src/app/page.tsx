"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

interface Candidate {
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  summary: string;
}

interface Education {
  degree: string;
  field: string;
  institution: string;
  year: string;
}

interface Experience {
  title: string;
  company: string;
  dates: string;
  highlights: string[];
}

interface Recommendation {
  title: string;
  reason: string;
  matchScore: number;
}

interface ParseResult {
  candidate: Candidate;
  education: Education[];
  experience: Experience[];
  skills: { technical: string[]; soft: string[]; tools: string[] };
  jobCategory: string;
  recommendations: Recommendation[];
  strengths: string[];
  improvements: string[];
}

interface ScoreCategory {
  score: number;
  weight: number;
  matched?: string[];
  missing?: string[];
  total?: number;
  candidateYears?: number;
  requiredYears?: number;
  relevantRoles?: string[];
  meetsRequirement?: boolean;
  fieldMatch?: boolean;
  candidateDegree?: string;
  candidateField?: string;
}

interface ScoreBreakdown {
  skillsRequired: ScoreCategory;
  skillsPreferred: ScoreCategory;
  experience: ScoreCategory;
  education: ScoreCategory;
  keywords: ScoreCategory;
  overall: number;
  grade: string;
}

interface JobRequirements {
  title: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minExperienceYears: number;
  requiredEducation: string;
  requiredField: string[];
  keywords: string[];
}

interface FileResult {
  fileName: string;
  result: ParseResult | null;
  error: string | null;
  loading: boolean;
  matchScore: ScoreBreakdown | null;
  jobReqs: JobRequirements | null;
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<FileResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [jobDescription, setJobDescription] = useState("");

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const valid: File[] = [];
    for (const f of Array.from(newFiles)) {
      const ext = f.name.toLowerCase();
      if (ext.endsWith(".pdf") || ext.endsWith(".docx")) {
        valid.push(f);
      }
    }
    if (valid.length === 0) {
      setError("Please upload PDF or DOCX files.");
      return;
    }
    setFiles(valid);
    setError("");
    setResults([]);
    setActiveTab(0);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const analyzeOne = async (file: File): Promise<FileResult> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const extractRes = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });
      const extractData = await extractRes.json();
      if (!extractRes.ok) throw new Error(extractData.error);

      const parseRes = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractData.text }),
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error);

      return { fileName: file.name, result: parseData.result, error: null, loading: false, matchScore: null, jobReqs: null };
    } catch (err: unknown) {
      return {
        fileName: file.name,
        result: null,
        error: err instanceof Error ? err.message : "Analysis failed",
        loading: false,
        matchScore: null,
        jobReqs: null,
      };
    }
  };

  const analyze = async () => {
    if (files.length === 0) return;
    setAnalyzing(true);
    setError("");
    setActiveTab(0);

    const initial: FileResult[] = files.map((f) => ({
      fileName: f.name,
      result: null,
      error: null,
      loading: true,
      matchScore: null,
      jobReqs: null,
    }));
    setResults(initial);

    for (let i = 0; i < files.length; i++) {
      const res = await analyzeOne(files[i]);
      setResults((prev) => {
        const updated = [...prev];
        updated[i] = res;
        return updated;
      });
    }

    setAnalyzing(false);
  };

  const matchAgainstJob = async () => {
    if (!jobDescription.trim() || results.length === 0) return;
    setMatching(true);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r.result) continue;

      try {
        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeData: r.result, jobDescription }),
        });
        const data = await res.json();
        if (res.ok) {
          setResults((prev) => {
            const updated = [...prev];
            updated[i] = { ...updated[i], matchScore: data.breakdown, jobReqs: data.jobRequirements };
            return updated;
          });
        }
      } catch {}
    }

    setMatching(false);
  };

  const current = results[activeTab];
  const result = current?.result ?? null;

  const totalSkills = result
    ? (result.skills?.technical?.length || 0) +
      (result.skills?.tools?.length || 0) +
      (result.skills?.soft?.length || 0)
    : 0;

  return (
    <div className="min-h-screen bg-[#06080f] text-white relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/[0.07] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/[0.05] blur-[120px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-blue-600/[0.04] blur-[100px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <header className="text-center mb-14">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] text-indigo-300/80 text-xs tracking-wide uppercase mb-8 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
            </span>
            LLM-Powered Resume Screening
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-5">
            <span className="bg-gradient-to-b from-white via-white/90 to-white/50 bg-clip-text text-transparent">
              Resume
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-300 bg-clip-text text-transparent">
              Intelligence
            </span>
          </h1>
          <p className="text-white/40 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Upload one or multiple resumes for instant AI analysis — skill extraction, job categorization, and personalized career recommendations.
          </p>
        </header>

        {/* Upload area */}
        <div className="max-w-2xl mx-auto mb-6">
          <div
            className={`group relative rounded-2xl p-10 sm:p-14 text-center transition-all duration-300 cursor-pointer border ${
              dragOver
                ? "border-indigo-400/60 bg-indigo-500/[0.08] shadow-[0_0_40px_rgba(99,102,241,0.15)]"
                : files.length > 0
                ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            <input
              id="fileInput"
              type="file"
              accept=".pdf,.docx"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && e.target.files.length > 0 && handleFiles(e.target.files)}
            />
            {files.length > 0 ? (
              <div className="space-y-2">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-white font-medium text-lg">
                  {files.length === 1 ? files[0].name : `${files.length} resumes selected`}
                </p>
                <p className="text-white/30 text-sm">
                  {files.length === 1
                    ? `${(files[0].size / 1024).toFixed(1)} KB`
                    : files.map((f) => f.name).join(", ")}
                  {" "}· Click or drop to replace
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4 group-hover:bg-white/[0.06] group-hover:border-white/[0.1] transition-all">
                  <svg className="w-7 h-7 text-white/30 group-hover:text-white/50 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <p className="text-white/70 font-medium text-lg">Drop your resume(s) here or click to browse</p>
                <p className="text-white/25 text-sm">Supports PDF and DOCX · Multiple files allowed · Max 10MB each</p>
              </div>
            )}
          </div>
        </div>

        {/* Analyze button */}
        <div className="text-center mb-14">
          <button
            onClick={analyze}
            disabled={files.length === 0 || analyzing}
            className="relative px-10 py-3.5 rounded-xl font-semibold text-base transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 active:from-indigo-600 active:to-indigo-700 shadow-[0_1px_20px_rgba(99,102,241,0.3)] hover:shadow-[0_1px_30px_rgba(99,102,241,0.45)] disabled:shadow-none"
          >
            {analyzing ? (
              <span className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing {results.filter((r) => !r.loading).length}/{files.length} resumes...
              </span>
            ) : files.length > 1 ? (
              `Analyze ${files.length} Resumes`
            ) : (
              "Analyze Resume"
            )}
          </button>
        </div>

        {/* Job Description Input */}
        {results.some((r) => r.result) && (
          <div className="max-w-2xl mx-auto mb-10">
            <Card>
              <CardHeader icon={<TargetIcon />} title="Match Against Job Description" />
              <p className="text-white/35 text-sm mb-3">Paste a job description below. The scoring engine will calculate a transparent match breakdown — no LLM scoring, just algorithms.</p>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description here..."
                className="w-full h-32 bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-white/80 text-sm placeholder:text-white/20 focus:outline-none focus:border-indigo-500/40 resize-none"
              />
              <button
                onClick={matchAgainstJob}
                disabled={!jobDescription.trim() || matching}
                className="mt-3 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-[0_1px_15px_rgba(16,185,129,0.25)]"
              >
                {matching ? "Scoring..." : `Score ${results.filter((r) => r.result).length === 1 ? "Resume" : `${results.filter((r) => r.result).length} Resumes`}`}
              </button>
            </Card>
          </div>
        )}

        {error && (
          <div className="max-w-2xl mx-auto bg-red-500/[0.06] border border-red-500/20 rounded-xl p-4 mb-10 text-red-300/90 text-center text-sm">
            {error}
          </div>
        )}

        {/* Tabs for multiple results */}
        {results.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
                  activeTab === i
                    ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                    : "bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60 hover:border-white/[0.1]"
                }`}
              >
                {r.loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {r.fileName}
                  </span>
                ) : r.error ? (
                  <span className="text-red-400">{r.fileName}</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="text-emerald-400">&#10003;</span>
                    {r.fileName}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Current result */}
        {current?.loading && (
          <div className="text-center py-16">
            <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-indigo-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-white/40">Analyzing {current.fileName}...</p>
          </div>
        )}

        {current?.error && (
          <div className="max-w-2xl mx-auto bg-red-500/[0.06] border border-red-500/20 rounded-xl p-4 mb-10 text-red-300/90 text-center text-sm">
            Failed to analyze {current.fileName}: {current.error}
          </div>
        )}

        {result && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
              <StatCard label="Skills Found" value={String(totalSkills)} />
              <StatCard label="Experience" value={`${result.experience?.length || 0} roles`} />
              <StatCard label="Education" value={`${result.education?.length || 0}`} />
              <StatCard label="Match Score" value={result.recommendations?.[0] ? `${result.recommendations[0].matchScore}%` : "—"} accent />
            </div>

            <Card>
              <CardHeader icon={<UserIcon />} title="Candidate Profile" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 mb-4">
                <Field label="Name" value={result.candidate.name} />
                <Field label="Email" value={result.candidate.email} />
                <Field label="Phone" value={result.candidate.phone} />
                <Field label="Location" value={result.candidate.location} />
                {result.candidate.linkedin && <Field label="LinkedIn" value={result.candidate.linkedin} />}
              </div>
              {result.candidate.summary && (
                <p className="text-white/50 text-sm leading-relaxed bg-white/[0.02] rounded-lg p-4 border border-white/[0.04]">
                  {result.candidate.summary}
                </p>
              )}
            </Card>

            <Card>
              <CardHeader icon={<TargetIcon />} title="Job Category" />
              <span className="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-indigo-300 font-semibold text-lg">
                {result.jobCategory}
              </span>
            </Card>

            {result.education?.length > 0 && (
              <Card>
                <CardHeader icon={<GradIcon />} title="Education" />
                <div className="space-y-3">
                  {result.education.map((edu, i) => (
                    <div key={i} className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
                      <p className="font-semibold text-white/90">
                        {edu.degree}
                        {edu.field && <span className="text-white/50 font-normal"> in {edu.field}</span>}
                      </p>
                      <p className="text-white/35 text-sm mt-0.5">
                        {edu.institution}{edu.year && <span> · {edu.year}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {result.experience?.length > 0 && (
              <Card>
                <CardHeader icon={<BriefcaseIcon />} title="Work Experience" />
                <div className="space-y-4">
                  {result.experience.map((exp, i) => (
                    <div key={i} className="relative bg-white/[0.02] rounded-xl p-5 border border-white/[0.04]">
                      <div className="flex flex-wrap justify-between items-start gap-2 mb-1">
                        <div>
                          <p className="font-semibold text-white/90">{exp.title}</p>
                          <p className="text-indigo-300/70 text-sm">{exp.company}</p>
                        </div>
                        <span className="text-white/25 text-xs bg-white/[0.03] px-3 py-1 rounded-full border border-white/[0.04] shrink-0">{exp.dates}</span>
                      </div>
                      {exp.highlights?.length > 0 && (
                        <ul className="space-y-1.5 mt-3">
                          {exp.highlights.map((h, j) => (
                            <li key={j} className="text-white/45 text-sm flex gap-2.5 leading-relaxed">
                              <span className="text-indigo-400/60 mt-1 shrink-0">&#9656;</span>{h}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card>
              <CardHeader icon={<SkillsIcon />} title="Skills" />
              <div className="space-y-5">
                {result.skills?.technical?.length > 0 && <SkillGroup label="Technical" skills={result.skills.technical} variant="indigo" />}
                {result.skills?.tools?.length > 0 && <SkillGroup label="Tools & Platforms" skills={result.skills.tools} variant="emerald" />}
                {result.skills?.soft?.length > 0 && <SkillGroup label="Soft Skills" skills={result.skills.soft} variant="amber" />}
              </div>
            </Card>

            {result.recommendations?.length > 0 && (
              <Card>
                <CardHeader icon={<RocketIcon />} title="Job Recommendations" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <p className="font-semibold text-white/90">{rec.title}</p>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                          rec.matchScore >= 80 ? "bg-emerald-500/10 text-emerald-400/90 border border-emerald-500/15"
                            : rec.matchScore >= 60 ? "bg-amber-500/10 text-amber-400/90 border border-amber-500/15"
                            : "bg-white/[0.04] text-white/50 border border-white/[0.06]"
                        }`}>{rec.matchScore}%</span>
                      </div>
                      <p className="text-white/40 text-sm leading-relaxed">{rec.reason}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {result.strengths?.length > 0 && (
                <Card>
                  <CardHeader icon={<StrengthIcon />} title="Key Strengths" />
                  <ul className="space-y-2.5">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm text-white/55 leading-relaxed">
                        <span className="text-emerald-400/70 mt-0.5 shrink-0">&#10003;</span>{s}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {result.improvements?.length > 0 && (
                <Card>
                  <CardHeader icon={<LightbulbIcon />} title="Suggestions" />
                  <ul className="space-y-2.5">
                    {result.improvements.map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm text-white/55 leading-relaxed">
                        <span className="text-amber-400/70 mt-0.5 shrink-0">&#8594;</span>{s}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            {/* Scoring Breakdown */}
            {current?.matchScore && (
              <Card>
                <CardHeader icon={<ChartIcon />} title="Job Match Breakdown" />
                <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-gradient-to-r from-indigo-500/[0.06] to-purple-500/[0.06] border border-indigo-500/15">
                  <div className="text-4xl font-bold text-white">{current.matchScore.overall}%</div>
                  <div>
                    <p className={`text-lg font-semibold ${current.matchScore.overall >= 75 ? "text-emerald-400" : current.matchScore.overall >= 50 ? "text-amber-400" : "text-red-400"}`}>
                      {current.matchScore.grade}
                    </p>
                    {current.jobReqs && <p className="text-white/35 text-sm">for {current.jobReqs.title}</p>}
                  </div>
                </div>
                <p className="text-white/25 text-[11px] uppercase tracking-widest mb-3">Transparent Scoring Rubric</p>
                <div className="space-y-4">
                  <ScoreBar label="Required Skills" score={current.matchScore.skillsRequired.score} weight={current.matchScore.skillsRequired.weight} color="indigo">
                    {current.matchScore.skillsRequired.matched && current.matchScore.skillsRequired.matched.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {current.matchScore.skillsRequired.matched.map((s) => (
                          <span key={s} className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 text-emerald-300/80">&#10003; {s}</span>
                        ))}
                        {current.matchScore.skillsRequired.missing?.map((s) => (
                          <span key={s} className="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-300/80">&#10007; {s}</span>
                        ))}
                      </div>
                    )}
                  </ScoreBar>
                  <ScoreBar label="Preferred Skills" score={current.matchScore.skillsPreferred.score} weight={current.matchScore.skillsPreferred.weight} color="purple">
                    {current.matchScore.skillsPreferred.matched && current.matchScore.skillsPreferred.matched.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {current.matchScore.skillsPreferred.matched.map((s) => (
                          <span key={s} className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 text-emerald-300/80">&#10003; {s}</span>
                        ))}
                      </div>
                    )}
                  </ScoreBar>
                  <ScoreBar label="Experience" score={current.matchScore.experience.score} weight={current.matchScore.experience.weight} color="amber">
                    <p className="text-white/35 text-xs mt-1">
                      {current.matchScore.experience.candidateYears} years (required: {current.matchScore.experience.requiredYears}+)
                      {current.matchScore.experience.relevantRoles && current.matchScore.experience.relevantRoles.length > 0 && (
                        <span> · Relevant: {current.matchScore.experience.relevantRoles.join(", ")}</span>
                      )}
                    </p>
                  </ScoreBar>
                  <ScoreBar label="Education" score={current.matchScore.education.score} weight={current.matchScore.education.weight} color="cyan">
                    <p className="text-white/35 text-xs mt-1">
                      {current.matchScore.education.candidateDegree || "Not detected"}
                      {current.matchScore.education.candidateField && ` in ${current.matchScore.education.candidateField}`}
                      {" · "}
                      {current.matchScore.education.meetsRequirement ? "Meets requirement" : "Below requirement"}
                      {current.matchScore.education.fieldMatch ? " · Field match" : ""}
                    </p>
                  </ScoreBar>
                  <ScoreBar label="Keywords" score={current.matchScore.keywords.score} weight={current.matchScore.keywords.weight} color="emerald">
                    {current.matchScore.keywords.matched && current.matchScore.keywords.matched.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {current.matchScore.keywords.matched.map((s) => (
                          <span key={s} className="px-2 py-0.5 text-xs rounded-full bg-white/[0.06] text-white/50">{s}</span>
                        ))}
                      </div>
                    )}
                  </ScoreBar>
                </div>
                <div className="mt-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-white/25 text-[10px] uppercase tracking-widest mb-1">How scoring works</p>
                  <p className="text-white/35 text-xs leading-relaxed">
                    The LLM extracts resume data and parses job requirements. Scores are calculated algorithmically: skill matching uses fuzzy comparison with alias mapping, experience compares estimated years, education checks degree level and field relevance. No AI is involved in scoring — only transparent, auditable rules.
                  </p>
                </div>
              </Card>
            )}
          </div>
        )}

        <div className="text-center mt-10">
          <Link
            href="/history"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition"
          >
            View Screening History
          </Link>
        </div>

        <footer className="text-center mt-8 text-white/15 text-xs">
          Resume Intelligence &middot; Built with Next.js, Supabase &amp; LLM (GPT-4o-mini)
        </footer>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 sm:p-6 backdrop-blur-sm">{children}</div>;
}
function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40">{icon}</div>
      <h2 className="text-lg font-semibold text-white/90">{title}</h2>
    </div>
  );
}
function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border text-center ${accent ? "bg-indigo-500/[0.06] border-indigo-500/15" : "bg-white/[0.02] border-white/[0.05]"}`}>
      <p className={`text-2xl font-bold mb-0.5 ${accent ? "text-indigo-300" : "text-white/90"}`}>{value}</p>
      <p className="text-white/30 text-xs uppercase tracking-wider">{label}</p>
    </div>
  );
}
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-white/25 text-[11px] uppercase tracking-widest mb-1">{label}</p>
      <p className="text-white/80">{value || "Not detected"}</p>
    </div>
  );
}
function SkillGroup({ label, skills, variant }: { label: string; skills: string[]; variant: "indigo" | "emerald" | "amber" }) {
  const styles = {
    indigo: "bg-indigo-500/[0.08] text-indigo-300/80 border-indigo-500/10",
    emerald: "bg-emerald-500/[0.08] text-emerald-300/80 border-emerald-500/10",
    amber: "bg-amber-500/[0.08] text-amber-300/80 border-amber-500/10",
  };
  return (
    <div>
      <p className="text-white/25 text-[11px] uppercase tracking-widest mb-2.5">{label}</p>
      <div className="flex flex-wrap gap-2">
        {skills.map((s, i) => <span key={i} className={`px-3 py-1.5 rounded-lg text-sm border ${styles[variant]}`}>{s}</span>)}
      </div>
    </div>
  );
}

function UserIcon() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>; }
function TargetIcon() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; }
function GradIcon() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>; }
function BriefcaseIcon() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>; }
function SkillsIcon() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384-3.19A1.745 1.745 0 015.25 10.8V6.75a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H6a.75.75 0 01-.75-.75V6.75A.75.75 0 016 6h.008a.75.75 0 01.75.75V10.8c0 .253.138.487.358.61l5.384 3.19a1.75 1.75 0 01.858 1.508v2.642a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75v-2.642a.25.25 0 00-.122-.215zM17.25 6.75A.75.75 0 0118 6h.008a.75.75 0 01.75.75V10.8c0 .253-.138.487-.358.61l-5.384 3.19a.25.25 0 00-.122.215v2.642a.75.75 0 01-.75.75H12.136" /></svg>; }
function RocketIcon() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /></svg>; }
function StrengthIcon() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>; }
function LightbulbIcon() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>; }
function ChartIcon() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>; }

function ScoreBar({ label, score, weight, color, children }: { label: string; score: number; weight: number; color: string; children?: React.ReactNode }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-500",
    purple: "bg-purple-500",
    amber: "bg-amber-500",
    cyan: "bg-cyan-500",
    emerald: "bg-emerald-500",
  };
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-white/70 text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-white/25 text-xs">{Math.round(weight * 100)}% weight</span>
          <span className={`text-sm font-bold ${score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400"}`}>{score}%</span>
        </div>
      </div>
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${colors[color] || "bg-indigo-500"}`} style={{ width: `${score}%` }} />
      </div>
      {children}
    </div>
  );
}
