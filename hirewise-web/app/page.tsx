"use client";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Database } from "lucide-react";
import { api } from "@/lib/api";
import { useActiveJob, useCandidates } from "@/lib/hooks";
import { Button, Card, CardHeader, Skeleton } from "@/components/ui";
import { STEPS } from "@/components/sidebar";

const BLURB = ["Generate a bias-checked job description", "Parse PDF / DOCX / TXT resumes", "Score every candidate against the job",
  "Rank, filter and shortlist", "Tailored interview questions", "Personalised outreach emails", "Ask questions and get a summary"];

export default function Home() {
  const qc = useQueryClient();
  const job = useActiveJob();
  const cands = useCandidates(job.data?.id);
  const seed = useMutation({
    mutationFn: () => api<{ candidates_added: number }>("/api/seed", { method: "POST" }),
    onSuccess: (d) => {
      qc.removeQueries({ queryKey: ["cache"] });
      qc.invalidateQueries();
      toast.success(d.candidates_added ? "Demo job and 8 candidates loaded." : "Demo data was already loaded.");
    },
  });
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold">Welcome to Hire<span className="text-indigo-600">Wise</span></h1>
      <p className="mt-1 text-slate-600">From job description to shortlist to outreach in seven steps.</p>
      <Card className="mt-6">
        <CardHeader title="Start here" desc="Pre-fill a Lead Data Platform Engineer role and 8 fictional candidates to walk the whole flow in minutes."
          right={<Button onClick={() => seed.mutate()} loading={seed.isPending}><Database className="h-4 w-4" /> Load demo data</Button>} />
        <div className="grid grid-cols-3 gap-4 p-4 text-sm">
          <div><p className="text-slate-500">Active job</p>{job.isLoading ? <Skeleton className="mt-1 h-5 w-32" /> : <p className="font-semibold">{job.data?.title ?? "None"}</p>}</div>
          <div><p className="text-slate-500">Candidates</p>{cands.isLoading ? <Skeleton className="mt-1 h-5 w-8" /> : <p className="font-semibold">{cands.data?.length ?? 0}</p>}</div>
          <div><p className="text-slate-500">Scored</p><p className="font-semibold">{cands.data?.filter((c) => c.score).length ?? 0}</p></div>
        </div>
      </Card>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {STEPS.map((s, i) => (
          <Link key={s.href} href={s.href} className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-400">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">{s.n}</span>
            <span className="flex-1"><span className="block font-semibold">{s.label}</span><span className="text-sm text-slate-500">{BLURB[i]}</span></span>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600" />
          </Link>
        ))}
      </div>
    </div>
  );
}
