import { LogIn, Home as HomeIcon, ArrowLeft, X } from "lucide-react";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../design/theme";
import { useAuth } from "../auth/AuthContext";
import { SettingsButton } from "../design/Settings";

const BACK_MAP = {
  login: { type: "back", label: "Retour", target: "home" },
  "chill-setup": { type: "back", label: "Retour", target: "home" },
  "chill-results": { type: "back", label: "Accueil", target: "home" },
  "ranked-setup": { type: "back", label: "Retour", target: "home" },
  "ranked-results": { type: "back", label: "Accueil", target: "home" },
  ranks: { type: "back", label: "Retour", target: "home" },
  "local-choice": { type: "back", label: "Retour", target: "home" },
  "mise-setup": { type: "back", label: "Retour", target: "local-choice" },
  "mise-results": { type: "back", label: "Accueil", target: "home" },
  "questions-mode-setup": { type: "back", label: "Retour", target: "local-choice" },
  "questions-mode-results": { type: "back", label: "Accueil", target: "home" },
  profile: { type: "back", label: "Retour", target: "home" },
  "public-profile": { type: "back", label: "Retour", target: "ranks" },
  admin: { type: "back", label: "Retour", target: "profile" },
  "chill-quiz": { type: "quit" },
  "ranked-quiz": { type: "quit" },
  "mise-play": { type: "quit" },
  "questions-mode-play": { type: "quit" },
};

export default function TopBar({ screen, onNavigate, onRequestQuit }) {
  const { user } = useAuth();
  const back = BACK_MAP[screen];

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
      <button
        onClick={() => onNavigate(user ? "profile" : "login")}
        style={{
          background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center",
          gap: 8, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 13, color: user ? COLORS.text : COLORS.gold,
          padding: 0,
        }}
      >
        {user ? (
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15 }}>{user.pseudo}</span>
        ) : (
          <>
            <LogIn size={16} /> Se connecter
          </>
        )}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {back?.type === "back" && (
          <button
            onClick={() => onNavigate(back.target)}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: COLORS.soft, border: "none",
              borderRadius: 12, padding: "8px 13px", color: COLORS.muted2, cursor: "pointer",
              fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13,
            }}
          >
            {back.label === "Accueil" ? <HomeIcon size={15} /> : <ArrowLeft size={15} />} {back.label}
          </button>
        )}
        {back?.type === "quit" && (
          <button
            onClick={onRequestQuit}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: COLORS.soft, border: "none",
              borderRadius: 12, padding: "8px 13px", color: COLORS.muted2, cursor: "pointer",
              fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13,
            }}
          >
            <X size={14} /> Quitter
          </button>
        )}
        <SettingsButton onClick={() => onNavigate(user ? "profile" : "login")} />
      </div>
    </div>
  );
}
