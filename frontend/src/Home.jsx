import { Users, Trophy } from "lucide-react";
import { COLORS, FONT_DISPLAY, cardWrap } from "./design/theme";
import TopBar from "./components/TopBar";
import Button from "./components/Button";
import { useAuth } from "./auth/AuthContext";

export default function Home({ screen, onNavigate }) {
  const { user } = useAuth();

  return (
    <div style={cardWrap}>
      <TopBar screen={screen} onNavigate={onNavigate} />
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, margin: "0 0 4px" }}>Quiz</h2>
      <p style={{ color: COLORS.muted, margin: "0 0 24px", fontSize: 14 }}>Choisis un mode de jeu.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: COLORS.card, borderRadius: 16, padding: 18 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, margin: "0 0 4px" }}>Mode chill</p>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 12px" }}>Sans timer, à ton rythme.</p>
          <Button onClick={() => onNavigate("chill-setup")}>Jouer</Button>
        </div>

        <div style={{ background: COLORS.card, borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Trophy size={18} color={COLORS.gold} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, margin: 0 }}>Mode classé</p>
          </div>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 12px" }}>Timer, points, rangs. Nécessite un compte.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button onClick={() => onNavigate(user ? "ranked-setup" : "login")}>
              {user ? "Jouer" : "Se connecter pour jouer"}
            </Button>
            <Button variant="secondary" onClick={() => onNavigate("leaderboard")}>Classement</Button>
          </div>
        </div>

        <div style={{ background: COLORS.card, borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Users size={18} color={COLORS.gold} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, margin: 0 }}>Mode Multi</p>
          </div>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 12px" }}>À distance, avec un code de partie à partager.</p>
          <Button onClick={() => onNavigate("multi-choice")}>Jouer</Button>
        </div>

        <div style={{ background: COLORS.card, borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Users size={18} color={COLORS.gold} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, margin: 0 }}>Mode local</p>
          </div>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 12px" }}>Entre potes, sur un seul écran.</p>
          <Button onClick={() => onNavigate("local-choice")}>Jouer</Button>
        </div>
      </div>
    </div>
  );
}
