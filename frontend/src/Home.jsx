import { useEffect, useState } from "react";
import {
  ChevronRight, Swords, Users, Flame, Timer, Trophy, Coffee, Zap, Lightbulb, Check,
} from "lucide-react";
import {
  COLORS, FONT_DISPLAY, FONT_BODY, cardWrap, gradientText, gradientTri,
  sectionLabel, tint, tierInfo, rankGradient,
} from "./design/theme";
import { useAuth } from "./auth/AuthContext";
import { apiFetch } from "./api/client";

/** Ligne de mode : pastille colorée, nom, accroche courte, chevron. */
function ModeRow({ Icone, couleur, titre, accroche, onClick, actif = true, dernier }) {
  return (
    <button
      onClick={actif ? onClick : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left",
        background: "none", border: "none", cursor: actif ? "pointer" : "not-allowed",
        padding: "13px 2px", borderBottom: dernier ? "none" : `1px solid ${COLORS.cardAlt}`,
        opacity: actif ? 1 : 0.45,
      }}
    >
      <span style={{
        width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: tint(couleur, 14),
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icone size={19} color={couleur} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: COLORS.text }}>
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

/** Pastille d'état pour les rendez-vous du jour : fait ou à faire. */
function ChipDuJour({ Icone, label, fait, couleur, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: "flex", alignItems: "center", gap: 9, padding: "11px 12px",
        borderRadius: 15, cursor: "pointer", textAlign: "left",
        background: fait ? tint(COLORS.success, 9) : tint(couleur, 10),
        border: `1px solid ${fait ? tint(COLORS.success, 35) : tint(couleur, 35)}`,
      }}
    >
      <span style={{
        width: 30, height: 30, borderRadius: 10, flexShrink: 0,
        background: fait ? COLORS.success : couleur,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {fait ? <Check size={15} color="#fff" strokeWidth={3} /> : <Icone size={15} color="#fff" />}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 13, color: COLORS.text }}>
          {label}
        </span>
        <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: fait ? COLORS.success : COLORS.muted }}>
          {fait ? "Fait" : "À faire"}
        </span>
      </span>
    </button>
  );
}

export default function Home({ onNavigate }) {
  const { user } = useAuth();
  const [modes, setModes] = useState({
    mode_chill_enabled: true, mode_ranked_enabled: true, mode_local_enabled: true,
    mode_arcade_enabled: true, mode_duel_enabled: true,
  });
  const [defi, setDefi] = useState(null);
  const [enigme, setEnigme] = useState(null);

  useEffect(() => {
    apiFetch("/api/modes/status").then(setModes).catch(() => {});
  }, []);

  // Aperçu des rendez-vous du jour : juste de quoi savoir s'il reste
  // quelque chose à faire. Le détail est dans l'onglet « Du jour ».
  useEffect(() => {
    if (!user) { setDefi(null); setEnigme(null); return; }
    apiFetch("/api/daily/today").then(setDefi).catch(() => {});
    apiFetch("/api/enigme/today").then(setEnigme).catch(() => {});
  }, [user]);

  const t = user ? tierInfo(user.rank_tier) : null;
  const serie = defi?.streak?.current || 0;

  return (
    <div style={cardWrap}>
      {/* En-tête : le logo et l'accueil personnel */}
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

      {/* Bandeau personnel : rang, progression, série */}
      {user ? (
        <button
          onClick={() => onNavigate("ranked-setup")}
          style={{
            display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left",
            background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`, borderRadius: 20,
            padding: "14px 16px", marginBottom: 14, cursor: "pointer", animation: "sqrise .45s .05s both",
          }}
        >
          <span style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: rankGradient(t.rank),
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: "#fff",
          }}>
            {t.palierLabel}
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
            padding: "15px 16px", marginBottom: 14, cursor: "pointer",
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

      {/* Rendez-vous du jour, en un coup d'œil */}
      {user && (defi || enigme) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 4, animation: "sqrise .45s .1s both" }}>
          <ChipDuJour
            Icone={Zap} label="Défi du jour" couleur={COLORS.gold}
            fait={!!defi?.already_played}
            onClick={() => onNavigate("daily")}
          />
          <ChipDuJour
            Icone={Lightbulb} label="Énigme" couleur={COLORS.accent3}
            fait={!!enigme?.trouve}
            onClick={() => onNavigate("enigme")}
          />
        </div>
      )}

      <p style={sectionLabel}>En solo</p>
      <ModeRow
        Icone={Trophy} couleur={COLORS.shapeA} titre="Classé" accroche="Chrono, points et rang en jeu"
        actif={modes.mode_ranked_enabled}
        onClick={() => onNavigate(user ? "ranked-setup" : "login")}
      />
      <ModeRow
        Icone={Coffee} couleur={COLORS.shapeD} titre="Chill" accroche="Sans chrono, à ton rythme"
        actif={modes.mode_chill_enabled} dernier
        onClick={() => onNavigate("chill-setup")}
      />

      <p style={sectionLabel}>À plusieurs</p>
      <ModeRow
        Icone={Swords} couleur="#3B82F6" titre="Duel" accroche="Défie un ami, chacun joue quand il veut"
        actif={modes.mode_duel_enabled}
        onClick={() => onNavigate(user ? "duel" : "login")}
      />
      <ModeRow
        Icone={Users} couleur={COLORS.shapeB} titre="Local" accroche="Entre potes, sur un seul écran"
        actif={modes.mode_local_enabled} dernier
        onClick={() => onNavigate("local-choice")}
      />

      {modes.mode_arcade_enabled !== false && (
        <>
          <p style={sectionLabel}>En deux minutes</p>
          <ModeRow
            Icone={Flame} couleur={COLORS.shapeC} titre="Survie" accroche="Enchaîne jusqu'à la première erreur"
            onClick={() => onNavigate("survie")}
          />
          <ModeRow
            Icone={Timer} couleur={COLORS.accent2} titre="Contre-la-montre" accroche="60 secondes, un maximum de bonnes réponses"
            dernier
            onClick={() => onNavigate("chrono")}
          />
        </>
      )}
    </div>
  );
}
