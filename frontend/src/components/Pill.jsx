import { COLORS, FONT_BODY, tint } from "../design/theme";

/**
 * Pastille de sélection (thèmes, difficultés, options). Reprend le style
 * "pill" de la maquette : contour fin, accent quand elle est active.
 */
export default function Pill({ children, active, onClick, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1.5px solid ${active ? COLORS.gold : COLORS.cardAlt}`,
        background: active ? tint(COLORS.gold, 10) : COLORS.bg,
        color: active ? COLORS.gold : COLORS.muted,
        borderRadius: 20,
        padding: "8px 15px",
        fontFamily: FONT_BODY,
        fontWeight: 800,
        fontSize: 13,
        cursor: "pointer",
        transition: ".15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
