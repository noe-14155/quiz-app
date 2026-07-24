import { Lock, Check } from "lucide-react";
import { COLORS, FONT_DISPLAY, FONT_BODY, rankGradient, rankRange, tint } from "../design/theme";
import RankEmblem from "../design/rankEmblems";

/**
 * « L'échelle » : les rangs du plus haut au plus bas, reliés par un trait
 * vertical qui matérialise la montée. Le rang atteint est plein et coloré,
 * les suivants sont estompés — on voit d'un coup d'œil où l'on en est.
 */
export default function RankLadder({ ladder, ranks }) {
  if (!ladder || ladder.length === 0) return null;
  const rows = [...ladder].reverse(); // du sommet vers le bas

  return (
    <div style={{ position: "relative" }}>
      {/* Trait de liaison : la « rampe » de l'échelle */}
      <span style={{
        position: "absolute", left: 19, top: 22, bottom: 22, width: 2,
        background: COLORS.cardAlt, borderRadius: 1,
      }} />

      {rows.map((row) => {
        const meta = ranks.find((r) => r.name === row.rank) || ranks[0];
        const isCurrent = row.state === "current";
        const isLocked = row.state === "locked";

        return (
          <div
            key={row.rank}
            style={{
              position: "relative", display: "flex", alignItems: "center", gap: 12,
              padding: "7px 0", opacity: isLocked ? 0.5 : 1,
            }}
          >
            {/* Pastille sur la rampe */}
            <span style={{
              width: 40, height: 40, borderRadius: 13, flexShrink: 0, zIndex: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: isLocked ? COLORS.soft : rankGradient(meta),
              boxShadow: isCurrent ? `0 0 0 3px ${COLORS.bg}, 0 0 0 5px ${meta.color2 || meta.color}` : "none",
            }}>
              <RankEmblem rangIndex={ranks.indexOf(meta)} size={20} color={isLocked ? COLORS.muted : "#fff"} />
            </span>

            <div style={{
              flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10,
              background: isCurrent ? tint(meta.color2 || meta.color, 10) : "transparent",
              border: isCurrent ? `1.5px solid ${meta.color2 || meta.color}` : "1.5px solid transparent",
              borderRadius: 14, padding: isCurrent ? "8px 12px" : "8px 0",
            }}>
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
                  background: rankGradient(meta), color: "#fff", borderRadius: 20,
                  padding: "4px 11px", fontFamily: FONT_BODY, fontWeight: 800,
                  fontSize: 10.5, letterSpacing: 0.6, flexShrink: 0,
                }}>
                  TOI
                </span>
              )}
              {row.state === "done" && <Check size={16} color={COLORS.success} style={{ flexShrink: 0 }} />}
              {isLocked && <Lock size={14} color={COLORS.muted} style={{ flexShrink: 0 }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
