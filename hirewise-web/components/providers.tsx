"use client";
import { useState } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: (e, q) => { if (!q.meta?.silent) toast.error(msg(e), { id: `q-${q.queryHash}` }); } }),
        mutationCache: new MutationCache({ onError: (e, _v, _c, m) => { if (!m.meta?.silent) toast.error(msg(e)); } }),
        defaultOptions: { queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
