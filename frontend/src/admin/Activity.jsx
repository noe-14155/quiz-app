import { useEffect, useState } from "react";
import { Activity as ActivityIcon, Users, Gamepad2, Zap } from "lucide-react";
import { COLORS, FONT_DISPLAY, FONT_BODY } from "../design/theme";
import { apiFetch } from "../api/client";
import Collapsible from "../components/Collapsible";
import LineChart from "../components/LineChart";

function Stat({ icon, value, label }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 14, padding: "10px 14px", flex: 1, minWidth: 110 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.gold, marginBottom: 2 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, fontFamily: FONT_DISPLAY, color: COLORS.text }}>{value}</p>
      <p style={{ margin: 0, fontSize: 11, color: COLORS.muted }}>{label}</p>
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
      {/* Chiffres clés : parties jouées + joueurs distincts en tête */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <Stat icon={<Gamepad2 size={14} />} value={t.parties_total ?? t.evenements_total} label="Parties jouées" />
        <Stat icon={<Users size={14} />} value={t.joueurs_actifs_7j} label="Joueurs distincts (7 j)" />
        <Stat icon={<ActivityIcon size={14} />} value={t.connexions_7j} label="Connexions (7 j)" />
        <Stat icon={<Zap size={14} />} value={t.connexions_total} label="Connexions (total)" />
      </div>

      <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Joueurs par jour
      </p>
      <LineChart data={data.joueurs_par_jour} label="joueurs" color={COLORS.gold} />

      <p style={{ fontSize: 13, color: COLORS.muted, margin: "12px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Parties jouées par jour
      </p>
      <LineChart data={data.parties_par_jour} label="parties" color={COLORS.success} />

      <div style={{ marginTop: 16 }}>
        {/* Répartition par mode — dépliable */}
        <Collapsible title="Ce qui est joué" count={data.par_mode.length}>
          {data.par_mode.length === 0
            ? <p style={{ fontSize: 12, color: COLORS.muted, margin: 0 }}>Aucune partie enregistrée pour l'instant.</p>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
            )}
        </Collapsible>

        {/* Joueurs — dépliable, avec dernière PARTIE jouée */}
        <Collapsible title="Joueurs" count={data.joueurs.length}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.joueurs.map((j) => (
              <div key={j.pseudo} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.card, borderRadius: 14, padding: "9px 14px" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{j.pseudo}</span>
                <span style={{ fontSize: 11, color: COLORS.muted }}>
                  {j.nb_parties || 0} partie{(j.nb_parties || 0) > 1 ? "s" : ""} · joué {timeAgo(j.derniere_partie)}
                </span>
              </div>
            ))}
          </div>
        </Collapsible>

        {/* Derniers événements — dépliable */}
        <Collapsible title="Derniers événements" count={data.feed.length}>
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
        </Collapsible>
      </div>
    </div>
  );
}
