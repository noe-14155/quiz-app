// Le panneau de réglages a été fusionné dans l'écran « Profil & réglages »
// (profile/Profile.jsx). Il ne reste ici que le bouton d'accès.
import { Settings as SettingsIcon } from "lucide-react";
import { COLORS } from "./theme";

export function SettingsButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Paramètres"
      style={{
        width: 38, height: 38, borderRadius: 12, background: COLORS.soft, border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: COLORS.text, cursor: "pointer", flexShrink: 0,
      }}
    >
      <SettingsIcon size={17} />
    </button>
  );
}
