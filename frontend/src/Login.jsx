import { useState } from "react";
import { cardWrap, COLORS, FONT_DISPLAY, FONT_BODY } from "./design/theme";
import TopBar from "./components/TopBar";
import Button from "./components/Button";
import { useAuth } from "./auth/AuthContext";

// Fonction (et non constante de module) : une constante serait évaluée une
// seule fois à l'import, avec les couleurs du thème de départ, et ne suivrait
// jamais un changement clair/sombre.
const inputStyle = () => ({
  width: "100%", padding: "12px 14px", borderRadius: 12, marginBottom: 12, boxSizing: "border-box",
  border: `2px solid ${COLORS.cardAlt}`, background: COLORS.card, color: COLORS.text,
  fontFamily: FONT_BODY, fontSize: 15,
});

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
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 20px" }}>
        {mode === "login" ? "Connexion" : "Créer un compte"}
      </h2>

      <form onSubmit={submit}>
        <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Pseudo" style={inputStyle()} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" type="password" style={inputStyle()} />
        {error && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
        <Button type="submit" disabled={!pseudo.trim() || !password.trim() || loading} style={{ width: "100%", marginBottom: 12 }}>
          {loading ? "..." : mode === "login" ? "Se connecter" : "Créer le compte"}
        </Button>
      </form>

      <button
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        style={{ background: "none", border: "none", color: COLORS.gold, cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, display: "block", margin: "0 auto" }}
      >
        {mode === "login" ? "Pas encore de compte ? En créer un" : "Déjà un compte ? Se connecter"}
      </button>
    </div>
  );
}
