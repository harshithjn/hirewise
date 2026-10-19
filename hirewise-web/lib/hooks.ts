"use client";
import { useCallback } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Candidate, Job, Score } from "./types";

export const useHealth = () =>
  useQuery({ queryKey: ["health"], queryFn: () => api<{ model: string; llm_configured: boolean }>("/api/health"), retry: 1, meta: { silent: true } });

export const useActiveJob = () => useQuery({ queryKey: ["job"], queryFn: () => api<Job | null>("/api/jobs/active") });

export const useCandidates = (jobId?: number | null) =>
  useQuery({ queryKey: ["candidates", jobId ?? null], queryFn: () => api<Candidate[]>("/api/candidates"), placeholderData: keepPreviousData });

export const useScores = (jobId?: number) =>
  useQuery({ queryKey: ["scores", jobId], queryFn: () => api<Score[]>(`/api/scoring?job_id=${jobId}`), enabled: !!jobId });

/** Page state that survives navigation (lives in the TanStack Query cache). */
export function useCache<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const qc = useQueryClient();
  const k = ["cache", key];
  const { data } = useQuery({
    queryKey: k, queryFn: () => qc.getQueryData<T>(k) ?? initial, staleTime: Infinity, gcTime: Infinity, meta: { silent: true },
  });
  const set = useCallback(
    (v: T | ((p: T) => T)) => qc.setQueryData<T>(k, (prev) => (typeof v === "function" ? (v as (p: T) => T)(prev ?? initial) : v)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, key],
  );
  return [data ?? initial, set];
}
