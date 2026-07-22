import { useEffect, useState } from "react";
import { Trash2, RotateCcw } from "lucide-react";
import { cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, tint } from "../design/theme";
import TopBar from "../components/TopBar";
import { inputStyle } from "../components/PageTitle";
import Button from "../components/Button";
import Activity from "./Activity";
import Collapsible from "../components/Collapsible";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/AuthContext";

const SETTINGS_LABELS = {
  ranked_gain_low: "Classé — gain bonne réponse (rang le plus bas, Neurone)",
  ranked_gain_high: "Classé — gain bonne réponse (rang le plus haut, Prodige)",
  ranked_loss_low: "Classé — malus mauvaise réponse (rang le plus bas)",
  ranked_loss_high: "Classé — malus mauvaise réponse (rang le plus haut)",
  ranked_loss_pass: "Classé — coût de passer (sous Génie uniquement)",
  ranked_daily_decay: "Classé — perte par jour (dès Génie III)",
  ranked_time_per_question: "Classé — durée par question (s)",
};

const MODE_LABELS = {
  mode_chill_enabled: "Mode Chill",
  mode_ranked_enabled: "Mode Classé",
  mode_local_enabled: "Mode Local",
  mode_daily_enabled: "Défi du jour",
};

export default function Admin({ screen, onNavigate }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("gestion");

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [u, s, st] = await Promise.all([
        apiFetch("/api/admin/users"),
        apiFetch("/api/admin/settings"),
        apiFetch("/api/admin/stats"),
      ]);
      setUsers(u.users);
      setTotal(u.total);
      setSettings(s);
      setStats(st);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resetUser(id) {
    if (!window.confirm("Remettre le score et le rang de ce joueur à zéro ?")) return;
    await apiFetch(`/api/admin/users/${id}/reset`, { method: "POST" });
    loadAll();
  }

  async function deleteUser(id) {
    if (!window.confirm("Supprimer définitivement ce compte ? Cette action est irréversible.")) return;
    await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
    loadAll();
  }

  function updateSettingField(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function toggleMode(key) {
    const newValue = settings[key] === "1" ? "0" : "1";
    const updated = await apiFetch("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ [key]: newValue }) });
    setSettings(updated);
  }

  async function saveSettings() {
    try {
      const updated = await apiFetch("/api/admin/settings", { method: "PATCH", body: JSON.stringify(settings) });
      setSettings(updated);
    } catch (e) {
      setError(e.message);
    }
  }

  if (!user || !user.is_admin) {
    return (
      <div style={cardWrap}>
        <TopBar screen={screen} onNavigate={onNavigate} />
        <p style={{ color: COLORS.danger, fontSize: 14 }}>Réservé aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div style={cardWrap}>
      <TopBar screen={screen} onNavigate={onNavigate} />
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800, margin: "0 0 16px" }}>Administration</h2>

      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[["gestion", "Gestion"], ["suivi", "Suivi"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: "10px 0", borderRadius: 14, cursor: "pointer", fontWeight: 800, fontSize: 13,
            fontFamily: FONT_BODY,
            border: `1.5px solid ${tab === id ? COLORS.gold : COLORS.cardAlt}`,
            background: tab === id ? tint(COLORS.gold, 10) : "transparent",
            color: tab === id ? COLORS.gold : COLORS.text,
          }}>{label}</button>
        ))}
      </div>

      {tab === "suivi" && <Activity />}

      {tab === "gestion" && <>
      {loading && <p style={{ color: COLORS.muted, fontSize: 14 }}>Chargement...</p>}
      {error && <p style={{ color: COLORS.danger, fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {stats && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          <div style={{ background: COLORS.card, borderRadius: 12, padding: "10px 16px", flex: 1, minWidth: 120 }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, fontFamily: FONT_DISPLAY }}>{stats.nb_comptes}</p>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.muted }}>Comptes</p>
          </div>
          <div style={{ background: COLORS.card, borderRadius: 12, padding: "10px 16px", flex: 1, minWidth: 120 }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, fontFamily: FONT_DISPLAY }}>{stats.nb_parties_classees}</p>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.muted }}>Parties classées</p>
          </div>
        </div>
      )}

      <Collapsible title="Joueurs" count={total}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {users.map((u) => (
            <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.card, borderRadius: 14, padding: "10px 14px" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
                  {u.pseudo} {u.is_admin ? <span style={{ color: COLORS.gold, fontSize: 11 }}>(admin)</span> : null}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: COLORS.muted }}>
                  {u.rank_name || `Tier ${u.rank_tier}`} · {u.rank_points} pts · {u.xp_total} XP
                </p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => resetUser(u.id)} aria-label="Réinitialiser" style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", padding: 6 }}>
                  <RotateCcw size={16} />
                </button>
                <button onClick={() => deleteUser(u.id)} aria-label="Supprimer" style={{ background: "none", border: "none", color: COLORS.danger, cursor: "pointer", padding: 6 }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Collapsible>

      {settings && (
        <Collapsible title="Modes de jeu">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.keys(MODE_LABELS).map((key) => {
              const enabled = settings[key] === "1";
              return (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.card, borderRadius: 12, padding: "10px 16px" }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{MODE_LABELS[key]}</span>
                  <button
                    onClick={() => toggleMode(key)}
                    style={{
                      width: 48, height: 28, borderRadius: 20, border: "none", cursor: "pointer", position: "relative",
                      background: enabled ? COLORS.gold : COLORS.cardAlt, transition: "background 0.2s", flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 3, left: enabled ? 23 : 3, width: 22, height: 22, borderRadius: "50%",
                      background: "#fff", transition: "left 0.2s", boxShadow: "0 2px 5px rgba(0,0,0,.2)",
                    }} />
                  </button>
                </div>
              );
            })}
          </div>
        </Collapsible>
      )}

      {settings && (
        <Collapsible title="Réglages globaux">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            {Object.keys(SETTINGS_LABELS).filter((key) => key in settings).map((key) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <label style={{ fontSize: 13, color: COLORS.text, fontFamily: FONT_BODY, flex: 1 }}>
                  {SETTINGS_LABELS[key] || key}
                </label>
                <input
                  value={settings[key]}
                  onChange={(e) => updateSettingField(key, e.target.value)}
                  style={inputStyle({ width: 72, padding: "9px 8px", textAlign: "center", fontSize: 14 })}
                />
              </div>
            ))}
          </div>
          <Button onClick={saveSettings}>Enregistrer les réglages</Button>
        </Collapsible>
      )}
      </>}
    </div>
  );
}
