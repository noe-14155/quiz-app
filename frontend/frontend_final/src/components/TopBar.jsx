import { LogIn, Home as HomeIcon, ArrowLeft, X } from "lucide-react";
import { useState } from "react";
import { COLORS, FONT_BODY } from "../design/theme";
import { useAuth } from "../auth/AuthContext";
import SettingsPanel, { SettingsButton } from "../design/Settings";

const BACK_MAP = {
  login: { type: "back", label: "Retour", target: "home" },
  "chill-setup": { type: "back", label: "Retour", target: "home" },
  "chill-results": { type: "back", label: "Accueil", target: "home" },
  "ranked-setup": { type: "back", label: "Retour", target: "home" },
  "ranked-results": { type: "back", label: "Accueil", target: "home" },
  leaderboard: { type: "back", label: "Retour", target: "home" },
  "local-choice": { type: "back", label: "Retour", target: "home" },
  "mise-setup": { type: "back", label: "Retour", target: "local-choice" },
  "mise-results": { type: "back", label: "Accueil", target: "home" },
  "questions-mode-setup": { type: "back", label: "Retour", target: "local-choice" },
  "questions-mode-results": { type: "back", label: "Accueil", target: "home" },
  "multi-choice": { type: "back", label: "Retour", target: "home" },
  "multi-host-setup": { type: "back", label: "Retour", target: "multi-choice" },
  "multi-join-setup": { type: "back", label: "Retour", target: "multi-choice" },
  "multi-results": { type: "back", label: "Accueil", target: "home" },
  profile: { type: "back", label: "Retour", target: "home" },
  "public-profile": { type: "back", label: "Retour", target: "leaderboard" },
  admin: { type: "back", label: "Retour", target: "profile" },
  "chill-quiz": { type: "quit" },
  "ranked-quiz": { type: "quit" },
  "mise-play": { type: "quit" },
  "questions-mode-play": { type: "quit" },
  "multi-lobby": { type: "quit" },
  "multi-play": { type: "quit" },
};

export default function TopBar({ screen, onNavigate, onRequestQuit }) {
  const { user } = useAuth();
  const back = BACK_MAP[screen];
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      <button
        onClick={() => onNavigate(user ? "profile" : "login")}
        style={{
          background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center",
          gap: 8, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: user ? COLORS.text : COLORS.gold,
        }}
      >
        {user ? (
          <>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", background: COLORS.cardAlt,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
            }}>
              {user.pseudo[0].toUpperCase()}
            </div>
            {user.pseudo}
          </>
        ) : (
          <>
            <LogIn size={16} /> Se connecter
          </>
        )}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {back?.type === "back" && (
          <button
            onClick={() => onNavigate(back.target)}
            style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13 }}
          >
            {back.label === "Accueil" ? <HomeIcon size={16} /> : <ArrowLeft size={16} />} {back.label}
          </button>
        )}
        {back?.type === "quit" && (
          <button
            onClick={onRequestQuit}
            style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13 }}
          >
            <X size={16} /> Quitter
          </button>
        )}
        <SettingsButton onClick={() => setSettingsOpen(true)} />
      </div>
    </div>
  );
}
