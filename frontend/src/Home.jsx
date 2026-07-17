import { useEffect, useState } from "react";
import { Users, Trophy, Lock } from "lucide-react";
import { COLORS, FONT_DISPLAY, cardWrap, tierInfo } from "./design/theme";
import TopBar from "./components/TopBar";
import Button from "./components/Button";
import { useAuth } from "./auth/AuthContext";
import { apiFetch } from "./api/client";

/**
 * Rang affiché directement sur l'accueil : badge, cumul de points, et barre
 * de progression vers le palier suivant — sans avoir à entrer dans le mode.
 */
function HomeRankBadge({ user }) {
  const t = tierInfo(user.rank_tier);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: COLORS.cardAlt, borderRadius: 12, padding: "10px 12px", marginBottom: 12,
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: t.rank.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, color: COLORS.text }}>
            {t.rank.name} {t.palierLabel}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted }}>{user.rank_points} pts</span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: COLORS.card, marginTop: 5, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${user.rank_progress || 0}%`, background: t.rank.color }} />
        </div>
      </div>
    </div>
  );
}

function ModeCard({ icon, title, description, enabled, children }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 16, padding: 18, opacity: enabled ? 1 : 0.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {icon}
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, margin: 0 }}>{title}</p>
      </div>
      <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 12px" }}>{description}</p>
      {enabled ? children : (
        <p style={{ fontSize: 13, color: COLORS.muted, display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
          <Lock size={14} /> Temporairement désactivé
        </p>
      )}
    </div>
  );
}

export default function Home({ screen, onNavigate }) {
  const { user } = useAuth();
  const [modes, setModes] = useState({
    mode_chill_enabled: true, mode_ranked_enabled: true, mode_local_enabled: true, mode_multi_enabled: true,
  });

  useEffect(() => {
    apiFetch("/api/modes/status").then(setModes).catch(() => {});
  }, []);

  return (
    <div style={cardWrap}>
      <TopBar screen={screen} onNavigate={onNavigate} />
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, margin: "0 0 4px" }}>Quiz</h2>
      <p style={{ color: COLORS.muted, margin: "0 0 24px", fontSize: 14 }}>Choisis un mode de jeu.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <ModeCard title="Mode chill" description="Sans timer, à ton rythme." enabled={modes.mode_chill_enabled}>
          <Button onClick={() => onNavigate("chill-setup")}>Jouer</Button>
        </ModeCard>

        <ModeCard
          icon={<Trophy size={18} color={COLORS.gold} />}
          title="Mode classé"
          description="Timer, points, rangs. Nécessite un compte."
          enabled={modes.mode_ranked_enabled}
        >
          {user && <HomeRankBadge user={user} />}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button onClick={() => onNavigate(user ? "ranked-setup" : "login")}>
              {user ? "Jouer" : "Se connecter pour jouer"}
            </Button>
            <Button variant="secondary" onClick={() => onNavigate("leaderboard")}>Classement</Button>
          </div>
        </ModeCard>

        <ModeCard
          icon={<Users size={18} color={COLORS.gold} />}
          title="Mode Multi"
          description="À distance, avec un code de partie à partager."
          enabled={modes.mode_multi_enabled}
        >
          <Button onClick={() => onNavigate("multi-choice")}>Jouer</Button>
        </ModeCard>

        <ModeCard
          icon={<Users size={18} color={COLORS.gold} />}
          title="Mode local"
          description="Entre potes, sur un seul écran."
          enabled={modes.mode_local_enabled}
        >
          <Button onClick={() => onNavigate("local-choice")}>Jouer</Button>
        </ModeCard>
      </div>
    </div>
  );
}
