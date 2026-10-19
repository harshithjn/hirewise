"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer, RefreshCw, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useActiveJob, useCache, useCandidates } from "@/lib/hooks";
import type { Kit, Question } from "@/lib/types";
import { Accordion, Button, Card, Empty, Input, Label, PageHeader, Select, Skeleton, SkeletonLines, Tabs } from "@/components/ui";

type Cat = keyof Kit;
const CATS: { id: Cat; label: string }[] = [{ id: "technical", label: "Technical" }, { id: "behavioral", label: "Behavioral" }, { id: "gap_probing", label: "Gap-probing" }];
type Cfg = { candidateId: number | null; level: string; counts: Record<Cat, number> };

export default function InterviewPage() {
  const job = useActiveJob();
  const cands = useCandidates(job.data?.id);
  const [cfg, setCfg] = useCache<Cfg>("interview-cfg", { candidateId: null, level: "senior", counts: { technical: 4, behavioral: 3, gap_probing: 3 } });
  const [kits, setKits] = useCache<Record<string, Kit>>("interview-kits", {});
  const [tab, setTab] = useState<Cat>("technical");
  const [regen, setRegen] = useState<string | null>(null);

  const shortlisted = (cands.data ?? []).filter((c) => c.decision === "shortlisted");
  const cand = shortlisted.find((c) => c.id === cfg.candidateId) ?? shortlisted[0];
  const key = cand ? `${cand.id}-${cfg.level}` : "";
  const kit = kits[key];

  const gen = useMutation({
    mutationFn: () => api<Kit>("/api/interview/generate", { body: { candidate_id: cand!.id, job_id: job.data!.id, level: cfg.level, counts: cfg.counts } }),
    onSuccess: (d) => { setKits((p) => ({ ...p, [key]: d })); toast.success("Interview kit ready."); },
  });
  const redo = useMutation({
    mutationFn: (v: { cat: Cat; i: number }) => {
      const list = kit[v.cat];
      return api<Question>("/api/interview/regenerate", { body: { candidate_id: cand!.id, job_id: job.data!.id, level: cfg.level, category: v.cat,
        current_question: list[v.i].question, avoid: list.map((q) => q.question) } });
    },
    onMutate: (v) => setRegen(`${v.cat}-${v.i}`),
    onSettled: () => setRegen(null),
    onSuccess: (q, v) => setKits((p) => ({ ...p, [key]: { ...p[key], [v.cat]: p[key][v.cat].map((x, i) => (i === v.i ? q : x)) } })),
  });

  const head = <PageHeader step={5} title="Interview Questions" desc="Tailored technical, behavioral and gap-probing questions with ideal answers and red flags." />;
  if (job.isLoading || cands.isLoading) return <div>{head}<Skeleton className="h-40" /></div>;
  if (!job.data) return <div>{head}<Empty title="No active job" text="Create a job in step 1 or load the demo data." href="/jd" cta="Go to JD Generator" /></div>;
  if (!shortlisted.length) return <div>{head}<Empty title="No shortlisted candidates" text="Shortlist at least one candidate in step 4 to generate their interview questions." href="/ranking" cta="Go to Ranking & Shortlist" /></div>;

  const setCount = (c: Cat, v: string) => setCfg({ ...cfg, counts: { ...cfg.counts, [c]: Math.max(0, Math.min(10, +v || 0)) } });
  return (
    <div>
      {head}
      <Card className="no-print mb-4">
        <div className="grid grid-cols-6 items-end gap-3 p-4">
          <div className="col-span-2"><Label htmlFor="cand">Candidate</Label>
            <Select id="cand" value={cand?.id} onChange={(e) => setCfg({ ...cfg, candidateId: +e.target.value })}>
              {shortlisted.map((c) => <option key={c.id} value={c.id}>{c.name}{c.score ? ` (${c.score.overall_score})` : ""}</option>)}</Select></div>
          <div><Label htmlFor="level">Level</Label>
            <Select id="level" value={cfg.level} onChange={(e) => setCfg({ ...cfg, level: e.target.value })}>{["junior", "mid", "senior", "lead"].map((l) => <option key={l}>{l}</option>)}</Select></div>
          {CATS.map((c) => <div key={c.id}><Label htmlFor={`n-${c.id}`}>{c.label}</Label><Input id={`n-${c.id}`} type="number" min={0} max={10} value={cfg.counts[c.id]} onChange={(e) => setCount(c.id, e.target.value)} /></div>)}
        </div>
        <div className="flex gap-2 border-t border-slate-100 p-4">
          <Button onClick={() => gen.mutate()} loading={gen.isPending} disabled={redo.isPending}><Sparkles className="h-4 w-4" /> {kit ? "Regenerate all" : "Generate questions"}</Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!kit}><Printer className="h-4 w-4" /> Print scorecard</Button>
        </div>
      </Card>

      {gen.isPending ? <Card><SkeletonLines n={10} /></Card> : !kit ? (
        <Empty title="No questions yet" text={`Press “Generate questions” to build an interview kit for ${cand?.name}.`} />
      ) : (
        <div className="no-print">
          <Tabs value={tab} onChange={setTab} tabs={CATS.map((c) => ({ id: c.id, label: `${c.label} (${kit[c.id].length})` }))} />
          <div className="space-y-2">
            {kit[tab].map((q, i) => (
              <Accordion key={`${tab}-${i}-${q.question}`} defaultOpen={i === 0} title={<span>{i + 1}. {q.question}</span>}
                right={<Button size="sm" variant="outline" loading={regen === `${tab}-${i}`} disabled={redo.isPending || gen.isPending} onClick={() => redo.mutate({ cat: tab, i })}><RefreshCw className="h-3.5 w-3.5" /> Regenerate</Button>}>
                <QuestionBody q={q} />
              </Accordion>
            ))}
            {!kit[tab].length && <Empty title="None requested" text="Set a count above 0 and regenerate." />}
          </div>
        </div>
      )}

      {kit && cand && (
        <div className="print-only">
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Interview scorecard — {cand.name}</h1>
          <p>{job.data.title} · {cfg.level} level · Interviewer: ______________ Date: __________</p>
          {CATS.map((c) => (
            <div key={c.id}><h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 16 }}>{c.label}</h2>
              {kit[c.id].map((q, i) => (
                <div key={i} className="scorecard-q" style={{ margin: "10px 0", paddingBottom: 8, borderBottom: "1px solid #ccc" }}>
                  <p><b>{i + 1}. {q.question}</b></p>
                  <p style={{ fontSize: 12 }}>Tests: {q.what_it_tests}</p>
                  <p style={{ fontSize: 12 }}>Look for: {q.ideal_answer_points.join(" · ")}</p>
                  <p style={{ fontSize: 12 }}>Red flags: {q.red_flags.join(" · ") || "—"}</p>
                  <p style={{ fontSize: 12 }}>Rating: ☐ 1 ☐ 2 ☐ 3 ☐ 4 ☐ 5 &nbsp; Notes: ________________________________</p>
                </div>
              ))}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionBody({ q }: { q: Question }) {
  return (
    <div className="space-y-3 text-sm">
      <div><p className="font-semibold text-slate-500">What it tests</p><p>{q.what_it_tests}</p></div>
      <div><p className="font-semibold text-emerald-700">Ideal answer points</p><ul className="list-disc pl-5">{q.ideal_answer_points.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
      <div><p className="font-semibold text-red-700">Red flags</p>{q.red_flags.length ? <ul className="list-disc pl-5">{q.red_flags.map((p, i) => <li key={i}>{p}</li>)}</ul> : <p className="text-slate-400">None listed</p>}</div>
    </div>
  );
}
