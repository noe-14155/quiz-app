import { useEffect, useState } from "react";
import { cardWrap, COLORS, FONT_DISPLAY, tierInfo } from "../../design/theme";
import TopBar from "../../components/TopBar";
import { apiFetch } from "../../api/client";

export default function Leaderboard({ screen, onNavigate, onViewProfile }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/api/ranked/leaderboard")
      .then((r) => setPlayers(r.leaderboard))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={cardWrap}>
      <TopBar screen={screen} onNavigate={onNavigate} />
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 20px" }}>Classement</h2>

      {loading && <p style={{ color: COLORS.muted, fontSize: 14 }}>Chargement...</p>}
      {error && <p style={{ color: COLORS.danger, fontSize: 13 }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {players.map((p, i) => {
          const t = tierInfo(p.rank_tier);
          return (
            <div
              key={p.pseudo}
              onClick={() => onViewProfile(p.pseudo)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.card, borderRadius: 12, padding: "10px 14px", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 20, textAlign: "center", fontWeight: 700, color: COLORS.muted, fontSize: 13 }}>{i + 1}</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{p.pseudo}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: COLORS.muted }}>{p.rank_points} pts</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.rank.color }}>{t.rank.name} {t.palierLabel}</span>
              </div>
            </div>
          );
        })}
        {!loading && players.length === 0 && (
          <p style={{ color: COLORS.muted, fontSize: 14 }}>Personne n'a encore joué en classé.</p>
        )}
      </div>
    </div>
  );
}
