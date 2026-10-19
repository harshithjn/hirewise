"use client";
// shadcn/ui-style primitives (cva + Tailwind).
import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-indigo-600 text-white hover:bg-indigo-700",
        outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100",
        ghost: "text-slate-700 hover:bg-slate-100",
        success: "bg-emerald-600 text-white hover:bg-emerald-700",
        destructive: "bg-red-600 text-white hover:bg-red-700",
      },
      size: { default: "h-9 px-4", sm: "h-8 px-3 text-xs", icon: "h-8 w-8" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { loading?: boolean };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, type = "button", ...p }, ref) => (
    <button ref={ref} type={type} disabled={disabled || loading} className={cn(buttonVariants({ variant, size }), className)} {...p}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

const field = "w-full rounded-md border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:bg-slate-100 disabled:opacity-70";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn(field, "h-9", className)} {...p} />,
);
Input.displayName = "Input";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => <textarea ref={ref} className={cn(field, "py-2", className)} {...p} />,
);
Textarea.displayName = "Textarea";
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...p }, ref) => <select ref={ref} className={cn(field, "h-9", className)} {...p} />,
);
Select.displayName = "Select";

export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("mb-1 block text-sm font-medium text-slate-700", className)} {...p} />
);
export const FieldError = ({ msg }: { msg?: string }) => (msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null);

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)} {...p} />
);
export const CardHeader = ({ title, desc, right }: { title: string; desc?: string; right?: React.ReactNode }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
    <div>
      <h2 className="font-semibold">{title}</h2>
      {desc && <p className="text-sm text-slate-500">{desc}</p>}
    </div>
    {right}
  </div>
);

const tones = {
  green: "bg-emerald-100 text-emerald-800 border-emerald-200",
  amber: "bg-amber-100 text-amber-900 border-amber-200",
  red: "bg-red-100 text-red-800 border-red-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-200",
};
export const Badge = ({ tone = "slate", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) => (
  <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone], className)} {...p} />
);

export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-md bg-slate-200", className)} />;
export const SkeletonLines = ({ n = 6 }: { n?: number }) => (
  <div className="space-y-2.5 p-4">
    {Array.from({ length: n }).map((_, i) => <Skeleton key={i} className={cn("h-4", i % 3 === 2 ? "w-2/3" : "w-full")} />)}
  </div>
);

export function Empty({ title, text, href, cta }: { title: string; text: string; href?: string; cta?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{text}</p>
      {href && <Link href={href} className={cn(buttonVariants(), "mt-4")}>{cta ?? "Go"}</Link>}
    </div>
  );
}

export const Alert = ({ tone = "red", title, children }: { tone?: "red" | "amber"; title: string; children?: React.ReactNode }) => (
  <div className={cn("rounded-md border p-3 text-sm", tone === "red" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900")} role="alert">
    <p className="font-semibold">{title}</p>
    {children}
  </div>
);

export function PageHeader({ step, title, desc, right }: { step: number; title: string; desc: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Step {step} of 7</p>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-slate-600">{desc}</p>
      </div>
      {right}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string }[] }) {
  return (
    <div className="mb-4 inline-flex rounded-lg bg-slate-200 p-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn("rounded-md px-4 py-1.5 text-sm font-medium", value === t.id ? "bg-white shadow-sm" : "text-slate-600 hover:text-slate-900")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Accordion({ title, right, defaultOpen = false, children }: { title: React.ReactNode; right?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-4 py-3">
        <button className="flex flex-1 items-center gap-2 text-left font-medium" aria-expanded={open} onClick={() => setOpen(!open)}>
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
          {title}
        </button>
        {right}
      </div>
      {open && <div className="border-t border-slate-100 px-4 py-3">{children}</div>}
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-40 flex justify-end" role="dialog" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="relative z-10 h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const t = draft.trim().replace(/,$/, "");
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-slate-300 bg-white p-1.5 focus-within:ring-2 focus-within:ring-indigo-500">
      {value.map((t) => (
        <Badge key={t} tone="indigo">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((v) => v !== t))}><X className="h-3 w-3" /></button>
        </Badge>
      ))}
      <input className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none" value={draft} placeholder={value.length ? "" : placeholder}
        onChange={(e) => setDraft(e.target.value)} onBlur={add}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }} />
    </div>
  );
}

export const ScoreBadge = ({ n }: { n: number }) => (
  <Badge tone={n >= 75 ? "green" : n >= 50 ? "amber" : "red"} className="min-w-10 justify-center font-bold">{n}</Badge>
);

export function Chips({ items, tone = "slate" }: { items: string[]; tone?: keyof typeof tones }) {
  if (!items.length) return <span className="text-sm text-slate-400">None</span>;
  return <div className="flex flex-wrap gap-1.5">{items.map((s) => <Badge key={s} tone={tone}>{s}</Badge>)}</div>;
}

export function Progress({ value }: { value?: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={value}>
      <div className={cn("h-full rounded-full bg-indigo-600", value === undefined && "w-1/3 animate-[slide_1.2s_ease-in-out_infinite]")}
        style={value === undefined ? undefined : { width: `${value}%` }} />
    </div>
  );
}
