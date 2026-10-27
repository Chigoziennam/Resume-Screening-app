"use client";

import { useState, useCallback } from "react";

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

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (f: File) => {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith(".pdf") && !ext.endsWith(".docx")) {
      setError("Please upload a PDF or DOCX file.");
      return;
    }
    setFile(f);
    setError("");
    setResult(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      setStep("Extracting text from resume...");
      const formData = new FormData();
      formData.append("file", file);
      const extractRes = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });
      const extractData = await extractRes.json();
      if (!extractRes.ok) throw new Error(extractData.error);

      setStep("Analyzing with AI...");
      const parseRes = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractData.text }),
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error);

      setResult(parseData.result);
      setStep("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Powered by AI via OpenRouter
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent mb-4">
            Resume Intelligence
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Upload your resume for AI-powered parsing, skill extraction, job categorization, and personalized career recommendations.
          </p>
        </div>

        {/* Upload */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer mb-8 ${
            dragOver
              ? "border-indigo-400 bg-indigo-500/10"
              : file
              ? "border-green-500/50 bg-green-500/5"
              : "border-slate-700 bg-slate-800/50 hover:border-indigo-500/50 hover:bg-slate-800"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById("fileInput")?.click()}
        >
          <input
            id="fileInput"
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {file ? (
            <div>
              <div className="text-4xl mb-3">&#128196;</div>
              <p className="text-green-400 font-medium text-lg">{file.name}</p>
              <p className="text-slate-500 text-sm mt-1">
                {(file.size / 1024).toFixed(1)} KB &middot; Click or drop to replace
              </p>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-3">&#128194;</div>
              <p className="text-slate-300 font-medium text-lg">
                Drop your resume here or click to browse
              </p>
              <p className="text-slate-500 text-sm mt-1">PDF or DOCX &middot; up to 10MB</p>
            </div>
          )}
        </div>

        {/* Analyze Button */}
        <div className="text-center mb-12">
          <button
            onClick={analyze}
            disabled={!file || loading}
            className="px-8 py-3 rounded-xl font-semibold text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-lg shadow-indigo-500/25"
          >
            {loading ? (
              <span className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {step}
              </span>
            ) : (
              "Analyze Resume"
            )}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-8 text-red-300 text-center">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Candidate Card */}
            <Section title="Candidate Profile" icon="&#128100;">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <Info label="Name" value={result.candidate.name} />
                <Info label="Email" value={result.candidate.email} />
                <Info label="Phone" value={result.candidate.phone} />
                <Info label="Location" value={result.candidate.location} />
                {result.candidate.linkedin && (
                  <Info label="LinkedIn" value={result.candidate.linkedin} />
                )}
              </div>
              {result.candidate.summary && (
                <p className="text-slate-300 bg-slate-800/50 rounded-lg p-3 text-sm leading-relaxed">
                  {result.candidate.summary}
                </p>
              )}
            </Section>

            {/* Job Category */}
            <Section title="Job Category" icon="&#127919;">
              <div className="inline-block px-5 py-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-semibold text-lg">
                {result.jobCategory}
              </div>
            </Section>

            {/* Education */}
            {result.education?.length > 0 && (
              <Section title="Education" icon="&#127891;">
                <div className="space-y-3">
                  {result.education.map((edu, i) => (
                    <div key={i} className="bg-slate-800/50 rounded-lg p-4">
                      <p className="font-semibold text-white">
                        {edu.degree} {edu.field && `in ${edu.field}`}
                      </p>
                      <p className="text-slate-400 text-sm">
                        {edu.institution} {edu.year && `· ${edu.year}`}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Experience */}
            {result.experience?.length > 0 && (
              <Section title="Work Experience" icon="&#128188;">
                <div className="space-y-4">
                  {result.experience.map((exp, i) => (
                    <div key={i} className="bg-slate-800/50 rounded-lg p-4">
                      <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                        <div>
                          <p className="font-semibold text-white">{exp.title}</p>
                          <p className="text-indigo-300 text-sm">{exp.company}</p>
                        </div>
                        <span className="text-slate-500 text-sm shrink-0">{exp.dates}</span>
                      </div>
                      {exp.highlights?.length > 0 && (
                        <ul className="space-y-1 mt-2">
                          {exp.highlights.map((h, j) => (
                            <li key={j} className="text-slate-400 text-sm flex gap-2">
                              <span className="text-indigo-500 mt-0.5">{"▸"}</span>
                              {h}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Skills */}
            <Section title="Skills" icon="&#128736;">
              <div className="space-y-4">
                {result.skills?.technical?.length > 0 && (
                  <SkillGroup label="Technical" skills={result.skills.technical} color="indigo" />
                )}
                {result.skills?.tools?.length > 0 && (
                  <SkillGroup label="Tools & Platforms" skills={result.skills.tools} color="emerald" />
                )}
                {result.skills?.soft?.length > 0 && (
                  <SkillGroup label="Soft Skills" skills={result.skills.soft} color="amber" />
                )}
              </div>
            </Section>

            {/* Recommendations */}
            {result.recommendations?.length > 0 && (
              <Section title="Job Recommendations" icon="&#128640;">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-semibold text-white">{rec.title}</p>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-500/15 text-green-400 shrink-0">
                          {rec.matchScore}% match
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm">{rec.reason}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {result.strengths?.length > 0 && (
                <Section title="Strengths" icon="&#128170;">
                  <ul className="space-y-2">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-green-400">{"✓"}</span> {s}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              {result.improvements?.length > 0 && (
                <Section title="Suggestions" icon="&#128161;">
                  <ul className="space-y-2">
                    {result.improvements.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-amber-400">{"→"}</span> {s}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span dangerouslySetInnerHTML={{ __html: icon }} /> {title}
      </h2>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-white">{value || "Not detected"}</p>
    </div>
  );
}

function SkillGroup({ label, skills, color }: { label: string; skills: string[]; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/20",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  };
  return (
    <div>
      <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {skills.map((s, i) => (
          <span key={i} className={`px-3 py-1 rounded-full text-sm border ${colorMap[color]}`}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
