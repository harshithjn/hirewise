"use client";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, FlaskConical, Trash2, UploadCloud, X } from "lucide-react";
import { upload } from "@/lib/api";
import { useActiveJob, useCache, useCandidates } from "@/lib/hooks";
import type { Candidate, ParseResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Alert, Badge, Button, Card, CardHeader, Chips, Drawer, Empty, PageHeader, Progress, Skeleton } from "@/components/ui";

const SAMPLES = ["resume_1_anika_rao.pdf", "resume_2_callum_reyes.txt", "resume_3_mei_tanaka.pdf", "resume_4_oliver_brandt.txt",
  "resume_5_zara_hussain.pdf", "resume_6_noah_fischer.txt", "resume_7_ingrid_larsen.pdf", "resume_8_luca_moretti.txt"];
const OK = /\.(pdf|docx|txt)$/i;

export default function ResumesPage() {
  const qc = useQueryClient();
  const job = useActiveJob();
  const cands = useCandidates(job.data?.id);
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [pct, setPct] = useState(0);
  const [last, setLast] = useCache<ParseResult | null>("parse-result", null);
  const [open, setOpen] = useState<Candidate | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const addFiles = (list: File[]) => {
    const bad = list.filter((f) => !OK.test(f.name));
    if (bad.length) toast.error(`Unsupported: ${bad.map((f) => f.name).join(", ")}. Use PDF, DOCX or TXT.`);
    setFiles((prev) => [...prev, ...list.filter((f) => OK.test(f.name) && !prev.some((p) => p.name === f.name && p.size === f.size))]);
  };

  const parse = useMutation({
    mutationFn: () => { setPct(0); return upload<ParseResult>("/api/candidates/parse", files, setPct); },
    onSuccess: (d) => {
      setLast(d); setFiles([]);
      qc.invalidateQueries({ queryKey: ["candidates"] });
      const extra = [d.duplicates.length && `${d.duplicates.length} duplicate(s) skipped`, d.failed.length && `${d.failed.length} failed`].filter(Boolean).join(", ");
      (d.failed.length ? toast.warning : toast.success)(`${d.candidates.length} resume(s) parsed${extra ? `, ${extra}` : ""}.`);
    },
  });
  const samples = useMutation({
    mutationFn: async () => Promise.all(SAMPLES.map(async (n) => {
      const r = await fetch(`/samples/${n}`);
      if (!r.ok) throw new Error(`Could not load sample ${n}`);
      return new File([await r.blob()], n);
    })),
    onSuccess: (f) => { addFiles(f); toast.success("8 sample resumes added. Press Parse."); },
  });

  const uploading = parse.isPending && pct < 100;
  return (
    <div>
      <PageHeader step={2} title="Resume Parser" desc="Upload resumes (PDF, DOCX or TXT). The AI extracts structured profiles; nothing is invented." />
      <Card>
        <div role="button" tabIndex={0} aria-label="Upload resumes" onClick={() => input.current?.click()} onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(Array.from(e.dataTransfer.files)); }}
          className={cn("m-4 flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed p-8 text-center", drag ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:bg-slate-50")}>
          <UploadCloud className="mb-2 h-8 w-8 text-indigo-500" />
          <p className="font-medium">Drag and drop resumes here, or click to browse</p>
          <p className="text-sm text-slate-500">PDF, DOCX or TXT · up to 10 MB each</p>
          <input ref={input} type="file" multiple accept=".pdf,.docx,.txt" hidden onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        </div>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-2">
            {files.map((f) => (
              <Badge key={f.name + f.size} tone="indigo" className="text-sm"><FileText className="h-3.5 w-3.5" />{f.name}
                <button aria-label={`Remove ${f.name}`} disabled={parse.isPending} onClick={() => setFiles(files.filter((x) => x !== f))}><X className="h-3 w-3" /></button></Badge>
            ))}
          </div>
        )}
        {parse.isPending && (
          <div className="px-4 pb-2">
            <Progress value={uploading ? pct : undefined} />
            <p className="mt-1 text-sm text-slate-600">{uploading ? `Uploading… ${pct}%` : "Parsing resumes with AI…"}</p>
          </div>
        )}
        <div className="flex gap-2 border-t border-slate-100 p-4">
          <Button onClick={() => parse.mutate()} loading={parse.isPending} disabled={!files.length}>Parse {files.length || ""} resume{files.length === 1 ? "" : "s"}</Button>
          <Button variant="outline" onClick={() => samples.mutate()} loading={samples.isPending} disabled={parse.isPending}><FlaskConical className="h-4 w-4" /> Use sample resumes</Button>
          {files.length > 0 && <Button variant="ghost" onClick={() => setFiles([])} disabled={parse.isPending}><Trash2 className="h-4 w-4" /> Clear</Button>}
        </div>
      </Card>

      {last && (last.failed.length > 0 || last.duplicates.length > 0 || last.warnings.length > 0) && (
        <div className="mt-4 space-y-3">
          {last.failed.length > 0 && <Alert title={`${last.failed.length} file(s) could not be parsed`}>
            <ul className="mt-1 list-disc pl-5">{last.failed.map((f) => <li key={f.filename}><b>{f.filename}</b>: {f.reason}</li>)}</ul></Alert>}
          {last.duplicates.length > 0 && <Alert tone="amber" title="Duplicates skipped (same email or name as an existing candidate)">
            <ul className="mt-1 list-disc pl-5">{last.duplicates.map((d) => <li key={d.filename}>{d.filename}: {d.name ?? "unnamed"}</li>)}</ul></Alert>}
          {last.warnings.filter((w) => /extractable/i.test(w)).length > 0 && <Alert tone="amber" title="Scanned or image-only PDFs">
            <ul className="mt-1 list-disc pl-5">{last.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Alert>}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader title={`Candidates${cands.data ? ` (${cands.data.length})` : ""}`} desc="Click a row for the full parsed profile." />
        {cands.isLoading ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}</div>
          : !cands.data?.length ? <div className="p-4"><Empty title="No candidates yet" text="Upload resumes above, or load the demo data from the home page." href="/" cta="Go to home" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Name</th><th>Title</th><th>Experience</th><th>Top skills</th></tr></thead>
            <tbody>{cands.data.map((c) => (
              <tr key={c.id} onClick={() => setOpen(c)} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50">
                <td className="px-4 py-2.5 font-medium">{c.name ?? <span className="text-slate-400">Unknown</span>}</td>
                <td>{c.parsed.current_title ?? "—"}</td>
                <td>{c.parsed.total_experience_years != null ? `${c.parsed.total_experience_years} yrs` : "—"}</td>
                <td className="py-2"><Chips items={(c.parsed.skills ?? []).slice(0, 4)} /></td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.name ?? "Candidate"}>{open && <Profile c={open} />}</Drawer>
    </div>
  );
}

function Profile({ c }: { c: Candidate }) {
  const p = c.parsed;
  const row = (k: string, v: React.ReactNode) => <div className="grid grid-cols-3 gap-2 text-sm"><dt className="text-slate-500">{k}</dt><dd className="col-span-2">{v ?? "—"}</dd></div>;
  return (
    <div className="space-y-5">
      <dl className="space-y-1.5">
        {row("Title", p.current_title)}{row("Email", p.email)}{row("Phone", p.phone)}{row("Location", p.location)}
        {row("Experience", p.total_experience_years != null ? `${p.total_experience_years} years` : null)}{row("Source file", c.source_filename)}
      </dl>
      {p.summary && <p className="text-sm text-slate-700">{p.summary}</p>}
      <section><h3 className="mb-1.5 font-semibold">Skills</h3><Chips items={p.skills ?? []} tone="indigo" /></section>
      <section><h3 className="mb-1.5 font-semibold">Work history</h3>
        {(p.work_history ?? []).length ? p.work_history.map((w, i) => (
          <div key={i} className="mb-2 text-sm"><p className="font-medium">{w.title ?? "Role"} · {w.company ?? "—"}</p>
            <p className="text-xs text-slate-500">{w.start ?? "?"} – {w.end ?? "?"}</p>
            <ul className="list-disc pl-5 text-slate-700">{w.highlights?.map((h, j) => <li key={j}>{h}</li>)}</ul></div>
        )) : <p className="text-sm text-slate-400">None found</p>}</section>
      <section><h3 className="mb-1.5 font-semibold">Education</h3>
        {(p.education ?? []).length ? p.education.map((e, i) => <p key={i} className="text-sm">{[e.degree, e.institution, e.year].filter(Boolean).join(" · ")}</p>) : <p className="text-sm text-slate-400">None found</p>}</section>
      <section><h3 className="mb-1.5 font-semibold">Certifications</h3><Chips items={p.certifications ?? []} /></section>
      <section><h3 className="mb-1.5 font-semibold">Projects</h3>
        {(p.projects ?? []).length ? p.projects.map((x, i) => <p key={i} className="text-sm"><b>{x.name}</b> {x.description}</p>) : <p className="text-sm text-slate-400">None found</p>}</section>
    </div>
  );
}
