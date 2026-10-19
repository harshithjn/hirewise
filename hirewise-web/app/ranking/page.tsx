"use client";
import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, GitCompare, Check, X } from "lucide-react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { useActiveJob, useCache, useCandidates } from "@/lib/hooks";
import type { Candidate, Decision } from "@/lib/types";
import { download, norm, scoreTone } from "@/lib/utils";
import { Button, Card, CardHeader, Empty, Label, PageHeader, ScoreBadge, Select, Skeleton } from "@/components/ui";

const COLORS = { green: "#059669", amber: "#d97706", red: "#dc2626" };
type Filters = { min: number; skills: string[]; topN: number };

export default function RankingPage() {
  const qc = useQueryClient();
  const job = useActiveJob();
  const cands = useCandidates(job.data?.id);
  const [f, setF] = useCache<Filters>("ranking-filters", { min: 0, skills: [], topN: 0 });
  const [summary, setSummary] = useCache<string>("compare-summary", "");

  const scored = useMemo(() => (cands.data ?? []).filter((c) => c.score).sort((a, b) => b.score!.overall_score - a.score!.overall_score), [cands.data]);
  const mustHaves = job.data?.structured.must_have_skills ?? [];
  const rows = useMemo(() => {
    const out = scored.filter((c) => c.score!.overall_score >= f.min).filter((c) => {
      const have = new Set([...(c.parsed.skills ?? []), ...c.score!.matched_skills].map(norm));
      return f.skills.every((s) => have.has(norm(s)));
    });
    return f.topN ? out.slice(0, f.topN) : out;
  }, [scored, f]);

  const decide = useMutation({
    mutationFn: (v: { c: Candidate; d: Decision }) => api("/api/shortlist/decision", { body: { candidate_id: v.c.id, decision: v.d, job_id: job.data!.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
  });
  const compare = useMutation({
    mutationFn: () => api<{ summary: string }>("/api/shortlist/compare", { body: { job_id: job.data!.id, top_n: Math.min(Math.max(rows.length, 2), 5) } }),
    onSuccess: (d) => setSummary(d.summary),
  });
  const toggle = (c: Candidate, d: "shortlisted" | "rejected") => decide.mutate({ c, d: c.decision === d ? "undecided" : d });

  const exportCsv = () => {
    const list = scored.filter((c) => c.decision === "shortlisted");
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["Name,Email,Title,Experience (yrs),Overall score,Missing skills",
      ...list.map((c) => [c.name, c.email, c.parsed.current_title, c.parsed.total_experience_years, c.score!.overall_score, c.score!.missing_skills.join("; ")].map(q).join(","))].join("\n");
    download("shortlist.csv", csv, "text/csv");
  };
  const shortlisted = scored.filter((c) => c.decision === "shortlisted").length;

  if (job.isLoading || cands.isLoading) return <Skeleton className="h-60" />;
  if (!job.data) return <div><PageHeader step={4} title="Ranking & Shortlist" desc="" /><Empty title="No active job" text="Create a job in step 1 or load the demo data." href="/jd" cta="Go to JD Generator" /></div>;
  if (!scored.length) return <div><PageHeader step={4} title="Ranking & Shortlist" desc="" /><Empty title="No scores yet" text="Run match scoring first; the leaderboard is built from those scores." href="/scoring" cta="Go to Match Scoring" /></div>;

  return (
    <div>
      <PageHeader step={4} title="Ranking & Shortlist" desc="Filter the leaderboard, then shortlist or reject. Filters only change the view." />
      <Card className="mb-4">
        <div className="grid grid-cols-4 items-end gap-4 p-4">
          <div><Label htmlFor="min">Minimum score: <b>{f.min}</b></Label>
            <input id="min" type="range" min={0} max={100} value={f.min} onChange={(e) => setF({ ...f, min: +e.target.value })} className="w-full accent-indigo-600" /></div>
          <div className="col-span-2"><Label>Must-have skills</Label>
            <div className="flex flex-wrap gap-1.5">
              {mustHaves.length ? mustHaves.map((s) => {
                const on = f.skills.includes(s);
                return <button key={s} aria-pressed={on} onClick={() => setF({ ...f, skills: on ? f.skills.filter((x) => x !== s) : [...f.skills, s] })}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white hover:bg-slate-100"}`}>{s}</button>;
              }) : <span className="text-sm text-slate-400">The active job has no structured skills.</span>}
            </div></div>
          <div><Label htmlFor="topn">Show</Label>
            <Select id="topn" value={f.topN} onChange={(e) => setF({ ...f, topN: +e.target.value })}>
              <option value={0}>All candidates</option>{[3, 5, 10].map((n) => <option key={n} value={n}>Top {n}</option>)}</Select></div>
        </div>
      </Card>

      <div className="grid grid-cols-5 gap-6">
        <Card className="col-span-3">
          <CardHeader title={`Leaderboard (${rows.length}/${scored.length})`}
            right={<Button variant="outline" size="sm" onClick={exportCsv} disabled={!shortlisted}><Download className="h-4 w-4" /> Export shortlist CSV ({shortlisted})</Button>} />
          {rows.length === 0 ? <div className="p-4"><Empty title="No candidates match these filters" text="Lower the minimum score or clear the skill filters." /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">#</th><th>Candidate</th><th>Score</th><th>Missing</th><th className="pr-4 text-right">Decision</th></tr></thead>
              <tbody>{rows.map((c, i) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                  <td><p className="font-medium">{c.name}</p><p className="text-xs text-slate-500">{c.parsed.current_title}</p></td>
                  <td><ScoreBadge n={c.score!.overall_score} /></td>
                  <td className="text-xs text-red-700">{c.score!.missing_skills.slice(0, 2).join(", ")}</td>
                  <td className="space-x-1 pr-4 text-right">
                    <Button size="sm" variant={c.decision === "shortlisted" ? "success" : "outline"} aria-pressed={c.decision === "shortlisted"} disabled={decide.isPending} onClick={() => toggle(c, "shortlisted")}><Check className="h-3.5 w-3.5" /> Shortlist</Button>
                    <Button size="sm" variant={c.decision === "rejected" ? "destructive" : "outline"} aria-pressed={c.decision === "rejected"} disabled={decide.isPending} onClick={() => toggle(c, "rejected")}><X className="h-3.5 w-3.5" /> Reject</Button>
                  </td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card className="col-span-2 self-start">
          <CardHeader title="Scores" desc={`Dashed line = cutoff (${f.min})`} />
          <div className="h-80 p-2" aria-label="Score bar chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.map((c) => ({ name: c.name, score: c.score!.overall_score }))} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" domain={[0, 100]} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="score" isAnimationActive={false}>{rows.map((c) => <Cell key={c.id} fill={COLORS[scoreTone(c.score!.overall_score)]} />)}</Bar>
                <ReferenceLine x={f.min} stroke="#334155" strokeDasharray="5 4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Candidate comparison" desc="AI summary of trade-offs between the top candidates, from stored scores only."
          right={<Button onClick={() => compare.mutate()} loading={compare.isPending} disabled={rows.length < 2}><GitCompare className="h-4 w-4" /> Generate comparison</Button>} />
        <div className="p-4 text-sm leading-relaxed">
          {compare.isPending ? <Skeleton className="h-16" /> : summary ? <p>{summary}</p> : <p className="text-slate-500">{rows.length < 2 ? "At least two candidates must be visible to compare." : "Press “Generate comparison”."}</p>}
        </div>
      </Card>
    </div>
  );
}
