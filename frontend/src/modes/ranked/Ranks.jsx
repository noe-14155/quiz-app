import { useEffect, useState } from "react";
import { Crown, ChevronRight } from "lucide-react";
import { iconeDuRang } from "../../design/rankIcons";
import {
  cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, tint, tierInfo, rankGradient, gradientText,
} from "../../design/theme";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const MEDAILLES = ["#FFC94D", "#C3CBD3", "#D9A066"];

/**
 * Écran « Classement », pensé comme un plateau de jeu télévisé : les trois
 * premiers montent sur un podium, le reste suit en liste.
 *
 * Le podium n'est pas décoratif — il rend le haut du tableau lisible d'un coup
 * d'œil, là où dix lignes identiques obligeaient à lire les numéros un par un.
 * Le reste de la charte est inchangé : mêmes polices, mêmes dégradés de rang,
 * mêmes arrondis.
 */
function Marche({ joueur, position, moi, onClick }) {
  if (!joueur) return <div style={{ flex: 1 }} />;
  const t = tierInfo(joueur.rank_tier);
  const IconeRang = iconeDuRang(t.rankIndex);
  const premier = position === 1;
  const hauteur = premier ? 92 : position === 2 ? 68 : 54;
  const medaille = MEDAILLES[position - 1];

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "flex-end", cursor: "pointer", minWidth: 0,
      }}
    >
      {premier && (
        <Crown size={20} color={medaille} style={{ marginBottom: 4, animation: "sqfloaty 3s ease-in-out infinite" }} />
      )}

      {/* Pastille du rang, posée sur la marche */}
      <span style={{
        width: premier ? 52 : 44, height: premier ? 52 : 44,
        borderRadius: premier ? 17 : 14, flexShrink: 0,
        background: rankGradient(t.rank),
        boxShadow: `0 0 0 3px ${COLORS.bg}, 0 0 0 5px ${medaille}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 8, animation: `sqpop .5s ${position * 0.08}s both`,
      }}>
        <IconeRang size={premier ? 24 : 20} color="#fff" />
      </span>

      <span style={{
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: premier ? 15 : 13.5,
        color: COLORS.text, maxWidth: "100%", overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 2px",
      }}>
        {joueur.pseudo}
      </span>
      <span style={{
        fontFamily: FONT_BODY, fontWeight: 700, fontSize: 10.5, color: COLORS.muted,
        maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {t.rank.name}
      </span>
      <span style={{
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 12.5, color: COLORS.gold, marginBottom: 8,
      }}>
        {joueur.rank_points.toLocaleString("fr-FR")}
      </span>

      {/* La marche elle-même */}
      <div style={{
        width: "100%", height: hauteur, borderRadius: "14px 14px 0 0",
        background: `linear-gradient(180deg, ${medaille}, ${medaille}00)`,
        display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 8,
        animation: `sqrise .5s ${position * 0.08}s both`,
      }}>
        <span style={{
          fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: premier ? 26 : 21,
          color: "#fff", opacity: 0.9, lineHeight: 1,
        }}>
          {position}
        </span>
      </div>
      {moi && (
        <span style={{
          fontFamily: FONT_BODY, fontWeight: 800, fontSize: 10, letterSpacing: 0.6,
          color: COLORS.gold, marginTop: -1,
        }}>
          TOI
        </span>
      )}
    </div>
  );
}

/** Ligne du tableau, de la 4e place à la 10e. */
function Ligne({ joueur, position, moi, onClick, dernier }) {
  const t = tierInfo(joueur.rank_tier);
  const IconeRang = iconeDuRang(t.rankIndex);
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 14,
        background: moi ? tint(COLORS.gold, 8) : "transparent",
        border: `1px solid ${moi ? COLORS.gold : "transparent"}`,
        borderBottom: !dernier && !moi ? `1px solid ${COLORS.cardAlt}` : undefined,
        cursor: "pointer",
      }}
    >
      <span style={{
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 13.5, color: COLORS.chevron,
        width: 20, textAlign: "center", flexShrink: 0,
      }}>
        {position}
      </span>
      <span style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: rankGradient(t.rank),
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <IconeRang size={16} color="#fff" />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15,
          color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {joueur.pseudo}{moi ? <span style={{ color: COLORS.gold }}> (toi)</span> : null}
        </span>
        <span style={{ display: "block", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 11, color: COLORS.muted }}>
          {t.rank.name} {t.palierLabel}
        </span>
      </span>
      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: COLORS.text, flexShrink: 0 }}>
        {joueur.rank_points.toLocaleString("fr-FR")}
      </span>
      <ChevronRight size={15} color={COLORS.chevron} style={{ flexShrink: 0, marginLeft: -4 }} />
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
  const estMoi = (p) => user && p.pseudo === user.pseudo;
  const podium = top.slice(0, 3);
  const suite = top.slice(3);

  return (
    <div style={cardWrap}>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, margin: "14px 0 4px", color: COLORS.text }}>
        Classement
      </h2>
      <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 22px" }}>
        {moi
          ? <>Tu es <b style={{ color: COLORS.gold }}>{moi.position}<sup>{moi.position === 1 ? "er" : "e"}</sup></b> sur {moi.total} joueur{moi.total > 1 ? "s" : ""}.</>
          : "Les dix meilleurs joueurs."}
      </p>

      {erreur && <p style={{ color: COLORS.danger, fontSize: 13 }}>{erreur}</p>}
      {!data && !erreur && <p style={{ color: COLORS.muted, fontSize: 14 }}>Chargement…</p>}

      {/* Podium : 2e à gauche, 1er au centre, 3e à droite */}
      {podium.length > 0 && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 22 }}>
          <Marche joueur={podium[1]} position={2} moi={podium[1] && estMoi(podium[1])}
                  onClick={() => podium[1] && onNavigate("public-profile", podium[1].pseudo)} />
          <Marche joueur={podium[0]} position={1} moi={podium[0] && estMoi(podium[0])}
                  onClick={() => podium[0] && onNavigate("public-profile", podium[0].pseudo)} />
          <Marche joueur={podium[2]} position={3} moi={podium[2] && estMoi(podium[2])}
                  onClick={() => podium[2] && onNavigate("public-profile", podium[2].pseudo)} />
        </div>
      )}

      {suite.map((p, i) => (
        <Ligne
          key={p.pseudo}
          joueur={p}
          position={i + 4}
          moi={estMoi(p)}
          dernier={i === suite.length - 1}
          onClick={() => onNavigate("public-profile", p.pseudo)}
        />
      ))}

      {/* Hors du tableau : sa propre ligne, détachée */}
      {moi && !moi.dans_le_haut && (
        <>
          <p style={{ textAlign: "center", color: COLORS.chevron, fontSize: 18, margin: "8px 0", letterSpacing: 3 }}>···</p>
          <Ligne joueur={moi} position={moi.position} moi dernier
                 onClick={() => onNavigate("public-profile", moi.pseudo)} />
        </>
      )}

      {data && top.length === 0 && (
        <div style={{ textAlign: "center", padding: "30px 0" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, margin: "0 0 6px", ...gradientText(120) }}>
            Le podium est vide
          </p>
          <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
            Personne n'a encore joué en classé.<br />La première place est à prendre.
          </p>
        </div>
      )}

      <p style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5, marginTop: 22 }}>
        L'échelle complète des rangs se trouve dans le mode Classé.
      </p>
    </div>
  );
}
