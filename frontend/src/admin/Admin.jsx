import { useEffect, useState } from "react";
import { Trash2, RotateCcw, KeyRound } from "lucide-react";
import { cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, tint } from "../design/theme";
import TopBar from "../components/TopBar";
import { inputStyle } from "../components/PageTitle";
import Button from "../components/Button";
import Activity from "./Activity";
import Collapsible from "../components/Collapsible";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/AuthContext";

const REPORT_LABELS = {
  reponse_fausse: "Réponse fausse",
  explication: "Explication incorrecte",
  ambigue: "Plusieurs réponses possibles",
  faute: "Faute de formulation",
  autre: "Autre",
};

const SETTINGS_LABELS = {
  ranked_amplitude: "Classé — amplitude des variations de points",
  ranked_daily_decay: "Classé — perte par jour (dès Champion III)",
  ranked_time_per_question: "Classé — durée par question (s)",
};

const MODE_LABELS = {
  mode_chill_enabled: "Mode Chill",
  mode_ranked_enabled: "Mode Classé",
  mode_local_enabled: "Mode Local",
  mode_daily_enabled: "Défi du jour",
  mode_arcade_enabled: "Parties rapides (survie, chrono)",
  mode_multi_enabled: "Multi",
  mode_enigme_enabled: "Énigme du jour",
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
  const [reports, setReports] = useState(null);

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

  async function loadReports() {
    try { setReports(await apiFetch("/api/admin/reports")); } catch (e) { setError(e.message); }
  }

  async function resolveReport(id) {
    try {
      await apiFetch(`/api/admin/reports/${id}/resolve`, { method: "POST" });
      loadReports();
    } catch (e) { setError(e.message); }
  }

  async function resetPassword(u) {
    const mdp = window.prompt(`Nouveau mot de passe pour ${u.pseudo} (6 caractères minimum) :`);
    if (!mdp) return;
    try {
      await apiFetch(`/api/admin/users/${u.id}/password`, {
        method: "POST", body: JSON.stringify({ password: mdp }),
      });
      window.alert(`Mot de passe de ${u.pseudo} réinitialisé. Ses sessions ont été fermées.`);
    } catch (e) { setError(e.message); }
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
        {[["gestion", "Gestion"], ["suivi", "Suivi"], ["signalements", "Signalements"]].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); if (id === "signalements" && !reports) loadReports(); }} style={{
            flex: 1, padding: "10px 0", borderRadius: 14, cursor: "pointer", fontWeight: 800, fontSize: 13,
            fontFamily: FONT_BODY,
            border: `1.5px solid ${tab === id ? COLORS.gold : COLORS.cardAlt}`,
            background: tab === id ? tint(COLORS.gold, 10) : "transparent",
            color: tab === id ? COLORS.gold : COLORS.text,
          }}>{label}</button>
        ))}
      </div>

      {tab === "suivi" && <Activity />}

      {tab === "signalements" && (
        <div>
          {reports === null && <p style={{ color: COLORS.muted, fontSize: 14 }}>Chargement…</p>}
          {reports && reports.reports.length === 0 && (
            <p style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>
              Aucune question signalée. Tout va bien.
            </p>
          )}
          {reports && reports.reports.map((r) => (
            <div key={r.id} style={{
              background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`,
              borderRadius: 16, padding: 14, marginBottom: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                <span style={{
                  fontFamily: FONT_BODY, fontWeight: 800, fontSize: 10.5, letterSpacing: 1,
                  textTransform: "uppercase", color: COLORS.danger,
                }}>
                  {REPORT_LABELS[r.reason] || r.reason}
                </span>
                <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>
                  #{r.question_id} · {r.pseudo || "invité"}
                </span>
              </div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, color: COLORS.text, margin: "0 0 6px" }}>
                {r.question || "(question introuvable — CSV modifié depuis ?)"}
              </p>
              {r.bonne && (
                <p style={{ fontSize: 12.5, color: COLORS.success, margin: "0 0 4px" }}>
                  Réponse enregistrée : <b>{r.bonne}</b>
                </p>
              )}
              {r.explication && (
                <p style={{ fontSize: 12, color: COLORS.muted, margin: "0 0 6px", lineHeight: 1.45 }}>
                  {r.explication}
                </p>
              )}
              {r.comment && (
                <p style={{ fontSize: 12.5, color: COLORS.text, margin: "0 0 8px", fontStyle: "italic" }}>
                  « {r.comment} »
                </p>
              )}
              <button
                onClick={() => resolveReport(r.id)}
                style={{
                  background: COLORS.soft, border: "none", borderRadius: 12, padding: "8px 14px",
                  fontFamily: FONT_BODY, fontWeight: 800, fontSize: 12.5, color: COLORS.text, cursor: "pointer",
                }}
              >
                Marquer comme traité
              </button>
            </div>
          ))}
        </div>
      )}

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
                <button onClick={() => resetPassword(u)} aria-label="Réinitialiser le mot de passe" title="Réinitialiser le mot de passe" style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", padding: 6 }}>
                  <KeyRound size={16} />
                </button>
                <button onClick={() => resetUser(u.id)} aria-label="Remettre les scores à zéro" title="Remettre les scores à zéro" style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", padding: 6 }}>
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
