import { useState } from "react";
import { LogOut, Sparkles, ChevronRight, Sun, Moon } from "lucide-react";
import { cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, tierInfo, gradient, rankGradient, sectionLabel, tint, ACCENT_OPTIONS } from "../design/theme";
import { useThemeSettings } from "../design/ThemeContext";
import RankEmblem from "../design/rankEmblems";
import Avatar, { NB_VISAGES, COULEURS_AVATAR } from "../components/Avatar";
import { apiFetch } from "../api/client";
import { FEEDBACK, setFeedback } from "../design/feedback";
import Button from "../components/Button";
import Collapsible from "../components/Collapsible";
import { useAuth } from "../auth/AuthContext";

function xpForLevel(n) {
  return Math.round((n / 0.6) ** 2);
}

function ProfileBody({ profile }) {
  const level = profile.level;
  const xpCurrent = xpForLevel(level);
  const xpNext = xpForLevel(level + 1);
  const progress = ((profile.xp_total - xpCurrent) / (xpNext - xpCurrent)) * 100;
  const t = tierInfo(profile.rank_tier);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <Avatar face={profile.avatar_face} color={profile.avatar_color} size={58} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800, margin: 0, color: COLORS.text }}>
            {profile.pseudo}
          </p>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "2px 0 0", fontWeight: 700 }}>Niveau {level}</p>
        </div>
      </div>

      <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: COLORS.muted, display: "flex", alignItems: "center", gap: 4 }}><Sparkles size={12} /> XP</span>
        <span style={{ fontSize: 12, color: COLORS.muted }}>{profile.xp_total} XP</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: COLORS.cardAlt, marginBottom: 20, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(4, Math.min(100, progress || 0))}%`, background: gradient(90) }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`, borderRadius: 18, padding: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 15, background: rankGradient(t.rank), flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <RankEmblem rangIndex={t.rankIndex} size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 800, margin: 0 }}>{t.rank.name} {t.palierLabel}</p>
            <p style={{ fontSize: 12, color: COLORS.muted, margin: 0, fontWeight: 700 }}>{profile.rank_points} pts</p>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: COLORS.cardAlt, marginTop: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${profile.rank_progress}%`, background: rankGradient(t.rank) }} />
          </div>
        </div>
      </div>

    </>
  );
}

/** Ligne de réglage : libellé, sous-titre optionnel, et contrôle à droite. */
function Row({ label, sub, children, last, onClick, danger }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "14px 0", borderBottom: last ? "none" : `1px solid ${COLORS.cardAlt}`,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div>
        <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, margin: 0, color: danger ? COLORS.danger : COLORS.text }}>
          {label}
        </p>
        {sub && <p style={{ fontSize: 11.5, color: COLORS.muted, margin: "1px 0 0" }}>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

/** Interrupteur, aux dimensions utilisées partout dans l'application. */
function Interrupteur({ actif, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 48, height: 28, borderRadius: 20, border: "none", cursor: "pointer",
        position: "relative", flexShrink: 0,
        background: actif ? COLORS.gold : COLORS.cardAlt, transition: "background .2s",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: actif ? 23 : 3, width: 22, height: 22, borderRadius: "50%",
        background: "#fff", transition: "left .2s", boxShadow: "0 2px 5px rgba(0,0,0,.2)",
      }} />
    </button>
  );
}

function Section({ title, children, pad = "4px 16px" }) {
  return (
    <>
      <p style={{ ...sectionLabel, margin: "6px 0 10px" }}>{title}</p>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`, borderRadius: 18, padding: pad, marginBottom: 18 }}>
        {children}
      </div>
    </>
  );
}

/**
 * Écran unique « Profil & réglages » : identité et progression du joueur,
 * puis apparence et compte. Remplace l'ancien panneau de réglages en surimpression.
 */
export function Profile({ screen, onNavigate }) {
  const { user, logout, refreshProfile } = useAuth();
  const { mode, accent, setMode, setAccent } = useThemeSettings();
  const [fb, setFb] = useState(FEEDBACK);
  const [visage, setVisage] = useState(user?.avatar_face ?? 0);
  const [couleur, setCouleur] = useState(user?.avatar_color ?? COULEURS_AVATAR[0]);

  /** Aperçu immédiat, enregistrement en arrière-plan : le choix doit être
   *  instantané, l'aller-retour réseau ne doit pas se voir. */
  function majAvatar(face, color) {
    setVisage(face);
    setCouleur(color);
    apiFetch("/api/profile/me/avatar", {
      method: "PATCH",
      body: JSON.stringify({ face, color }),
    }).then(refreshProfile).catch(() => {});
  }

  function majFeedback(patch) {
    setFeedback(patch);
    setFb({ ...FEEDBACK });
  }

  // Un écran blanc serait déroutant : si on arrive ici sans compte (lien direct,
  // session expirée), on invite explicitement à se connecter.
  if (!user) {
    return (
      <div style={cardWrap}>
        <div style={{ textAlign: "center", paddingTop: 60 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, color: COLORS.text, margin: "0 0 6px" }}>
            Tu n'es pas connecté
          </p>
          <p style={{ fontSize: 13.5, color: COLORS.muted, margin: "0 0 22px", lineHeight: 1.5 }}>
            Connecte-toi pour retrouver ton rang, tes succès et tes réglages.
          </p>
          <Button onClick={() => onNavigate("login")}>Se connecter</Button>
          <div style={{ height: 10 }} />
          <Button variant="secondary" onClick={() => onNavigate("home")}>Accueil</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={cardWrap}>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, margin: "14px 0 18px", color: COLORS.text }}>
        Profil
      </h2>

      <ProfileBody profile={user} />

      <div style={{ height: 24 }} />

      <Section title="Progression">
        <Row
          label="Succès"
          sub={user.achievements
            ? `${user.achievements.filter((a) => a.unlocked).length} sur ${user.achievements.length} obtenus`
            : "À découvrir en jouant"}
          onClick={() => onNavigate("succes")}
        >
          <ChevronRight size={18} color={COLORS.chevron} />
        </Row>
        <Row label="Statistiques détaillées" sub="Progression, régularité, thèmes forts et faibles" last
             onClick={() => onNavigate("stats")}>
          <ChevronRight size={18} color={COLORS.chevron} />
        </Row>
      </Section>

      <Collapsible title="Mon avatar">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <Avatar face={visage} color={couleur} size={54} />
          <p style={{ fontSize: 12.5, color: COLORS.muted, lineHeight: 1.45, margin: 0 }}>
            Choisis une expression et une couleur. Ton avatar te suit au classement
            et sur ton profil public.
          </p>
        </div>

        <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: COLORS.text, margin: "0 0 9px" }}>
          Expression
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginBottom: 16 }}>
          {Array.from({ length: NB_VISAGES }, (_, i) => (
            <button
              key={i}
              onClick={() => majAvatar(i, couleur)}
              aria-label={`Visage ${i + 1}`}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                borderRadius: 15, outline: visage === i ? `3px solid ${COLORS.text}` : "3px solid transparent",
                transform: visage === i ? "scale(1.06)" : "none", transition: "transform .15s",
              }}
            >
              <Avatar face={i} color={couleur} size={44} />
            </button>
          ))}
        </div>

        <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: COLORS.text, margin: "0 0 9px" }}>
          Couleur
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          {COULEURS_AVATAR.map((c) => (
            <button
              key={c}
              onClick={() => majAvatar(visage, c)}
              aria-label={`Couleur ${c}`}
              style={{
                width: 36, height: 36, borderRadius: 12, background: c, cursor: "pointer",
                border: couleur === c ? `3px solid ${COLORS.text}` : "3px solid transparent",
                transform: couleur === c ? "scale(1.08)" : "none", transition: "transform .15s",
              }}
            />
          ))}
        </div>
      </Collapsible>

      <Section title="Apparence" pad="14px 16px">
        <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: COLORS.text, margin: "0 0 10px" }}>Thème</p>
        <div style={{ display: "flex", gap: 8 }}>
          {[["light", "Clair", Sun], ["dark", "Sombre", Moon]].map(([id, label, Icone]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "11px 0", borderRadius: 14, cursor: "pointer",
                border: `1.5px solid ${mode === id ? COLORS.gold : COLORS.cardAlt}`,
                background: mode === id ? tint(COLORS.gold, 10) : "transparent",
                color: mode === id ? COLORS.gold : COLORS.text,
                fontFamily: FONT_BODY, fontWeight: 800, fontSize: 13,
              }}
            >
              <Icone size={15} /> {label}
            </button>
          ))}
        </div>

        <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: COLORS.text, margin: "16px 0 10px" }}>
          Couleur d&apos;accent
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setAccent(opt.value)}
              aria-label={opt.name}
              style={{
                width: 38, height: 38, borderRadius: 12, background: opt.value, cursor: "pointer",
                border: accent === opt.value ? `3px solid ${COLORS.text}` : "3px solid transparent",
                transform: accent === opt.value ? "scale(1.08)" : "none", transition: "transform .15s",
              }}
            />
          ))}
        </div>
      </Section>

      <Section title="Sensations" pad="4px 16px">
        <Row label="Vibrations" sub="Retour tactile à chaque réponse">
          <Interrupteur actif={fb.vibration} onToggle={() => majFeedback({ vibration: !fb.vibration })} />
        </Row>
        <Row label="Sons" sub="Petits repères sonores, discrets" last>
          <Interrupteur actif={fb.son} onToggle={() => majFeedback({ son: !fb.son })} />
        </Row>
      </Section>

      <Section title="Compte">
        {user.is_admin && (
          <Row label="Administration" sub="Joueurs, réglages et suivi" onClick={() => onNavigate("admin")}>
            <ChevronRight size={18} color={COLORS.chevron} />
          </Row>
        )}
        <Row label="Se déconnecter" danger last onClick={() => { logout(); onNavigate("home"); }}>
          <LogOut size={16} color={COLORS.danger} />
        </Row>
      </Section>

      <p style={{ textAlign: "center", fontSize: 11, color: COLORS.chevron, margin: "16px 0 0" }}>
        SquizzYourBrain · v1.0
      </p>
    </div>
  );
}
