"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import Link from "next/link";

interface ScreeningRecord {
  id: string;
  candidate_name: string;
  email: string | null;
  job_category: string | null;
  created_at: string;
  skills: { technical?: string[]; soft?: string[]; tools?: string[] };
  recommendations: { title: string; matchScore: number }[];
}

export default function HistoryPage() {
  const [records, setRecords] = useState<ScreeningRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      const db = getSupabase();
      if (!db) { setLoading(false); return; }
      const { data } = await db
        .from("screening_results")
        .select("id, candidate_name, email, job_category, created_at, skills, recommendations")
        .order("created_at", { ascending: false })
        .limit(50);
      setRecords(data || []);
      setLoading(false);
    }
    fetchHistory();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Screening History</h1>
          <Link
            href="/"
            className="px-4 py-2 text-sm rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] transition"
          >
            Back to Screener
          </Link>
        </div>

        {loading ? (
          <p className="text-white/40">Loading history...</p>
        ) : records.length === 0 ? (
          <p className="text-white/40">No screening results yet. Upload a resume to get started.</p>
        ) : (
          <div className="space-y-3">
            {records.map((r) => (
              <div
                key={r.id}
                className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 backdrop-blur-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{r.candidate_name}</h3>
                    <p className="text-white/40 text-sm">
                      {r.email || "No email"} &middot;{" "}
                      {new Date(r.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {r.job_category && (
                    <span className="px-3 py-1 text-xs rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/20">
                      {r.job_category}
                    </span>
                  )}
                </div>
                {r.skills?.technical && r.skills.technical.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {r.skills.technical.slice(0, 8).map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/10 text-cyan-300/80"
                      >
                        {s}
                      </span>
                    ))}
                    {r.skills.technical.length > 8 && (
                      <span className="px-2 py-0.5 text-xs text-white/30">
                        +{r.skills.technical.length - 8} more
                      </span>
                    )}
                  </div>
                )}
                {r.recommendations && r.recommendations.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {r.recommendations.slice(0, 3).map((rec) => (
                      <span
                        key={rec.title}
                        className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 text-emerald-300/80"
                      >
                        {rec.title} ({rec.matchScore}%)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
