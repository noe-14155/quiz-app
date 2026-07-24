import { useEffect, useState } from "react";
import { ChevronRight, Zap, Coffee, Trophy, Flame, Check } from "lucide-react";
import {
  COLORS, FONT_DISPLAY, FONT_BODY, cardWrap, gradientFull, gradientTri,
  gradientText, tint, tierInfo, rankGradient,
} from "./design/theme";
import { iconeDuRang } from "./design/rankIcons";
import Avatar from "./components/Avatar";
import { useAuth } from "./auth/AuthContext";
import { apiFetch } from "./api/client";

/**
 * Écran d'accueil : volontairement réduit à l'essentiel.
 *
 * Trois entrées seulement — le rendez-vous du jour, le mode détente, le mode
 * classé. Tout le reste vit dans l'onglet « Jouer ». Un accueil qui présente
 * huit modes ne guide personne ; celui-ci répond à « je fais quoi maintenant ».
 */
function Row({ Icone, couleur, titre, accroche, onClick, actif = true, dernier }) {
  return (
    <button
      onClick={actif ? onClick : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left",
        background: "none", border: "none", cursor: actif ? "pointer" : "not-allowed",
        padding: "15px 2px", borderBottom: dernier ? "none" : `1px solid ${COLORS.cardAlt}`,
        opacity: actif ? 1 : 0.45,
      }}
    >
      <span style={{
        width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: tint(couleur, 14),
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icone size={20} color={couleur} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16.5, color: COLORS.text }}>
          {titre}
        </span>
        <span style={{ display: "block", fontSize: 12.5, color: COLORS.muted, marginTop: 1 }}>
          {actif ? accroche : "Indisponible"}
        </span>
      </span>
      <ChevronRight size={17} color={COLORS.chevron} style={{ flexShrink: 0 }} />
    </button>
  );
}

export default function Home({ onNavigate }) {
  const { user } = useAuth();
  const [modes, setModes] = useState({ mode_chill_enabled: true, mode_ranked_enabled: true, mode_daily_enabled: true });
  const [defi, setDefi] = useState(null);

  useEffect(() => {
    apiFetch("/api/modes/status").then(setModes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) { setDefi(null); return; }
    apiFetch("/api/daily/today").then(setDefi).catch(() => {});
  }, [user]);

  const t = user ? tierInfo(user.rank_tier) : null;
  const IconeRang = t ? iconeDuRang(t.rankIndex) : null;
  const serie = defi?.streak?.current || 0;
  const defiFait = !!defi?.already_played;

  return (
    <div style={cardWrap}>
      <div style={{ margin: "16px 0 20px", animation: "sqrise .45s both" }}>
        <h2 style={{
          fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 800, margin: "0 0 4px",
          letterSpacing: -0.5, lineHeight: 1,
        }}>
          <span style={gradientText(90)}>S</span>
          <span style={{ color: COLORS.bg === "#14151f" ? COLORS.text : "#2A2350" }}>quizz</span>
          <span style={gradientText(90)}>YourBrain</span>
        </h2>
        <p style={{ fontSize: 13.5, color: COLORS.muted, margin: 0 }}>
          {user ? `Salut ${user.pseudo}.` : "Culture générale, tous les jours."}
        </p>
      </div>

      {/* Progression : le rang, cliquable vers le mode classé */}
      {user ? (
        <button
          onClick={() => onNavigate("ranked-setup")}
          style={{
            display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left",
            background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`, borderRadius: 20,
            padding: "14px 16px", marginBottom: 16, cursor: "pointer", animation: "sqrise .45s .05s both",
          }}
        >
          <span style={{ position: "relative", flexShrink: 0 }}>
            <Avatar face={user.avatar_face} color={user.avatar_color} size={46} />
            <span style={{
              position: "absolute", right: -3, bottom: -3, width: 20, height: 20, borderRadius: 7,
              background: rankGradient(t.rank), boxShadow: `0 0 0 2.5px ${COLORS.card}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <IconeRang size={11} color="#fff" />
            </span>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: COLORS.text }}>
                {t.rank.name} {t.palierLabel}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.gold }}>
                {user.rank_points.toLocaleString("fr-FR")} pts
              </span>
            </span>
            <span style={{ display: "block", height: 7, borderRadius: 4, background: COLORS.cardAlt, marginTop: 7, overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${user.rank_progress || 0}%`, background: gradientTri(90) }} />
            </span>
          </span>
          {serie > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
              background: tint(COLORS.accent3, 14), borderRadius: 20, padding: "4px 10px",
              fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 13, color: COLORS.accent3,
            }}>
              <Flame size={12} /> {serie}
            </span>
          )}
        </button>
      ) : (
        <button
          onClick={() => onNavigate("login")}
          style={{
            display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
            background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`, borderRadius: 20,
            padding: "15px 16px", marginBottom: 16, cursor: "pointer",
          }}
        >
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15.5, color: COLORS.text }}>
              Crée ton compte
            </span>
            <span style={{ display: "block", fontSize: 12.5, color: COLORS.muted, marginTop: 1 }}>
              Pour suivre ton rang, tes séries et tes succès
            </span>
          </span>
          <ChevronRight size={18} color={COLORS.chevron} />
        </button>
      )}

      {/* Le rendez-vous du jour, en évidence */}
      {modes.mode_daily_enabled !== false && (
        <button
          onClick={() => onNavigate(user ? "daily" : "login")}
          style={{
            width: "100%", textAlign: "left", border: "none", borderRadius: 20, padding: "18px",
            cursor: "pointer", marginBottom: 10,
            background: gradientFull(110), backgroundSize: "300% 100%",
            boxShadow: `0 14px 30px -18px ${COLORS.gold}8c`,
            animation: "sqgrad 14s linear infinite, sqrise .45s .1s both",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: defiFait ? 10 : 0 }}>
            <span style={{
              width: 44, height: 44, borderRadius: 14, background: "rgba(255,255,255,.22)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Zap size={20} color="#fff" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                display: "block", fontFamily: FONT_BODY, fontWeight: 800, fontSize: 10,
                letterSpacing: 1.5, color: "rgba(255,255,255,.9)",
              }}>
                DÉFI DU JOUR
              </span>
              <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 19, color: "#fff", lineHeight: 1.1 }}>
                10 questions, les mêmes pour tous
              </span>
            </span>
            <ChevronRight size={20} color="#fff" style={{ flexShrink: 0 }} />
          </div>
          {defiFait && (
            <span style={{
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5, color: "rgba(255,255,255,.92)",
            }}>
              <Check size={14} /> Fait aujourd'hui — {defi.already_played.score}/{defi.already_played.total}
            </span>
          )}
        </button>
      )}

      <Row
        Icone={Trophy} couleur={COLORS.shapeA} titre="Classé" accroche="Chrono, points et rang en jeu"
        actif={modes.mode_ranked_enabled}
        onClick={() => onNavigate(user ? "ranked-setup" : "login")}
      />
      <Row
        Icone={Coffee} couleur={COLORS.shapeD} titre="Chill" accroche="Sans chrono, à ton rythme"
        actif={modes.mode_chill_enabled} dernier
        onClick={() => onNavigate("chill-setup")}
      />

      <button
        onClick={() => onNavigate("jouer")}
        style={{
          width: "100%", marginTop: 18, background: COLORS.soft, border: "none", borderRadius: 16,
          padding: 14, cursor: "pointer",
          fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14.5, color: COLORS.text,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        }}
      >
        Voir tous les modes <ChevronRight size={16} />
      </button>
    </div>
  );
}
