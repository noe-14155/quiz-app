import { Check, X } from "lucide-react";
import { COLORS, FONT_DISPLAY } from "../design/theme";
import { feedbackBon, feedbackMauvais } from "../design/feedback";

/**
 * Grille de réponses façon plateau de jeu : 4 tuiles pleines et colorées,
 * chacune identifiée par une forme (losange, rond, triangle, carré).
 * - bonne réponse   : rebondit, liseré vert
 * - mauvaise choisie: tremble
 * - non choisies    : estompées
 */
const SHAPES = [
  { symbol: "◆", key: "shapeA" },
  { symbol: "●", key: "shapeB" },
  { symbol: "▲", key: "shapeC" },
  { symbol: "■", key: "shapeD" },
];

export default function AnswerGrid({ choix, answered, correctIndex, onPick, revealCorrectness = true }) {
  const isAnswered = answered !== null && answered !== undefined;

  function choisir(i) {
    // Retour tactile immédiat, avant même la réponse du serveur : c'est ce qui
    // rend le clic satisfaisant. Quand la correction n'est pas connue tout de
    // suite (multi, journalier), on se contente d'une vibration neutre.
    if (correctIndex !== undefined && correctIndex !== null) {
      i === correctIndex ? feedbackBon() : feedbackMauvais();
    }
    onPick(i);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13, marginBottom: 12 }}>
      {choix.map((choice, i) => {
        const shape = SHAPES[i % 4];
        const color = COLORS[shape.key];
        const isCorrect = correctIndex !== undefined && correctIndex !== null && i === correctIndex;
        const isPicked = i === answered;

        let extra = {};
        let mark = null;
        if (isAnswered && revealCorrectness) {
          if (isCorrect) {
            extra = { animation: "sqbounce .45s both", boxShadow: `0 0 0 3px ${COLORS.bg}, 0 0 0 6px ${COLORS.success}` };
            mark = "correct";
          } else if (isPicked) {
            extra = { animation: "sqshake .4s both" };
            mark = "wrong";
          } else {
            extra = { opacity: 0.32, filter: "saturate(.35)" };
          }
        } else if (isAnswered && isPicked) {
          // Mode sans révélation (journalier) : on marque juste le choix.
          extra = { boxShadow: `0 0 0 3px ${COLORS.bg}, 0 0 0 6px ${COLORS.text}` };
        } else if (isAnswered) {
          extra = { opacity: 0.45 };
        }

        return (
          <button
            key={i}
            onClick={() => choisir(i)}
            disabled={isAnswered}
            style={{
              minHeight: 92,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 10,
              border: "none",
              borderRadius: 18,
              padding: 14,
              textAlign: "left",
              cursor: isAnswered ? "default" : "pointer",
              color: "#fff",
              fontFamily: FONT_DISPLAY,
              background: `linear-gradient(135deg, ${color}, ${color}dd)`,
              transition: "transform .15s, filter .2s, opacity .2s",
              ...extra,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 20, lineHeight: 1 }}>
              <span>{shape.symbol}</span>
              {mark === "correct" && <Check size={18} color="#fff" strokeWidth={3} />}
              {mark === "wrong" && <X size={18} color="#fff" strokeWidth={3} />}
            </span>
            <span style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.15 }}>{choice}</span>
          </button>
        );
      })}
    </div>
  );
}
