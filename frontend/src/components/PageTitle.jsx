import { COLORS, FONT_DISPLAY } from "../design/theme";

/** Titre de page (24-26px, graisse 800) + accroche optionnelle. */
export default function PageTitle({ children, subtitle }) {
  return (
    <>
      <h2 style={{
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, margin: "0 0 4px",
        color: COLORS.text, letterSpacing: -0.3,
      }}>
        {children}
      </h2>
      {subtitle && (
        <p style={{ color: COLORS.muted, margin: "0 0 22px", fontSize: 13.5, lineHeight: 1.5 }}>{subtitle}</p>
      )}
    </>
  );
}

/** Style de champ texte, aligné sur la maquette (fond doux, coins arrondis). */
export function inputStyle(extra = {}) {
  return {
    width: "100%",
    background: COLORS.soft,
    border: `1.5px solid ${COLORS.cardAlt}`,
    borderRadius: 14,
    padding: "14px 16px",
    fontFamily: FONT_DISPLAY,
    fontWeight: 800,
    fontSize: 16,
    color: COLORS.text,
    outline: "none",
    ...extra,
  };
}
