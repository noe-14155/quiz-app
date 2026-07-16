import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch, setToken, getToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile() {
    try {
      const profile = await apiFetch("/api/profile/me");
      setUser(profile);
    } catch (e) {
      setUser(null);
      setToken(null);
    }
  }

  useEffect(() => {
    if (getToken()) {
      refreshProfile().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function register(pseudo, password) {
    const result = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ pseudo, password }),
    });
    setToken(result.token);
    await refreshProfile();
  }

  async function login(pseudo, password) {
    const result = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ pseudo, password }),
    });
    setToken(result.token);
    await refreshProfile();
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
