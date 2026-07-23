import { useEffect, useState } from "react";
import { cardWrap, COLORS, FONT_DISPLAY, tint } from "../../design/theme";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

/**
 * Onglet « Classement » : le haut du tableau, rien de plus.
 *
 * Volontairement dépouillé — pas de pastilles de rang ni d'échelle ici. Ces
 * informations relèvent de la progression personnelle et vivent désormais dans
 * l'écran du mode Classé et dans le profil. Ce que l'on vient chercher ici,
 * c'est « qui est devant moi ».
 */
function Ligne({ position, pseudo, points, moi, separateur = true }) {
  const podium = position <= 3;
  const medaille = ["#FFC94D", "#C3CBD3", "#D9A066"][position - 1];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: "13px 12px", borderRadius: 14,
      background: moi ? tint(COLORS.gold, 8) : "transparent",
      border: `1px solid ${moi ? COLORS.gold : "transparent"}`,
      borderBottom: separateur && !moi ? `1px solid ${COLORS.cardAlt}` : undefined,
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: 9, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: podium ? medaille : "transparent",
        color: podium ? "#fff" : COLORS.muted,
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14,
      }}>
        {position}
      </span>
      <span style={{
        flex: 1, minWidth: 0, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16,
        color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {pseudo}{moi ? <span style={{ color: COLORS.gold }}> (toi)</span> : null}
      </span>
      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: COLORS.text, flexShrink: 0 }}>
        {points.toLocaleString("fr-FR")}
      </span>
    </div>
  );
}

export default function Ranks({ onNavigate }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    apiFetch("/api/ranked/leaderboard").then(setData).catch((e) => setErreur(e.message));
  }, []);

  const top = data?.leaderboard || [];
  const moi = data?.moi;

  return (
    <div style={cardWrap}>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, margin: "14px 0 4px", color: COLORS.text }}>
        Classement
      </h2>
      <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 20px" }}>
        {moi
          ? `Tu es ${moi.position}${moi.position === 1 ? "er" : "e"} sur ${moi.total} joueur${moi.total > 1 ? "s" : ""}.`
          : "Les cinq meilleurs joueurs."}
      </p>

      {erreur && <p style={{ color: COLORS.danger, fontSize: 13 }}>{erreur}</p>}
      {!data && !erreur && <p style={{ color: COLORS.muted, fontSize: 14 }}>Chargement…</p>}

      {top.map((p, i) => (
        <Ligne
          key={p.pseudo}
          position={i + 1}
          pseudo={p.pseudo}
          points={p.rank_points}
          moi={user && p.pseudo === user.pseudo}
          separateur={i < top.length - 1}
        />
      ))}

      {/* Hors du top : sa propre ligne, détachée, pour se situer quand même. */}
      {moi && !moi.dans_le_haut && (
        <>
          <p style={{ textAlign: "center", color: COLORS.chevron, fontSize: 18, margin: "6px 0", letterSpacing: 3 }}>···</p>
          <Ligne position={moi.position} pseudo={moi.pseudo} points={moi.rank_points} moi separateur={false} />
        </>
      )}

      {data && top.length === 0 && (
        <p style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: "24px 0", lineHeight: 1.5 }}>
          Personne n'a encore joué en classé.<br />Lance une partie pour ouvrir le tableau.
        </p>
      )}

      <p style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5, marginTop: 22 }}>
        Ton rang et l'échelle complète se trouvent dans le mode Classé et dans ton profil.
      </p>
    </div>
  );
}
