const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";

export function getToken() {
  return localStorage.getItem("quiz_token");
}

export function setToken(token) {
  if (token) localStorage.setItem("quiz_token", token);
  else localStorage.removeItem("quiz_token");
}

export async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // pas de corps JSON dans la réponse (rare, mais on ne veut pas planter pour ça)
  }

  if (!res.ok) {
    const message = data?.detail;
    throw new Error(typeof message === "string" ? message : `Erreur ${res.status}`);
  }
  return data;
}
