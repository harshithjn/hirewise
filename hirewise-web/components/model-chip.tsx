"use client";
import { Sparkles } from "lucide-react";
import { useHealth } from "@/lib/hooks";

export function ModelChip() {
  const { data, isError, isLoading } = useHealth();
  return (
    <div className="no-print fixed bottom-4 right-4 z-30 flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800 shadow">
      <Sparkles className="h-3.5 w-3.5" />
      {isLoading ? "AI: …" : isError ? "AI: API offline" : `AI: ${data?.model}${data?.llm_configured ? "" : " (no key)"}`}
    </div>
  );
}
