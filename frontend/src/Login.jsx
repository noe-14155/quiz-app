import { useState } from "react";
import { cardWrap, COLORS, FONT_BODY } from "./design/theme";
import TopBar from "./components/TopBar";
import Button from "./components/Button";
import PageTitle, { inputStyle } from "./components/PageTitle";
import { useAuth } from "./auth/AuthContext";

export default function Login({ screen, onNavigate }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") await login(pseudo, password);
      else await register(pseudo, password);
      onNavigate("home");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={cardWrap}>
      <TopBar screen={screen} onNavigate={onNavigate} />
      <PageTitle subtitle={mode === "login"
        ? "Retrouve ton rang et ta progression."
        : "Pseudo de 2 à 20 caractères, mot de passe d'au moins 6."}>
        {mode === "login" ? "Connexion" : "Créer un compte"}
      </PageTitle>

      <form onSubmit={submit}>
        <input
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          placeholder="Pseudo"
          style={inputStyle({ marginBottom: 12 })}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          type="password"
          style={inputStyle({ marginBottom: 12 })}
        />
        {error && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
        <Button type="submit" disabled={!pseudo.trim() || !password.trim() || loading} style={{ marginBottom: 14 }}>
          {loading ? "..." : mode === "login" ? "Se connecter" : "Créer le compte"}
        </Button>
      </form>

      <button
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        style={{ background: "none", border: "none", color: COLORS.gold, cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 800, fontSize: 13, display: "block", margin: "0 auto" }}
      >
        {mode === "login" ? "Pas encore de compte ? En créer un" : "Déjà un compte ? Se connecter"}
      </button>
    </div>
  );
}
