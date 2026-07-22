import { useEffect, useState } from "react";
import { LogOut, Sparkles, ChevronLeft, ChevronRight, Sun, Moon } from "lucide-react";
import { cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, tierInfo, gradient, rankGradient, sectionLabel, tint, ACCENT_OPTIONS } from "../design/theme";
import { useThemeSettings } from "../design/ThemeContext";
import TopBar from "../components/TopBar";
import Collapsible from "../components/Collapsible";
import { apiFetch } from "../api/client";
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
  const themes = Object.keys(profile.stats_by_theme || {});

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800, margin: 0, color: COLORS.text }}>
          {profile.pseudo}
        </p>
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "2px 0 0", fontWeight: 700 }}>Niveau {level}</p>
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
          fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: "#fff",
        }}>{t.palierLabel}</div>
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

      <div style={{ marginTop: 22 }}>
        <Collapsible title="Stats par thème" count={themes.length}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {themes.length === 0 && <p style={{ color: COLORS.muted, fontSize: 13 }}>Pas encore joué.</p>}
            {themes.map((t2) => {
              const s = profile.stats_by_theme[t2];
              return (
                <div key={t2} style={{ background: COLORS.card, borderRadius: 12, padding: "10px 16px", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{t2}</span>
                  <span style={{ fontSize: 13, color: COLORS.muted }}>{s.pct}% (sur {s.attempted} question{s.attempted > 1 ? "s" : ""})</span>
                </div>
              );
            })}
          </div>
        </Collapsible>
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
  const { user, logout } = useAuth();
  const { mode, accent, setMode, setAccent } = useThemeSettings();
  if (!user) return null;

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
          Profil &amp; réglages
        </h2>
      </div>

      <ProfileBody profile={user} />

      <div style={{ height: 24 }} />

      <Section title="Apparence" pad="14px 16px">
        <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: COLORS.text, margin: "0 0 10px" }}>Thème</p>
        <div style={{ display: "flex", gap: 8 }}>
          {[["light", "Clair", Sun], ["dark", "Sombre", Moon]].map(([id, label, Icon]) => (
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
              <Icon size={15} /> {label}
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

export function PublicProfile({ screen, onNavigate, pseudo }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch(`/api/profile/${encodeURIComponent(pseudo)}`).then(setProfile).catch((e) => setError(e.message));
  }, [pseudo]);

  return (
    <div style={cardWrap}>
      <TopBar screen={screen} onNavigate={onNavigate} />
      {error && <p style={{ color: COLORS.danger, fontSize: 13 }}>{error}</p>}
      {profile && <ProfileBody profile={profile} />}
    </div>
  );
}
