import { Flame } from "lucide-react";
import { COLORS, FONT_DISPLAY, FONT_BODY, tint } from "../design/theme";

/**
 * Série de jours consécutifs au défi du jour. Le compteur s'éteint (gris)
 * quand la journée n'est pas encore jouée : c'est ce qui donne envie d'y aller.
 */
export default function StreakBadge({ streak, compact = false }) {
  if (!streak || streak.current === 0) return null;
  const chaud = streak.played_today;
  const couleur = chaud ? COLORS.accent3 : COLORS.muted;

  if (compact) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 20,
        padding: "3px 9px", background: tint(couleur, 14),
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 12, color: couleur,
      }}>
        <Flame size={12} /> {streak.current}
      </span>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, borderRadius: 16, padding: "12px 14px",
      background: tint(couleur, 10), border: `1.5px solid ${tint(couleur, 35)}`, marginBottom: 16,
    }}>
      <span style={{
        width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: couleur,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Flame size={18} color="#fff" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, margin: 0, color: COLORS.text }}>
          {streak.current} jour{streak.current > 1 ? "s" : ""} d'affilée
        </p>
        <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: COLORS.muted, margin: "1px 0 0" }}>
          {chaud
            ? `Record : ${streak.best} jour${streak.best > 1 ? "s" : ""}`
            : "Joue aujourd'hui pour ne pas perdre ta série"}
        </p>
      </div>
    </div>
  );
}
