"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useMutation } from "@tanstack/react-query";
import { Download, FileText, Send } from "lucide-react";
import { api } from "@/lib/api";
import { useActiveJob, useCache, useCandidates } from "@/lib/hooks";
import type { ChatMsg } from "@/lib/types";
import { cn, download } from "@/lib/utils";
import { Button, Card, CardHeader, Empty, Input, PageHeader, Skeleton, SkeletonLines, Tabs } from "@/components/ui";

const SUGGESTIONS = ["Who has Python and AWS?", "Compare the top 2", "Who is missing Spark?", "Who has Kafka experience?", "Summarise the pipeline"];

export default function AssistantPage() {
  const job = useActiveJob();
  const cands = useCandidates(job.data?.id);
  const [tab, setTab] = useState<"chat" | "report">("chat");
  const [msgs, setMsgs] = useCache<ChatMsg[]>("chat", []);
  const [report, setReport] = useCache<string>("report", "");
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);

  const chat = useMutation({
    mutationFn: (history: ChatMsg[]) => api<{ answer: string }>("/api/assistant/chat", { body: { messages: history } }),
    onSuccess: (d) => setMsgs((p) => [...p, { role: "assistant", content: d.answer }]),
  });
  const rep = useMutation({
    mutationFn: () => api<{ markdown: string }>("/api/assistant/report", { body: { job_id: job.data!.id } }),
    onSuccess: (d) => setReport(d.markdown),
  });
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, chat.isPending]);

  const ask = (text: string) => {
    const t = text.trim();
    if (!t || chat.isPending) return;
    const next = [...msgs, { role: "user" as const, content: t }];
    setMsgs(next); setDraft(""); chat.mutate(next);
  };

  const head = <PageHeader step={7} title="Assistant & Report" desc="Ask questions about your candidates, or generate a hiring summary. Answers use only your data." />;
  if (job.isLoading || cands.isLoading) return <div>{head}<Skeleton className="h-40" /></div>;
  if (!cands.data?.length) return <div>{head}<Empty title="Nothing to ask about yet" text="Add candidates in step 2 and score them in step 3, or load the demo data." href="/resumes" cta="Go to Resume Parser" /></div>;
  const scored = cands.data.some((c) => c.score);

  return (
    <div>
      {head}
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "chat", label: "Chat" }, { id: "report", label: "Report" }]} />
      {!scored && <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Candidates have not been scored yet; answers about match quality will be limited. Run step 3 first.</p>}
      {tab === "chat" ? (
        <Card className="flex h-[calc(100vh-15rem)] min-h-[420px] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {msgs.length === 0 && <p className="text-sm text-slate-500">Ask anything about the active job, candidates, scores or shortlist.</p>}
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm", m.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100")}>{m.content}</div>
              </div>
            ))}
            {chat.isPending && <div className="flex"><div className="flex gap-1 rounded-2xl bg-slate-100 px-4 py-3" aria-label="Assistant is typing">
              {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 150}ms` }} />)}</div></div>}
            <div ref={end} />
          </div>
          <div className="space-y-2 border-t border-slate-100 p-3">
            <div className="flex flex-wrap gap-1.5">{SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} disabled={chat.isPending} className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50">{s}</button>))}</div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
              <Input aria-label="Message" placeholder="Ask about your candidates…" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={chat.isPending} />
              <Button type="submit" loading={chat.isPending} disabled={!draft.trim()}><Send className="h-4 w-4" /> Send</Button>
              {msgs.length > 0 && <Button type="button" variant="ghost" onClick={() => setMsgs([])} disabled={chat.isPending}>Clear</Button>}
            </form>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Hiring summary" desc="Pipeline counts, top candidates, common gaps and next steps."
            right={<div className="flex gap-2">
              <Button onClick={() => job.data && rep.mutate()} loading={rep.isPending} disabled={!job.data}><FileText className="h-4 w-4" /> Generate hiring summary</Button>
              <Button variant="outline" onClick={() => download("hiring-summary.md", report, "text/markdown")} disabled={!report || rep.isPending}><Download className="h-4 w-4" /> .md</Button></div>} />
          <div className="p-6">
            {rep.isPending ? <SkeletonLines n={12} /> : report ? <article className="prose prose-slate max-w-none"><ReactMarkdown>{report}</ReactMarkdown></article>
              : !job.data ? <Empty title="No active job" text="A report needs a job. Create one in step 1." href="/jd" cta="Go to JD Generator" />
              : <p className="text-sm text-slate-500">Press “Generate hiring summary”.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
