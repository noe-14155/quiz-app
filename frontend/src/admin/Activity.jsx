import { useEffect, useState } from "react";
import { Activity as ActivityIcon, Users, LogIn, Zap } from "lucide-react";
import { COLORS, FONT_DISPLAY, FONT_BODY } from "../design/theme";
import { apiFetch } from "../api/client";

function Stat({ icon, value, label }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 12, padding: "10px 14px", flex: 1, minWidth: 110 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.gold, marginBottom: 2 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: FONT_DISPLAY, color: COLORS.text }}>{value}</p>
      <p style={{ margin: 0, fontSize: 11, color: COLORS.muted }}>{label}</p>
    </div>
  );
}

/** Petit histogramme sans dépendance : suffisant pour lire une tendance. */
function MiniChart({ data, label }) {
  if (!data || data.length === 0) {
    return <p style={{ fontSize: 12, color: COLORS.muted, margin: "0 0 16px" }}>Aucune donnée sur la période.</p>;
  }
  const max = Math.max(...data.map((d) => d.n), 1);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 70 }}>
        {data.map((d) => (
          <div key={d.jour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
               title={`${d.jour} — ${d.n} ${label}`}>
            <span style={{ fontSize: 9, color: COLORS.muted, fontWeight: 700 }}>{d.n}</span>
            <div style={{ width: "100%", height: `${(d.n / max) * 50}px`, minHeight: 3, background: COLORS.gold, borderRadius: 3 }} />
            <span style={{ fontSize: 9, color: COLORS.muted }}>{d.jour.slice(8, 10)}/{d.jour.slice(5, 7)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function timeAgo(iso) {
  if (!iso) return "jamais";
  const diff = (Date.now() - Date.parse(iso)) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export default function Activity() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/api/admin/activity").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: COLORS.danger, fontSize: 13 }}>{error}</p>;
  if (!data) return <p style={{ color: COLORS.muted, fontSize: 14 }}>Chargement du suivi…</p>;

  const t = data.totaux;
  const maxMode = Math.max(...data.par_mode.map((m) => m.n), 1);

  return (
    <div style={{ fontFamily: FONT_BODY }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <Stat icon={<LogIn size={14} />} value={t.connexions_total} label="Connexions (total)" />
        <Stat icon={<ActivityIcon size={14} />} value={t.connexions_7j} label="Connexions (7 j)" />
        <Stat icon={<Users size={14} />} value={t.joueurs_actifs_7j} label="Joueurs actifs (7 j)" />
        <Stat icon={<Zap size={14} />} value={t.evenements_total} label="Événements" />
      </div>

      <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Connexions par jour
      </p>
      <MiniChart data={data.logins_par_jour} label="connexions" />

      <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Inscriptions par jour
      </p>
      <MiniChart data={data.inscriptions_par_jour} label="inscriptions" />

      <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Ce qui est joué
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
        {data.par_mode.length === 0 && <p style={{ fontSize: 12, color: COLORS.muted, margin: 0 }}>Aucune partie enregistrée pour l'instant.</p>}
        {data.par_mode.map((m) => (
          <div key={m.event} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, width: 130, flexShrink: 0, color: COLORS.text }}>{m.label}</span>
            <div style={{ flex: 1, height: 8, background: COLORS.cardAlt, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(m.n / maxMode) * 100}%`, background: COLORS.gold }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, width: 28, textAlign: "right" }}>{m.n}</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Joueurs
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
        {data.joueurs.map((j) => (
          <div key={j.pseudo} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.card, borderRadius: 12, padding: "8px 14px" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{j.pseudo}</span>
            <span style={{ fontSize: 11, color: COLORS.muted }}>
              {j.nb_connexions} connexion{j.nb_connexions > 1 ? "s" : ""} · {timeAgo(j.derniere_connexion)}
            </span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Derniers événements
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.feed.map((e, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 2px", borderBottom: `1px solid ${COLORS.cardAlt}` }}>
            <span style={{ fontSize: 12, color: COLORS.text }}>
              <b>{e.pseudo || "invité"}</b> · {e.label}
            </span>
            <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0, marginLeft: 8 }}>{timeAgo(e.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
