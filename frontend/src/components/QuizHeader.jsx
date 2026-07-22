import { X } from "lucide-react";
import { COLORS, FONT_DISPLAY, FONT_BODY, gradient, gradientText, tint } from "../design/theme";

/**
 * En-tête d'une question, commun à tous les modes (chill, classé, journalier,
 * journalier) : gros numéro en dégradé, indicateur de droite (chrono ou score),
 * barre de progression et étiquettes (thème, difficulté, enjeu).
 */
export default function QuizHeader({ index, total, rightLabel, rightDanger = false, progressPct, tags = [] }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", margin: "0 0 8px" }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, lineHeight: 0.85, ...gradientText(120) }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        {rightLabel !== undefined && rightLabel !== null && (
          <span style={{
            fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18,
            color: rightDanger ? COLORS.danger : COLORS.muted,
          }}>
            {rightLabel}
          </span>
        )}
      </div>

      <div style={{ height: 9, borderRadius: 6, background: COLORS.cardAlt, marginBottom: 20, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 6, width: `${Math.max(0, Math.min(100, progressPct))}%`,
          background: gradient(90), transition: "width .25s linear",
        }} />
      </div>

      {tags.length > 0 && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
          {tags.map((tag, i) => (
            <span
              key={i}
              style={{
                display: "inline-block", borderRadius: 20, padding: "5px 12px",
                fontFamily: FONT_BODY, fontWeight: 800, fontSize: 11, letterSpacing: 1,
                textTransform: "uppercase", animation: "sqpop .35s both",
                background: tint(tag.color || COLORS.gold, 12),
                color: tag.color || COLORS.gold,
              }}
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

/** Compteur de questions + bouton quitter, ligne du dessus. */
export function QuizTopLine({ index, total, onQuit }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "2px 0 14px" }}>
      {onQuit ? (
        <button
          onClick={onQuit}
          style={{
            display: "flex", alignItems: "center", gap: 6, background: COLORS.soft, border: "none",
            borderRadius: 12, padding: "8px 13px", color: COLORS.muted2, cursor: "pointer",
            fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13,
          }}
        >
          <X size={14} /> Quitter
        </button>
      ) : <span />}
      <span style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 12, color: COLORS.muted, letterSpacing: 0.3 }}>
        Question {index + 1} / {total}
      </span>
    </div>
  );
}

/** Énoncé de la question. */
export function QuizQuestion({ children }) {
  return (
    <h3 style={{
      fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, lineHeight: 1.22,
      margin: "0 0 20px", color: COLORS.text, animation: "sqrise .4s .05s both",
    }}>
      {children}
    </h3>
  );
}

/**
 * Encadré de correction affiché après la réponse : bandeau coloré à gauche,
 * verdict en tête, explication en dessous.
 */
export function Explanation({ ok, title, correctAnswer, text, children }) {
  const color = ok ? COLORS.success : COLORS.danger;
  return (
    <div style={{ animation: "sqrise .3s both", marginTop: 18 }}>
      <div style={{
        borderLeft: `4px solid ${color}`,
        background: COLORS.card,
        border: `1px solid ${COLORS.cardAlt}`,
        borderLeftWidth: 4,
        borderLeftColor: color,
        borderRadius: "0 16px 16px 0",
        padding: "15px 16px",
      }}>
        <p style={{ margin: "0 0 6px", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color }}>
          {title}
        </p>
        {(correctAnswer || text) && (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: COLORS.muted2 }}>
            {correctAnswer && <b style={{ color: COLORS.text }}>{correctAnswer}</b>}
            {correctAnswer && text ? " — " : ""}
            {text}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
