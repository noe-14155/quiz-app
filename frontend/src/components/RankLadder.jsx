import { Lock, Check, Crown, Zap, User, Lightbulb, Search, Sparkles } from "lucide-react";
import { COLORS, FONT_DISPLAY, FONT_BODY, rankGradient, rankRange, tint } from "../design/theme";

/* Une icône par rang, dans l'ordre Neurone → Prodige. */
const ICONS = [Sparkles, Search, Lightbulb, User, Zap, Crown];

/**
 * « L'échelle » : la liste des rangs du plus haut au plus bas, avec l'état de
 * chacun — dépassé (coche), rang actuel (surligné, badge TOI) ou pas encore
 * atteint (cadenas).
 */
export default function RankLadder({ ladder, ranks }) {
  if (!ladder || ladder.length === 0) return null;

  // Du plus haut au plus bas, comme une vraie échelle.
  const rows = [...ladder].reverse();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {rows.map((row) => {
        const meta = ranks.find((r) => r.name === row.rank) || ranks[0];
        const Icon = ICONS[ranks.indexOf(meta)] || Sparkles;
        const isCurrent = row.state === "current";
        const isLocked = row.state === "locked";

        return (
          <div
            key={row.rank}
            style={{
              display: "flex", alignItems: "center", gap: 13, borderRadius: 16, padding: "12px 14px",
              border: `${isCurrent ? 2 : 1.5}px solid ${isCurrent ? COLORS.accent3 : COLORS.cardAlt}`,
              background: isCurrent ? tint(COLORS.accent3, 8) : COLORS.card,
              opacity: isLocked ? 0.62 : 1,
              animation: isCurrent ? "sqfloaty 3s ease-in-out infinite" : "none",
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 13, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: isLocked ? COLORS.cardAlt : rankGradient(meta),
            }}>
              <Icon size={19} color={isLocked ? COLORS.muted : "#fff"} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, display: "block", color: COLORS.text }}>
                {row.rank}
              </b>
              <small style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 11.5, color: COLORS.muted }}>
                {rankRange({ min: row.min, max: row.max })}
              </small>
            </div>

            {isCurrent && (
              <span style={{
                background: `linear-gradient(110deg, ${COLORS.gold}, ${COLORS.accent2})`, color: "#fff",
                borderRadius: 20, padding: "5px 12px", fontFamily: FONT_BODY, fontWeight: 800,
                fontSize: 11, letterSpacing: 0.6, flexShrink: 0,
              }}>
                TOI
              </span>
            )}
            {row.state === "done" && (
              <span style={{
                width: 26, height: 26, borderRadius: 9, flexShrink: 0, background: tint(COLORS.success, 15),
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Check size={15} color={COLORS.success} />
              </span>
            )}
            {isLocked && (
              <span style={{
                width: 26, height: 26, borderRadius: 9, flexShrink: 0, background: COLORS.soft,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Lock size={14} color={COLORS.muted} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
