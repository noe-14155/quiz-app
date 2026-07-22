import { COLORS, FONT_DISPLAY, gradient } from "../design/theme";

/**
 * Bouton principal en dégradé (violet → rose) façon maquette.
 * - primary   : dégradé plein, ombre colorée
 * - secondary : fond discret, même forme (variante "soft" de la maquette)
 * - danger    : rouge plein
 */
export default function Button({ children, onClick, variant = "primary", disabled, style, type = "button" }) {
  const base = {
    width: "100%",
    padding: 16,
    borderRadius: 16,
    border: "none",
    fontFamily: FONT_DISPLAY,
    fontWeight: 800,
    fontSize: 16,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };
  const variants = {
    primary: disabled
      ? { background: COLORS.cardAlt, color: COLORS.muted }
      : {
          background: gradient(110),
          color: "#fff",
          boxShadow: `0 14px 28px -14px ${COLORS.gold}8c`,
        },
    secondary: { background: COLORS.soft, color: COLORS.text },
    danger: { background: COLORS.danger, color: "#fff" },
  };
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}
