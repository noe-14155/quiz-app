import { useEffect, useState } from "react";
import { ChevronLeft, Brain } from "lucide-react";
import {
  cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, tierInfo, rankGradient,
  sectionLabel, tint, RANKS,
} from "../../design/theme";
import RankLadder from "../../components/RankLadder";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

/**
 * Écran « Rangs » : carte de progression en dégradé, l'échelle complète des
 * rangs, puis le classement des joueurs.
 */
export default function Ranks({ onNavigate }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/api/ranked/ladder").then(setData).catch((e) => setError(e.message));
    apiFetch("/api/ranked/leaderboard").then((r) => setPlayers(r.leaderboard)).catch(() => {});
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
        <>
          {/* Carte de progression */}
          <div style={{
            position: "relative", overflow: "hidden", borderRadius: 20, padding: "16px 18px",
            color: "#fff", marginBottom: 8, animation: "sqrise .45s both",
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

          <p style={sectionLabel}>L'échelle</p>
          <RankLadder ladder={data.ladder} ranks={RANKS} />

          <p style={sectionLabel}>
            Classement{data ? ` · ${data.current.rank} ${data.current.palier}` : ""}
          </p>
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {players.map((p, i) => {
          const t = tierInfo(p.rank_tier);
          const isMe = user && p.pseudo === user.pseudo;
          return (
            <div
              key={p.pseudo}
              onClick={() => onNavigate("public-profile", p.pseudo)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 14,
                background: isMe ? tint(COLORS.gold, 8) : COLORS.card,
                border: `1px solid ${isMe ? COLORS.gold : COLORS.cardAlt}`,
                cursor: "pointer",
              }}
            >
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, color: COLORS.muted, width: 24 }}>
                {i + 1}
              </span>
              <span style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: rankGradient(t.rank),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 12, color: "#fff",
              }}>
                {t.palierLabel}
              </span>
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, flex: 1, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.pseudo}{isMe ? " (toi)" : ""}
                <small style={{ display: "block", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 11, color: COLORS.muted }}>
                  {t.rank.name} {t.palierLabel}
                </small>
              </span>
              <span style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 13, color: COLORS.gold }}>
                {p.rank_points.toLocaleString("fr-FR")}
              </span>
            </div>
          );
        })}
        {players.length === 0 && (
          <p style={{ color: COLORS.muted, fontSize: 13 }}>Personne n'a encore joué en classé.</p>
        )}
      </div>
    </div>
  );
}
