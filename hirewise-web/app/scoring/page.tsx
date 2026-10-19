"use client";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, TriangleAlert } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { useActiveJob, useCandidates, useScores } from "@/lib/hooks";
import type { Score } from "@/lib/types";
import { Alert, Badge, Button, Card, Chips, Drawer, Empty, PageHeader, Progress, ScoreBadge, Skeleton } from "@/components/ui";

export default function ScoringPage() {
  const qc = useQueryClient();
  const job = useActiveJob();
  const cands = useCandidates(job.data?.id);
  const scores = useScores(job.data?.id);
  const [open, setOpen] = useState<Score | null>(null);
  const [secs, setSecs] = useState(0);
  const [failed, setFailed] = useState<{ candidate_id: number; name: string | null; reason: string }[]>([]);

  const run = useMutation({
    mutationFn: () => api<{ scores: Score[]; failed: typeof failed }>("/api/scoring/run", { body: { job_id: job.data!.id } }),
    onSuccess: (d) => {
      setFailed(d.failed);
      qc.setQueryData(["scores", job.data!.id], d.scores);
      qc.invalidateQueries({ queryKey: ["candidates"] });
      if (d.failed.length) toast.warning(`${d.scores.length} scored, ${d.failed.length} failed.`);
      else toast.success(`Scored ${d.scores.length} candidates.`);
    },
  });
  useEffect(() => {
    if (!run.isPending) return setSecs(0);
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [run.isPending]);

  const n = cands.data?.length ?? 0;
  if (job.isLoading) return <Skeleton className="h-40" />;
  if (!job.data) return <div><PageHeader step={3} title="Match Scoring" desc="" /><Empty title="No active job" text="Scoring compares candidates to a job. Create or save one in step 1, or load the demo data." href="/jd" cta="Go to JD Generator" /></div>;

  return (
    <div>
      <PageHeader step={3} title="Match Scoring" desc={`Score every candidate against “${job.data.title}”: skills 50%, experience 30%, education 20%.`}
        right={<Button onClick={() => run.mutate()} loading={run.isPending} disabled={!n}><Play className="h-4 w-4" /> {scores.data?.length ? "Re-run scoring" : "Run scoring"}</Button>} />
      {run.isPending && <Card className="mb-4 p-4"><Progress /><p className="mt-2 text-sm text-slate-600">Scoring {n} candidates with AI… {secs}s (usually 15–40s)</p></Card>}
      {failed.length > 0 && <div className="mb-4"><Alert title="Some candidates could not be scored"><ul className="list-disc pl-5">{failed.map((f) => <li key={f.candidate_id}>{f.name ?? `#${f.candidate_id}`}: {f.reason}</li>)}</ul></Alert></div>}

      {cands.isLoading || scores.isLoading ? <Card><div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9" />)}</div></Card>
        : !n ? <Empty title="No candidates yet" text="Upload resumes in step 2 (or load the demo data) before scoring." href="/resumes" cta="Go to Resume Parser" />
        : !scores.data?.length ? <Empty title="Not scored yet" text={`${n} candidate(s) are ready. Press “Run scoring”.`} />
        : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">#</th><th>Candidate</th><th>Overall</th><th>Skills</th><th>Experience</th><th>Education</th><th>Missing</th></tr></thead>
            <tbody>{scores.data.map((s, i) => (
              <tr key={s.id} onClick={() => setOpen(s)} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50">
                <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                <td className="font-medium">{s.candidate_name}</td>
                <td><ScoreBadge n={s.overall_score} />{s.capped && <span title="Capped at 60: a must-have skill is missing"><TriangleAlert className="ml-1 inline h-4 w-4 text-amber-600" /></span>}</td>
                <td>{s.skill_match}</td><td>{s.experience_match}</td><td>{s.education_match}</td>
                <td className="py-2"><Chips items={s.missing_skills.slice(0, 3)} tone="red" /></td></tr>
            ))}</tbody>
          </table>
        </Card>
      )}

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.candidate_name ?? "Candidate"}>
        {open && (
          <div className="space-y-5">
            <div className="flex items-center gap-3"><ScoreBadge n={open.overall_score} /><span className="text-sm text-slate-600">overall match</span>
              {open.capped && <Badge tone="amber">Capped at 60 · must-have missing</Badge>}</div>
            <div className="h-60" aria-label="Score radar chart">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={[{ k: "Skills", v: open.skill_match }, { k: "Experience", v: open.experience_match }, { k: "Education", v: open.education_match }]} outerRadius="75%">
                  <PolarGrid /><PolarAngleAxis dataKey="k" /><Radar dataKey="v" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.4} isAnimationActive={false} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <section><h3 className="mb-1.5 font-semibold">Matched skills</h3><Chips items={open.matched_skills} tone="green" /></section>
            <section><h3 className="mb-1.5 font-semibold">Missing skills</h3><Chips items={open.missing_skills} tone="red" /></section>
            <section><h3 className="mb-1.5 font-semibold">Strengths</h3><ul className="list-disc pl-5 text-sm">{open.strengths.map((x) => <li key={x}>{x}</li>)}</ul></section>
            <section><h3 className="mb-1.5 font-semibold">Concerns</h3><ul className="list-disc pl-5 text-sm">{open.concerns.map((x) => <li key={x}>{x}</li>)}</ul></section>
            <section><h3 className="mb-1.5 font-semibold">Reasoning</h3><p className="text-sm text-slate-700">{open.reasoning}</p></section>
          </div>
        )}
      </Drawer>
    </div>
  );
}
