import { COLORS, FONT_DISPLAY, FONT_BODY, gradientText } from "../design/theme";

/**
 * Bloc de fin de partie : gros score en dégradé animé, titre selon la
 * performance et sous-titre libre (reprend l'écran de résultats de la maquette).
 */
export default function BigScore({ score, total, subtitle, label = "Résultat" }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  let title;
  if (pct === 100) title = "Parfait !";
  else if (pct >= 80) title = "Excellent";
  else if (pct >= 60) title = "Bien joué";
  else if (pct >= 40) title = "Peut mieux faire";
  else title = "Aïe...";

  return (
    <div style={{ textAlign: "center", paddingTop: 22, marginBottom: 22 }}>
      <p style={{
        fontFamily: FONT_BODY, fontWeight: 800, fontSize: 12, letterSpacing: 2,
        textTransform: "uppercase", color: COLORS.muted, margin: 0,
      }}>
        {label}
      </p>
      <div style={{
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 92, lineHeight: 1, margin: "6px 0",
        ...gradientText(120), animation: "sqgrad 4s linear infinite, sqpop .55s both",
      }}>
        {score}
        <span style={{ fontSize: 40 }}>/{total}</span>
      </div>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, margin: "0 0 4px", color: COLORS.text }}>
        {title}
      </p>
      {subtitle && (
        <p style={{ fontSize: 13, color: COLORS.muted, margin: 0, lineHeight: 1.5 }}>{subtitle}</p>
      )}
    </div>
  );
}
