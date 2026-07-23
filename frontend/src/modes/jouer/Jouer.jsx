import { useEffect, useState } from "react";
import {
  ChevronRight, Zap, Lightbulb, Trophy, Coffee, Swords, Users, Flame, Timer, Check,
} from "lucide-react";
import {
  cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, sectionLabel, tint,
} from "../../design/theme";
import { useAuth } from "../../auth/AuthContext";
import { apiFetch } from "../../api/client";

/**
 * Onglet « Jouer » : le catalogue complet, groupé par intention.
 *
 * L'accueil ne montre que l'essentiel ; c'est ici qu'on vient chercher un mode
 * précis. Les rendez-vous quotidiens ouvrent la liste, avec leur état, parce
 * qu'ils expirent à minuit et méritent qu'on les traite en premier.
 */
function Mode({ Icone, couleur, titre, accroche, onClick, actif = true, dernier, badge }) {
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
      {badge}
      <ChevronRight size={17} color={COLORS.chevron} style={{ flexShrink: 0 }} />
    </button>
  );
}

/** Pastille « fait » verte, ou série en cours. */
function Badge({ fait, serie }) {
  if (fait) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
        background: tint(COLORS.success, 12), borderRadius: 20, padding: "4px 10px",
        fontFamily: FONT_BODY, fontWeight: 800, fontSize: 11, color: COLORS.success,
      }}>
        <Check size={12} /> Fait
      </span>
    );
  }
  if (serie > 0) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
        background: tint(COLORS.accent3, 14), borderRadius: 20, padding: "4px 10px",
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 12, color: COLORS.accent3,
      }}>
        <Flame size={11} /> {serie}
      </span>
    );
  }
  return null;
}

export default function Jouer({ onNavigate }) {
  const { user } = useAuth();
  const [modes, setModes] = useState({
    mode_chill_enabled: true, mode_ranked_enabled: true, mode_local_enabled: true,
    mode_daily_enabled: true, mode_arcade_enabled: true, mode_duel_enabled: true,
    mode_enigme_enabled: true,
  });
  const [defi, setDefi] = useState(null);
  const [enigme, setEnigme] = useState(null);

  useEffect(() => {
    apiFetch("/api/modes/status").then(setModes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) { setDefi(null); setEnigme(null); return; }
    apiFetch("/api/daily/today").then(setDefi).catch(() => {});
    apiFetch("/api/enigme/today").then(setEnigme).catch(() => {});
  }, [user]);

  const quotidiens = modes.mode_daily_enabled !== false || modes.mode_enigme_enabled !== false;

  return (
    <div style={cardWrap}>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, margin: "14px 0 2px", color: COLORS.text }}>
        Jouer
      </h2>
      <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 4px" }}>
        Tous les modes disponibles.
      </p>

      {quotidiens && (
        <>
          <p style={sectionLabel}>Chaque jour</p>
          {modes.mode_daily_enabled !== false && (
            <Mode
              Icone={Zap} couleur={COLORS.gold} titre="Défi du jour"
              accroche="10 questions, les mêmes pour tout le monde"
              badge={<Badge fait={!!defi?.already_played} serie={defi?.streak?.current} />}
              onClick={() => onNavigate(user ? "daily" : "login")}
            />
          )}
          {modes.mode_enigme_enabled !== false && (
            <Mode
              Icone={Lightbulb} couleur={COLORS.accent3} titre="Énigme du jour"
              accroche="Une devinette, trois indices" dernier
              badge={<Badge fait={!!enigme?.trouve} serie={enigme?.serie?.current} />}
              onClick={() => onNavigate(user ? "enigme" : "login")}
            />
          )}
        </>
      )}

      <p style={sectionLabel}>En solo</p>
      <Mode
        Icone={Trophy} couleur={COLORS.shapeA} titre="Classé" accroche="Chrono, points et rang en jeu"
        actif={modes.mode_ranked_enabled}
        onClick={() => onNavigate(user ? "ranked-setup" : "login")}
      />
      <Mode
        Icone={Coffee} couleur={COLORS.shapeD} titre="Chill" accroche="Sans chrono, à ton rythme"
        actif={modes.mode_chill_enabled} dernier
        onClick={() => onNavigate("chill-setup")}
      />

      {modes.mode_arcade_enabled !== false && (
        <>
          <p style={sectionLabel}>En deux minutes</p>
          <Mode
            Icone={Flame} couleur={COLORS.shapeC} titre="Survie" accroche="Enchaîne jusqu'à la première erreur"
            onClick={() => onNavigate("survie")}
          />
          <Mode
            Icone={Timer} couleur={COLORS.accent2} titre="Contre-la-montre" accroche="60 secondes, un maximum de bonnes réponses"
            dernier
            onClick={() => onNavigate("chrono")}
          />
        </>
      )}
      <p style={sectionLabel}>À plusieurs</p>
      <Mode
        Icone={Swords} couleur="#3B82F6" titre="Duel" accroche="Défie un ami, chacun joue quand il veut"
        actif={modes.mode_duel_enabled}
        onClick={() => onNavigate(user ? "duel" : "login")}
      />
      <Mode
        Icone={Users} couleur={COLORS.shapeB} titre="Local" accroche="Entre potes, sur un seul écran"
        actif={modes.mode_local_enabled} dernier
        onClick={() => onNavigate("local-choice")}
      />

    </div>
  );
}
