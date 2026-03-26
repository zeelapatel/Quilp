import { supabase } from "./supabase";

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const hasJsonBody = body !== undefined;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(hasJsonBody ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30_000)
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new ApiError(`API request failed: ${response.status}`, response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function get<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export function del(path: string): Promise<void> {
  return request<void>("DELETE", path);
}
