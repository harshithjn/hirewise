"use client";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Save, ShieldCheck, Wand2 } from "lucide-react";
import { api } from "@/lib/api";
import { useCache } from "@/lib/hooks";
import { download } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, FieldError, Input, Label, PageHeader, Select, SkeletonLines, TagInput, Textarea } from "@/components/ui";

const intField = z.string().regex(/^\d{0,2}$/, "Whole number, 0-99");
const schema = z.object({
  title: z.string().trim().min(2, "Job title is required"),
  department: z.string(), expMin: intField, expMax: intField, location: z.string(), type: z.string(),
  must_have: z.array(z.string()).min(1, "Add at least one must-have skill"),
  nice_to_have: z.array(z.string()), notes: z.string(),
}).refine((v) => !v.expMin || !v.expMax || +v.expMin <= +v.expMax, { path: ["expMax"], message: "Max must be at least min" });
type Form = z.infer<typeof schema>;
const DEFAULTS: Form = {
  title: "Lead Data Platform Engineer", department: "Customer Analytics Platform", expMin: "5", expMax: "9",
  location: "Remote (US time zones)", type: "Full-time",
  must_have: ["Python", "SQL", "Airflow", "Spark", "dbt", "Data modeling"], nice_to_have: ["Kafka", "Terraform"],
  notes: "Own the pipelines behind our customer analytics product on AWS (S3, Glue, Redshift). Team of 12 engineers; mentor two mid-level engineers and partner with analysts and ML engineers. Part of the platform is moving to streaming.",
};

type Flag = { phrase: string; suggestion: string };
type Gen = { jd_text: string; structured: Record<string, unknown> };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function JdPage() {
  const qc = useQueryClient();
  const [saved, setSaved] = useCache<Form>("jd-form", DEFAULTS);
  const [text, setText] = useCache("jd-text", "");
  const [structured, setStructured] = useCache<Record<string, unknown>>("jd-structured", {});
  const [flags, setFlags] = useCache<Flag[] | null>("jd-flags", null);
  const [shown, setShown] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const { register, control, handleSubmit, getValues, formState: { errors }, reset } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: saved });
  useEffect(() => { reset(saved); }, [saved, reset]);
  useEffect(() => () => clearInterval(timer.current), []);

  const reveal = (full: string) => {
    clearInterval(timer.current);
    const step = Math.max(12, Math.ceil(full.length / 45));
    let i = 0;
    setShown("");
    timer.current = setInterval(() => {
      i += step;
      if (i >= full.length) { clearInterval(timer.current); setShown(null); setText(full); }
      else setShown(full.slice(0, i));
    }, 30);
  };

  const gen = useMutation({
    mutationFn: (f: Form) => api<Gen>("/api/jobs/generate", { body: { brief: {
      title: f.title, department: f.department || null, experience_min_years: f.expMin ? +f.expMin : null,
      experience_max_years: f.expMax ? +f.expMax : null, location: f.location || null, employment_type: f.type,
      must_have: f.must_have, nice_to_have: f.nice_to_have, notes: f.notes || null } } }),
    onSuccess: (d) => { setStructured(d.structured); setFlags(null); reveal(d.jd_text); toast.success("Job description generated."); },
  });
  const bias = useMutation({
    mutationFn: () => api<{ flags: Flag[] }>("/api/jobs/bias-check", { body: { jd_text: text } }),
    onSuccess: (d) => {
      setFlags(d.flags);
      if (d.flags.length) toast.warning(`${d.flags.length} biased phrase(s) found.`);
      else toast.success("No biased language found.");
    },
  });
  const save = useMutation({
    mutationFn: () => api("/api/jobs", { body: { title: getValues("title") || undefined, jd_text: text, structured } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job"] }); qc.invalidateQueries({ queryKey: ["candidates"] }); toast.success("Saved as the active job."); },
  });

  const applyFixes = () => {
    let t = text;
    flags?.forEach((f) => { t = t.replace(new RegExp(esc(f.phrase), "gi"), f.suggestion); });
    setText(t); setFlags([]); toast.success("Suggested replacements applied.");
  };
  const busy = gen.isPending || bias.isPending || save.isPending || shown !== null;
  const hasText = text.trim().length > 0;

  return (
    <div>
      <PageHeader step={1} title="JD Generator" desc="Describe the role, generate a job description, then check it for biased wording." />
      <div className="grid grid-cols-5 gap-6">
        <Card className="col-span-2 self-start">
          <CardHeader title="Hiring brief" />
          <form className="space-y-3 p-4" onSubmit={handleSubmit((f) => { setSaved(f); gen.mutate(f); })} noValidate>
            <div><Label htmlFor="title">Job title *</Label><Input id="title" {...register("title")} placeholder="Lead Data Platform Engineer" /><FieldError msg={errors.title?.message} /></div>
            <div><Label htmlFor="dept">Department</Label><Input id="dept" {...register("department")} placeholder="Data Platform" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="min">Min years</Label><Input id="min" inputMode="numeric" {...register("expMin")} placeholder="5" /><FieldError msg={errors.expMin?.message} /></div>
              <div><Label htmlFor="max">Max years</Label><Input id="max" inputMode="numeric" {...register("expMax")} placeholder="9" /><FieldError msg={errors.expMax?.message} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="loc">Location</Label><Input id="loc" {...register("location")} placeholder="Remote (US)" /></div>
              <div><Label htmlFor="type">Type</Label>
                <Select id="type" {...register("type")}>{["Full-time", "Part-time", "Contract", "Internship"].map((t) => <option key={t}>{t}</option>)}</Select></div>
            </div>
            <div><Label>Must-have skills *</Label>
              <Controller control={control} name="must_have" render={({ field }) => <TagInput value={field.value} onChange={field.onChange} placeholder="Type a skill, press Enter" />} />
              <FieldError msg={errors.must_have?.message} /></div>
            <div><Label>Nice-to-have skills</Label>
              <Controller control={control} name="nice_to_have" render={({ field }) => <TagInput value={field.value} onChange={field.onChange} placeholder="Type a skill, press Enter" />} /></div>
            <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" rows={4} {...register("notes")} placeholder="Team size, tech stack, mentoring…" /></div>
            <Button type="submit" className="w-full" loading={gen.isPending} disabled={busy}><Wand2 className="h-4 w-4" /> Generate</Button>
          </form>
        </Card>

        <Card className="col-span-3 self-start">
          <CardHeader title="Job description" desc="Editable. Edits are kept when you save."
            right={<div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => bias.mutate()} loading={bias.isPending} disabled={!hasText || busy}><ShieldCheck className="h-4 w-4" /> Check bias</Button>
              <Button variant="outline" size="sm" onClick={() => download("job-description.txt", text)} disabled={!hasText || busy}><Download className="h-4 w-4" /> .txt</Button>
              <Button size="sm" onClick={() => save.mutate()} loading={save.isPending} disabled={!hasText || busy}><Save className="h-4 w-4" /> Save as active job</Button>
            </div>} />
          {flags && (
            <div className="border-b border-slate-100 p-4">
              {flags.length === 0 ? <p className="text-sm text-emerald-700">No biased or exclusionary phrases found.</p> : (
                <>
                  <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Flagged phrases</p><Button size="sm" onClick={applyFixes}>Apply fixes</Button></div>
                  <div className="flex flex-wrap gap-2">
                    {flags.map((f) => <Badge key={f.phrase} tone="amber" className="text-sm"><mark className="bg-amber-300 px-1">{f.phrase}</mark> → {f.suggestion}</Badge>)}
                  </div>
                </>
              )}
            </div>
          )}
          {gen.isPending ? <SkeletonLines n={14} /> : (
            <Textarea aria-label="Job description text" className="min-h-[520px] rounded-none border-0 font-mono text-[13px] leading-relaxed focus-visible:ring-0"
              placeholder="Fill in the brief and press Generate, or paste your own job description here."
              value={shown ?? text} readOnly={shown !== null} onChange={(e) => setText(e.target.value)} />
          )}
        </Card>
      </div>
    </div>
  );
}
