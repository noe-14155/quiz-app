import { Circle, Square, Triangle, Diamond, Check, X } from "lucide-react";
import { COLORS, FONT_BODY } from "../design/theme";

const SHAPES = [
  { Icon: Circle, color: COLORS.shapeA },
  { Icon: Square, color: COLORS.shapeB },
  { Icon: Triangle, color: COLORS.shapeC },
  { Icon: Diamond, color: COLORS.shapeD },
];

export default function AnswerGrid({ choix, answered, correctIndex, onPick, revealCorrectness = true }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 12 }}>
      {choix.map((choice, i) => {
        const { Icon, color } = SHAPES[i];
        const isAnswered = answered !== null && answered !== undefined;
        const isCorrect = correctIndex !== undefined && correctIndex !== null && i === correctIndex;
        const isPicked = i === answered;
        let bg = COLORS.card;
        let border = COLORS.cardAlt;
        if (revealCorrectness) {
          if (isAnswered && isCorrect) {
            bg = "rgba(34,197,94,0.15)";
            border = COLORS.success;
          } else if (isAnswered && isPicked && !isCorrect) {
            bg = "rgba(239,68,68,0.15)";
            border = COLORS.danger;
          }
        } else if (isAnswered && isPicked) {
          bg = "rgba(59,130,246,0.12)";
          border = COLORS.gold;
        }
        return (
          <button
            key={i}
            onClick={() => onPick(i)}
            disabled={isAnswered}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "14px 12px", borderRadius: 14,
              border: `2px solid ${border}`, background: bg, color: COLORS.text, textAlign: "left",
              fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, cursor: isAnswered ? "default" : "pointer",
            }}
          >
            <Icon size={18} color={color} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{choice}</span>
            {isAnswered && revealCorrectness && isCorrect && <Check size={18} color={COLORS.success} />}
            {isAnswered && revealCorrectness && isPicked && !isCorrect && <X size={18} color={COLORS.danger} />}
          </button>
        );
      })}
    </div>
  );
}
