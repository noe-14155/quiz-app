import { useEffect, useState } from "react";
import { ChevronLeft, Brain } from "lucide-react";
import {
  cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, RANKS, sectionLabel,
} from "../../design/theme";
import RankLadder from "../../components/RankLadder";
import { apiFetch } from "../../api/client";

/**
 * Écran « Rangs » : uniquement ta progression et l'échelle des rangs.
 * Le classement des joueurs est ailleurs (mode Classé) — les deux répondaient
 * à des questions différentes, les mélanger brouillait l'écran.
 */
export default function Ranks({ onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/api/ranked/ladder").then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <div style={cardWrap}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0 18px" }}>
        <button
          onClick={() => onNavigate("home")}
          aria-label="Retour"
          style={{
            width: 36, height: 36, borderRadius: 11, background: COLORS.soft, border: "none",
            color: COLORS.muted2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, margin: 0, color: COLORS.text }}>
          Rangs
        </h2>
      </div>

      {error && <p style={{ color: COLORS.danger, fontSize: 13 }}>{error}</p>}

      {data && (
        <div style={{
          position: "relative", overflow: "hidden", borderRadius: 20, padding: "16px 18px",
          color: "#fff", marginBottom: 18, animation: "sqrise .45s both",
          background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.accent2} 55%, ${COLORS.accent3})`,
          boxShadow: `0 14px 30px -18px ${COLORS.gold}8c`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
            <span style={{
              width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,.22)",
              boxShadow: "inset 0 0 0 2px rgba(255,255,255,.35)", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Brain size={22} color="#fff" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", margin: 0, color: "rgba(255,255,255,.85)" }}>
                Rang actuel
              </p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, margin: "1px 0 0", lineHeight: 1 }}>
                {data.current.rank} {data.current.palier}
              </p>
            </div>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}>
              top {data.top_percent}%
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5, color: "rgba(255,255,255,.9)" }}>
            <span>{data.rank_points.toLocaleString("fr-FR")} pts</span>
            {data.next && <span>{data.next.rank} · {data.next.at.toLocaleString("fr-FR")}</span>}
          </div>
          <div style={{ height: 8, borderRadius: 5, background: "rgba(255,255,255,.28)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${data.rank_progress}%`, background: "#fff", borderRadius: 5 }} />
          </div>
          <p style={{ fontSize: 11.5, margin: "8px 0 0", fontWeight: 700, textAlign: "center" }}>
            {data.next
              ? `Plus que ${data.next.remaining.toLocaleString("fr-FR")} pts avant ${data.next.rank}`
              : "Tu es au sommet de l'échelle"}
          </p>
        </div>
      )}

      <p style={{ ...sectionLabel, margin: "0 0 12px" }}>L'échelle</p>
      {data && <RankLadder ladder={data.ladder} ranks={RANKS} />}
    </div>
  );
}
