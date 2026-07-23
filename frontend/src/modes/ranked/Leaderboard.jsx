import { useEffect, useState } from "react";
import {
  cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, tierInfo, rankGradient, tint,
} from "../../design/theme";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

/** Ligne du classement : la position domine, le rang n'est qu'une pastille. */
function PlayerRow({ player, position, isMe, onClick }) {
  const t = tierInfo(player.rank_tier);
  const podium = position <= 3;
  const medaille = ["#FFC94D", "#C3CBD3", "#D9A066"][position - 1];

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 14,
        background: isMe ? tint(COLORS.gold, 8) : "transparent",
        border: `1px solid ${isMe ? COLORS.gold : "transparent"}`,
        borderBottom: isMe ? `1px solid ${COLORS.gold}` : `1px solid ${COLORS.cardAlt}`,
        cursor: "pointer",
      }}
    >
      <span style={{
        width: 26, height: 26, borderRadius: 9, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: podium ? medaille : "transparent",
        color: podium ? "#fff" : COLORS.muted,
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 13,
      }}>
        {position}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14.5,
          color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {player.pseudo}{isMe ? " (toi)" : ""}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: rankGradient(t.rank), flexShrink: 0 }} />
          <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 11, color: COLORS.muted }}>
            {t.rank.name} {t.palierLabel}
          </span>
        </span>
      </span>

      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: COLORS.text, flexShrink: 0 }}>
        {player.rank_points.toLocaleString("fr-FR")}
      </span>
    </div>
  );
}

/** Écran de classement, accessible depuis le mode Classé. */
export default function Leaderboard({ onNavigate, sansEnTete = false }) {
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/api/ranked/leaderboard")
      .then((r) => setPlayers(r.leaderboard))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const maPosition = user ? players.findIndex((p) => p.pseudo === user.pseudo) + 1 : 0;

  // Utilisé seul (écran dédié) ou intégré dans l'onglet Classement, où l'on
  // retire l'en-tête et le cadre pour éviter les répétitions.
  const contenu = (
    <>
      {!sansEnTete && maPosition > 0 && (
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 16px" }}>
          Tu es <b style={{ color: COLORS.gold }}>{maPosition}<sup>{maPosition === 1 ? "er" : "e"}</sup></b> sur {players.length} joueur{players.length > 1 ? "s" : ""}.
        </p>
      )}

      {loading && <p style={{ color: COLORS.muted, fontSize: 14 }}>Chargement…</p>}
      {error && <p style={{ color: COLORS.danger, fontSize: 13 }}>{error}</p>}

      <div>
        {players.map((p, i) => (
          <PlayerRow
            key={p.pseudo}
            player={p}
            position={i + 1}
            isMe={user && p.pseudo === user.pseudo}
            onClick={() => onNavigate("public-profile", p.pseudo)}
          />
        ))}
        {!loading && players.length === 0 && (
          <p style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>
            Personne n'a encore joué en classé.
          </p>
        )}
      </div>
    </>
  );

  if (sansEnTete) return contenu;

  return (
    <div style={cardWrap}>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, margin: "14px 0 18px", color: COLORS.text }}>
        Classement
      </h2>
      {maPosition > 0 && (
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 16px" }}>
          Tu es <b style={{ color: COLORS.gold }}>{maPosition}<sup>{maPosition === 1 ? "er" : "e"}</sup></b> sur {players.length} joueur{players.length > 1 ? "s" : ""}.
        </p>
      )}
      {contenu}
    </div>
  );
}
