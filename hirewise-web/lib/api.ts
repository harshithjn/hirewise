/** Same host the page was opened on (so a LAN address works), unless NEXT_PUBLIC_API_URL overrides it. */
function apiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  return typeof window === "undefined" ? "http://localhost:8000" : `http://${window.location.hostname}:8000`;
}

export class ApiError extends Error {
  constructor(message: string, public code = "error", public status = 0) {
    super(message);
  }
}

type Envelope<T> = { data: T; error: null } | { data: null; error: { code: string; message: string } };

function unwrap<T>(status: number, text: string): T {
  let body: Envelope<T>;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError("The server returned an unexpected response.", "bad_response", status);
  }
  if (body.error) throw new ApiError(body.error.message, body.error.code, status);
  return body.data;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl()}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(`Cannot reach the API at ${apiUrl()}. Is the backend running?`, "network");
  }
  return unwrap<T>(res.status, await res.text());
}

/** Multipart upload with progress (fetch cannot report upload progress). */
export function upload<T>(path: string, files: File[], onProgress?: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiUrl()}${path}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => reject(new ApiError(`Cannot reach the API at ${apiUrl()}. Is the backend running?`, "network"));
    xhr.onload = () => {
      try {
        resolve(unwrap<T>(xhr.status, xhr.responseText));
      } catch (e) {
        reject(e);
      }
    };
    xhr.send(form);
  });
}
