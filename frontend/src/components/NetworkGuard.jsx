import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { COLORS, FONT_BODY } from "../design/theme";

/**
 * Bandeau affiché quand la connexion est perdue.
 *
 * Sans lui, une coupure en pleine partie se traduisait par un écran figé sans
 * explication : le joueur cliquait dans le vide en croyant à un bug. Le bandeau
 * apparaît en haut, disparaît tout seul au retour du réseau.
 */
export default function NetworkGuard() {
  const [horsLigne, setHorsLigne] = useState(!navigator.onLine);

  useEffect(() => {
    const perdu = () => setHorsLigne(true);
    const retrouve = () => setHorsLigne(false);
    window.addEventListener("offline", perdu);
    window.addEventListener("online", retrouve);
    return () => {
      window.removeEventListener("offline", perdu);
      window.removeEventListener("online", retrouve);
    };
  }, []);

  if (!horsLigne) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: COLORS.danger, color: "#fff", padding: "9px 14px",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      fontFamily: FONT_BODY, fontWeight: 800, fontSize: 13,
    }}>
      <WifiOff size={14} /> Connexion perdue — tes réponses ne sont plus enregistrées
    </div>
  );
}
