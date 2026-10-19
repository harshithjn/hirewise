"use client";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Mail, RefreshCw, Send, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useActiveJob, useCache, useCandidates } from "@/lib/hooks";
import type { EmailRec } from "@/lib/types";
import { hasPlaceholder } from "@/lib/utils";
import { Accordion, Alert, Badge, Button, Card, CardHeader, Empty, Input, Label, PageHeader, Select, Skeleton, SkeletonLines, Textarea } from "@/components/ui";

type Cfg = { candidateId: number | null; type: string; tone: string; recruiter: string; company: string };
const TYPES = [["invite", "Interview invite"], ["update", "Status update"], ["rejection", "Rejection"], ["offer_followup", "Offer follow-up"]];

export default function OutreachPage() {
  const job = useActiveJob();
  const cands = useCandidates(job.data?.id);
  const [cfg, setCfg] = useCache<Cfg>("outreach-cfg", { candidateId: null, type: "invite", tone: "friendly", recruiter: "Riley Morgan", company: "Vantage Logistics" });
  const [email, setEmail] = useCache<EmailRec | null>("outreach-email", null);
  const [bulk, setBulk] = useCache<EmailRec[]>("outreach-bulk", []);

  const all = cands.data ?? [];
  const shortlisted = all.filter((c) => c.decision === "shortlisted");
  const cand = all.find((c) => c.id === cfg.candidateId) ?? shortlisted[0] ?? all[0];
  const ready = cfg.recruiter.trim() && cfg.company.trim();
  const body = (id: number) => ({ candidate_id: id, job_id: job.data?.id, type: cfg.type, tone: cfg.tone, recruiter: cfg.recruiter.trim(), company: cfg.company.trim() });

  const gen = useMutation({ mutationFn: () => api<EmailRec>("/api/emails/generate", { body: body(cand!.id) }), onSuccess: (d) => setEmail(d) });
  const genAll = useMutation({
    mutationFn: async () => {
      const out: EmailRec[] = [];
      for (const c of shortlisted) out.push(await api<EmailRec>("/api/emails/generate", { body: body(c.id) }));
      return out;
    },
    onSuccess: (d) => { setBulk(d); toast.success(`${d.length} emails drafted.`); },
  });

  const head = <PageHeader step={6} title="Outreach Emails" desc="Draft personalised emails, edit them, and send (simulated, logged to the database only)." />;
  if (cands.isLoading || job.isLoading) return <div>{head}<Skeleton className="h-40" /></div>;
  if (!all.length) return <div>{head}<Empty title="No candidates yet" text="Add candidates in step 2 (or load the demo data) before drafting emails." href="/resumes" cta="Go to Resume Parser" /></div>;

  return (
    <div>
      {head}
      <Card className="mb-6">
        <div className="grid grid-cols-5 gap-3 p-4">
          <div><Label htmlFor="c">Candidate</Label>
            <Select id="c" value={cand?.id} onChange={(e) => setCfg({ ...cfg, candidateId: +e.target.value })}>
              {all.map((c) => <option key={c.id} value={c.id}>{c.name ?? `#${c.id}`}{c.decision === "shortlisted" ? " ★" : ""}</option>)}</Select></div>
          <div><Label htmlFor="t">Email type</Label><Select id="t" value={cfg.type} onChange={(e) => setCfg({ ...cfg, type: e.target.value })}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
          <div><Label htmlFor="tone">Tone</Label><Select id="tone" value={cfg.tone} onChange={(e) => setCfg({ ...cfg, tone: e.target.value })}><option value="friendly">Friendly</option><option value="formal">Formal</option></Select></div>
          <div><Label htmlFor="r">Recruiter name</Label><Input id="r" value={cfg.recruiter} onChange={(e) => setCfg({ ...cfg, recruiter: e.target.value })} /></div>
          <div><Label htmlFor="co">Company</Label><Input id="co" value={cfg.company} onChange={(e) => setCfg({ ...cfg, company: e.target.value })} /></div>
        </div>
        <div className="flex gap-2 border-t border-slate-100 p-4">
          <Button onClick={() => gen.mutate()} loading={gen.isPending} disabled={!ready || genAll.isPending}><Mail className="h-4 w-4" /> {email ? "Regenerate" : "Generate email"}</Button>
          <Button variant="outline" onClick={() => genAll.mutate()} loading={genAll.isPending} disabled={!ready || !shortlisted.length || gen.isPending}
            title={shortlisted.length ? "" : "Shortlist candidates in step 4 first"}><Users className="h-4 w-4" /> Generate for all shortlisted ({shortlisted.length})</Button>
          {!ready && <span className="self-center text-sm text-amber-700">Enter recruiter and company first.</span>}
        </div>
      </Card>

      {gen.isPending ? <Card><SkeletonLines n={8} /></Card> : email ? <EmailCard key={email.id} rec={email} name={all.find((c) => c.id === email.candidate_id)?.name} onRegenerate={() => gen.mutate()} busy={gen.isPending} />
        : <Empty title="No email drafted" text={`Choose the options above and press “Generate email” for ${cand?.name}.`} />}

      {(genAll.isPending || bulk.length > 0) && (
        <div className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Shortlisted candidates ({bulk.length}/{shortlisted.length})</h2>
          {genAll.isPending && <SkeletonLines n={4} />}
          <div className="space-y-2">{bulk.map((b) => (
            <Accordion key={b.id} title={<span>{all.find((c) => c.id === b.candidate_id)?.name} <span className="font-normal text-slate-500">· {b.subject}</span></span>}
              right={hasPlaceholder(b.body) ? <Badge tone="red">Placeholder!</Badge> : null}>
              <EmailCard rec={b} name={all.find((c) => c.id === b.candidate_id)?.name} bare />
            </Accordion>))}</div>
        </div>
      )}
    </div>
  );
}

function EmailCard({ rec, name, onRegenerate, busy, bare }: { rec: EmailRec; name?: string | null; onRegenerate?: () => void; busy?: boolean; bare?: boolean }) {
  const [subject, setSubject] = useState(rec.subject);
  const [text, setText] = useState(rec.body);
  const [sent, setSent] = useState(rec.status === "sent_simulated");
  useEffect(() => { setSubject(rec.subject); setText(rec.body); setSent(rec.status === "sent_simulated"); }, [rec]);
  const send = useMutation({
    mutationFn: () => api<EmailRec>("/api/emails/send-simulated", { body: { email_id: rec.id, subject, body: text } }),
    onSuccess: () => { setSent(true); toast.success(`Email to ${name ?? "candidate"} sent (simulated) and logged.`); },
  });
  const bad = hasPlaceholder(subject) || hasPlaceholder(text);
  const inner = (
    <div className="space-y-3">
      {bad && <Alert title="Unfilled placeholder detected">Replace anything in [brackets] before sending. Sending is blocked until it is fixed.</Alert>}
      <div className="rounded-md border border-slate-200 text-sm">
        <div className="grid grid-cols-[4rem_1fr] items-center border-b border-slate-100 px-3 py-1.5"><span className="text-slate-500">To</span><span>{name} {rec.to_email && <span className="text-slate-500">&lt;{rec.to_email}&gt;</span>}</span></div>
        <div className="grid grid-cols-[4rem_1fr] items-center border-b border-slate-100 px-3 py-1"><span className="text-slate-500">Subject</span>
          <input aria-label="Subject" className="py-1 font-semibold outline-none" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <Textarea aria-label="Email body" rows={11} className="rounded-none border-0 focus-visible:ring-0" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        {onRegenerate && <Button variant="outline" onClick={onRegenerate} disabled={busy || send.isPending}><RefreshCw className="h-4 w-4" /> Regenerate</Button>}
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(`Subject: ${subject}\n\n${text}`).then(() => toast.success("Copied to clipboard."), () => toast.error("Clipboard is not available."))}><Copy className="h-4 w-4" /> Copy</Button>
        <Button onClick={() => send.mutate()} loading={send.isPending} disabled={bad || sent}><Send className="h-4 w-4" /> {sent ? "Sent (simulated)" : "Send (simulated)"}</Button>
        <Badge tone={sent ? "green" : "slate"}>{sent ? "sent" : "draft"}</Badge>
      </div>
    </div>
  );
  return bare ? inner : <Card><CardHeader title="Preview" desc="Editable. Placeholders block sending." /><div className="p-4">{inner}</div></Card>;
}
