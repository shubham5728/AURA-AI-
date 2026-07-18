/**
 * Client for the AURA FastAPI backend.
 *
 * One place that knows the base URL, the auth header, and how errors are
 * surfaced. Everything else in the app goes through `request`.
 */

const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const TOKEN_KEY = 'aura.token';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Development sign-in.
 *
 * The backend accepts `Bearer dev <email>` while ENV=development and refuses it
 * in production, so this works before a Firebase project exists. It verifies
 * nothing -- swap for a real Firebase ID token before this is deployed
 * anywhere real.
 */
export const signInDev = (email: string) => setToken(`dev ${email}`);

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    // fetch only rejects on network failure, so this is always "backend
    // unreachable" rather than an application error. Saying so beats the
    // browser's opaque "Failed to fetch".
    throw new ApiError('Cannot reach the AURA server. Is the backend running?', 0);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail =
      typeof data?.detail === 'string'
        ? data.detail
        : Array.isArray(data?.detail)
          ? data.detail[0]?.msg || 'Invalid request'
          : 'Request failed';
    throw new ApiError(detail, response.status);
  }

  return data as T;
}

export const get = <T>(path: string) => request<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
export const put = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
export const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
export const del = (path: string) => request<void>(path, { method: 'DELETE' });

export async function upload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  return request<T>(path, { method: 'POST', body: form });
}
