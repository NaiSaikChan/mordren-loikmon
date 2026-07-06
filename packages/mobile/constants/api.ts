export const API_BASE = 'https://loikmon.org/webapis';

/** CORS-safe POST: body wrapped in {data:...}, Content-Type: text/plain (no preflight) */
export async function apiPost<T = unknown>(
  endpoint: string,
  data: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json as T;
}

/** CORS-safe GET */
export async function apiGet<T = unknown>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${endpoint}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}
