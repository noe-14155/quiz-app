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

  // Une coupure réseau lève une TypeError peu parlante ("Failed to fetch").
  // On la traduit en message compréhensible, et on la marque pour que les
  // écrans puissent la traiter différemment d'une vraie erreur serveur.
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (e) {
    const err = new Error(
      navigator.onLine
        ? "Le serveur ne répond pas. Réessaie dans un instant."
        : "Pas de connexion internet."
    );
    err.reseau = true;
    throw err;
  }
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // pas de corps JSON dans la réponse (rare, mais on ne veut pas planter pour ça)
  }

  if (!res.ok) {
    const message = data?.detail;
    const err = new Error(typeof message === "string" ? message : `Erreur ${res.status}`);
    err.status = res.status;
    // 429 : trop de tentatives — l'écran de connexion l'affiche tel quel.
    throw err;
  }
  return data;
}
