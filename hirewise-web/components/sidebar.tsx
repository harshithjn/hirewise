"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveJob } from "@/lib/hooks";
import { Skeleton } from "./ui";

export const STEPS = [
  { n: 1, href: "/jd", label: "JD Generator" },
  { n: 2, href: "/resumes", label: "Resume Parser" },
  { n: 3, href: "/scoring", label: "Match Scoring" },
  { n: 4, href: "/ranking", label: "Ranking & Shortlist" },
  { n: 5, href: "/interview", label: "Interview Questions" },
  { n: 6, href: "/outreach", label: "Outreach Emails" },
  { n: 7, href: "/assistant", label: "Assistant & Report" },
];

export function Sidebar() {
  const path = usePathname();
  const { data: job, isLoading } = useActiveJob();
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white">
      <Link href="/" className="px-5 pb-3 pt-5 text-xl font-bold tracking-tight">Hire<span className="text-indigo-600">Wise</span></Link>
      <div className="mx-4 mb-4 rounded-md bg-slate-100 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500"><Briefcase className="h-3.5 w-3.5" /> Active job</p>
        {isLoading ? <Skeleton className="mt-1.5 h-4 w-32" /> : <p className="mt-0.5 text-sm font-semibold">{job?.title ?? "None yet"}</p>}
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label="Steps">
        {STEPS.map((s) => {
          const active = path.startsWith(s.href);
          return (
            <Link key={s.href} href={s.href} aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium", active ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100")}>
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", active ? "bg-white text-indigo-700" : "bg-slate-200 text-slate-700")}>{s.n}</span>
              {s.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
