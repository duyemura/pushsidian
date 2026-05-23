const API_BASE = import.meta.env.VITE_API_URL || "";

let getClerkToken: (() => Promise<string | null>) | null = null;

export function registerTokenGetter(getter: () => Promise<string | null>) {
  getClerkToken = getter;
}

function getApiKey(): string | null {
  return window.localStorage.getItem("pushsidian-api-key");
}

export function setApiKey(key: string) {
  window.localStorage.setItem("pushsidian-api-key", key);
}

export function clearApiKey() {
  window.localStorage.removeItem("pushsidian-api-key");
}

async function getClerkJwt(): Promise<string | null> {
  if (getClerkToken) {
    try {
      const token = await getClerkToken();
      if (token) return token;
    } catch {
      // ignore
    }
  }
  const clerk = await waitForClerk();
  if (clerk?.session) {
    try {
      return await clerk.session.getToken({ skipCache: true });
    } catch {
      // ignore
    }
  }
  return null;
}

function waitForClerk(maxMs = 3000): Promise<any> {
  return new Promise((resolve) => {
    const clerk = (window as any).Clerk;
    if (clerk?.loaded) {
      resolve(clerk);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      const c = (window as any).Clerk;
      if (c?.loaded) {
        clearInterval(interval);
        resolve(c);
      } else if (Date.now() - start > maxMs) {
        clearInterval(interval);
        resolve(null);
      }
    }, 100);
  });
}

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const fullUrl = url.startsWith("/") ? url : `${API_BASE}${url}`;

  // Strategy: API key is rock-solid; Clerk JWT expires. Prefer API key.
  const apiKey = getApiKey();
  let token = apiKey;
  let source: "apikey" | "clerk" = apiKey ? "apikey" : "clerk";

  if (!token) {
    token = await getClerkJwt();
    if (!token) {
      throw new Error("No auth token available. Sign in or add an API key in Profile.");
    }
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  let res = await fetch(fullUrl, { ...options, headers });

  // On 401, retry once with the other auth source
  if (res.status === 401) {
    let retryToken: string | null = null;
    if (source === "clerk" && apiKey) {
      retryToken = apiKey;
    } else if (source === "apikey") {
      retryToken = await getClerkJwt();
    }
    if (retryToken && retryToken !== token) {
      const retryHeaders: Record<string, string> = {
        ...(options.headers as Record<string, string>),
        Authorization: `Bearer ${retryToken}`,
      };
      if (options.body) {
        retryHeaders["Content-Type"] = "application/json";
      }
      res = await fetch(fullUrl, { ...options, headers: retryHeaders });
    }
  }

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
