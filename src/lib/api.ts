export type ApiErrorPayload = {
  error?: string;
  details?: unknown;
};

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function getStoredToken() {
  return localStorage.getItem('token');
}

export function clearStoredSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user_role');
  localStorage.removeItem('store_name');
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getStoredToken();
  const headers = new Headers(init.headers);

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    clearStoredSession();
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }

  if (!response.ok) {
    const payload = await response.json().catch((): ApiErrorPayload => ({}));
    throw new ApiError(response.status, payload.error || `Request failed with ${response.status}`, payload.details);
  }

  return response;
}

export async function apiJson<T>(input: RequestInfo | URL, init: RequestInit = {}) {
  const response = await apiFetch(input, init);
  return response.json() as Promise<T>;
}
