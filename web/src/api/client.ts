const API_BASE = import.meta.env.VITE_API_URL || "";

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // Use relative paths so Vite dev proxy handles /api → backend
  const fullUrl = url.startsWith("/") ? url : `${API_BASE}${url}`;

  const token = window.localStorage.getItem("clerk-token");
  const headers = {
    ...options.headers,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(fullUrl, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export function setToken(token: string) {
  window.localStorage.setItem("clerk-token", token);
}

export function clearToken() {
  window.localStorage.removeItem("clerk-token");
}
