import { useEffect, useState } from "react";
import { ChevronRight, Swords, Users, Flame, Timer, Trophy, Coffee } from "lucide-react";
import {
  COLORS, FONT_DISPLAY, FONT_BODY, cardWrap, gradientText, sectionLabel, tint,
} from "./design/theme";
import { useAuth } from "./auth/AuthContext";
import { apiFetch } from "./api/client";

/**
 * Ligne de mode : pastille colorée, nom, accroche courte, chevron.
 * Volontairement sobre — l'ancienne mosaïque de tuiles en dégradé mettait tous
 * les modes au même niveau visuel et rendait l'écran illisible.
 */
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

export default function Home({ onNavigate }) {
  const { user } = useAuth();
  const [modes, setModes] = useState({
    mode_chill_enabled: true, mode_ranked_enabled: true, mode_local_enabled: true,
    mode_arcade_enabled: true, mode_duel_enabled: true,
  });

  useEffect(() => {
    apiFetch("/api/modes/status").then(setModes).catch(() => {});
  }, []);

  return (
    <div style={cardWrap}>
      <h2 style={{
        fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 800, margin: "14px 0 4px",
        letterSpacing: -0.5, lineHeight: 1, animation: "sqrise .45s both",
      }}>
        <span style={gradientText(90)}>S</span>
        <span style={{ color: COLORS.bg === "#14151f" ? COLORS.text : "#2A2350" }}>quizz</span>
        <span style={gradientText(90)}>YourBrain</span>
      </h2>
      <p style={{ fontSize: 13.5, color: COLORS.muted, margin: "0 0 6px" }}>
        {user ? `Content de te revoir, ${user.pseudo}.` : "Choisis ta façon de jouer."}
      </p>

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
