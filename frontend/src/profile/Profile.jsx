import { useEffect, useState } from "react";
import { LogOut, Sparkles } from "lucide-react";
import { cardWrap, COLORS, FONT_DISPLAY, tierInfo } from "../design/theme";
import TopBar from "../components/TopBar";
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
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20 }}>
          {profile.pseudo[0].toUpperCase()}
        </div>
        <div>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, margin: 0 }}>{profile.pseudo}</p>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>Niveau {level}</p>
        </div>
      </div>

      <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: COLORS.muted, display: "flex", alignItems: "center", gap: 4 }}><Sparkles size={12} /> XP</span>
        <span style={{ fontSize: 12, color: COLORS.muted }}>{profile.xp_total} XP</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: COLORS.cardAlt, marginBottom: 20, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(4, Math.min(100, progress || 0))}%`, background: COLORS.gold }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, background: COLORS.card, borderRadius: 14, padding: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: t.rank.color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, margin: 0 }}>{t.rank.name} {t.palierLabel}</p>
          <div style={{ height: 6, borderRadius: 3, background: COLORS.cardAlt, marginTop: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${profile.rank_points}%`, background: t.rank.color }} />
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: COLORS.muted, margin: "22px 0 10px", textTransform: "uppercase" }}>Stats par thème</p>
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
    </>
  );
}

export function Profile({ screen, onNavigate }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div style={cardWrap}>
      <TopBar screen={screen} onNavigate={onNavigate} />
      <ProfileBody profile={user} />
      {user.is_admin ? (
        <button onClick={() => onNavigate("admin")}
          style={{ background: "none", border: "none", color: COLORS.gold, cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, margin: "22px auto 0" }}>
          Administration
        </button>
      ) : null}
      <button onClick={() => { logout(); onNavigate("home"); }}
        style={{ background: "none", border: "none", color: COLORS.danger, cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, margin: "12px auto 0" }}>
        <LogOut size={16} /> Se déconnecter
      </button>
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
