import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...i: ClassValue[]) => twMerge(clsx(i));

export function download(filename: string, text: string, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export const scoreTone = (n: number) => (n >= 75 ? "green" : n >= 50 ? "amber" : "red");
export const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
export const hasPlaceholder = (s: string) => /\[[^\]\n]{1,60}\]|\{\{[^}]*\}\}|<<[^>]*>>/.test(s);
