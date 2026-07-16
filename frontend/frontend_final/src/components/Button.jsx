import { COLORS, FONT_DISPLAY } from "../design/theme";

export default function Button({ children, onClick, variant = "primary", disabled, style, type = "button" }) {
  const base = {
    padding: "13px 18px",
    borderRadius: 14,
    border: "none",
    fontFamily: FONT_DISPLAY,
    fontWeight: 700,
    fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };
  const variants = {
    primary: { background: disabled ? COLORS.cardAlt : COLORS.gold, color: disabled ? COLORS.muted : "#ffffff" },
    secondary: { background: COLORS.card, color: COLORS.text, border: `2px solid ${COLORS.cardAlt}` },
    danger: { background: COLORS.danger, color: "#ffffff" },
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}
