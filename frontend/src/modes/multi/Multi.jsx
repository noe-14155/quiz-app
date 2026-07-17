import { useState, useEffect, useRef } from "react";
import { Copy, Star, Clock, Trophy, Check, X as XIcon, Minus } from "lucide-react";
import { cardWrap, COLORS, FONT_DISPLAY } from "../../design/theme";
import TopBar from "../../components/TopBar";
import Button from "../../components/Button";
import AnswerGrid from "../../components/AnswerGrid";
import QuitConfirmModal from "../../components/QuitConfirmModal";
import SearchLink from "../../components/SearchLink";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const THEMES = [
  "Cinéma/Séries", "Géographie", "Histoire", "Pays", "Acteurs/Célébrités",
  "Anecdotes", "Sciences & Nature", "Sport", "Art & Littérature", "Gastronomie", "Technologie & Internet",
];
const POLL_MS = 2000;
// Doivent rester alignées sur backend/app/modes/multi/sync.py
const TIME_PER_QUESTION = 15;
const REVEAL_SECONDS = 5;

export default function Multi({ screen, onNavigate }) {
  const { user } = useAuth();
  const [name, setName] = useState(user ? user.pseudo : "");
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [room, setRoom] = useState(null);
  const [state, setState] = useState(null); // résultat de /state pendant la partie
  const [error, setError] = useState(null);
  const [quitOpen, setQuitOpen] = useState(false);
  // Horloge locale : le sondage serveur est à 2s, bien trop lent pour une
  // barre de temps fluide. On tick chaque seconde en local et on se cale sur
  // question_started_at renvoyé par le serveur (qui reste la référence).
  const [now, setNow] = useState(() => Date.now());
  const pollRef = useRef(null);

  useEffect(() => {
    if (screen !== "multi-play") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [screen]);

  useEffect(() => {
    if (user) setName(user.pseudo);
  }, [user]);

  // ---------- lobby polling ----------
  useEffect(() => {
    if (screen !== "multi-lobby" || !code) return;
    async function poll() {
      try {
        const r = await apiFetch(`/api/multi/${code}`);
        setRoom(r);
        if (r.status === "playing") onNavigate("multi-play");
      } catch (e) { /* ignore ponctuel */ }
    }
    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, code]);

  // ---------- play polling ----------
  useEffect(() => {
    if (screen !== "multi-play" || !code) return;
    async function poll() {
      try {
        const r = await apiFetch(`/api/multi/${code}/state`);
        setState(r);
        if (r.room.status === "finished") onNavigate("multi-results");
      } catch (e) { /* ignore ponctuel */ }
    }
    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, code]);

  async function createRoom() {
    setError(null);
    try {
      const r = await apiFetch("/api/multi/create", { method: "POST", body: JSON.stringify({ host_name: name }) });
      setCode(r.code);
      setIsHost(true);
      const roomData = await apiFetch(`/api/multi/${r.code}`);
      setRoom(roomData);
      onNavigate("multi-lobby");
    } catch (e) { setError(e.message); }
  }

  async function joinRoom() {
    setError(null);
    const c = codeInput.trim().toUpperCase();
    try {
      await apiFetch(`/api/multi/${c}/join`, { method: "POST", body: JSON.stringify({ player_name: name }) });
      const roomData = await apiFetch(`/api/multi/${c}`);
      setCode(c);
      setIsHost(false);
      setRoom(roomData);
      onNavigate("multi-lobby");
    } catch (e) { setError(e.message); }
  }

  async function updateOptions(patch) {
    const updated = { ...room, ...patch };
    setRoom(updated);
    try {
      await apiFetch(`/api/multi/${code}/options`, { method: "PATCH", body: JSON.stringify(patch) });
    } catch (e) { /* re-sync au prochain poll */ }
  }

  function toggleTheme(t) {
    const themes = room.themes.includes(t) ? room.themes.filter((x) => x !== t) : [...room.themes, t];
    updateOptions({ themes });
  }

  async function startGame() {
    setError(null);
    try {
      await apiFetch(`/api/multi/${code}/start`, { method: "POST" });
    } catch (e) { setError(e.message); }
  }

  async function submitAnswer(choiceIdx) {
    if (!state?.current_question) return;
    try {
      await apiFetch(`/api/multi/${code}/answer?question_index=${state.room.current_index}`, {
        method: "POST",
        body: JSON.stringify({ player_name: name, choice: choiceIdx }),
      });
      const r = await apiFetch(`/api/multi/${code}/state`);
      setState(r);
    } catch (e) { setError(e.message); }
  }

  function leaveRoom() {
    clearInterval(pollRef.current);
    setQuitOpen(false);
    setCode(null);
    setRoom(null);
    setState(null);
    setIsHost(false);
    onNavigate("home");
  }

  // ---------- CHOICE ----------
  if (screen === "multi-choice") {
    return (
      <div style={cardWrap}>
        <TopBar screen="multi-choice" onNavigate={onNavigate} />
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Mode Multi</h2>
        <p style={{ color: COLORS.muted, margin: "0 0 20px", fontSize: 14 }}>Héberge une partie ou rejoins-en une avec un code.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 18 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, margin: "0 0 4px" }}>Héberger une partie</p>
            <Button onClick={() => { setError(null); onNavigate("multi-host-setup"); }}>Héberger</Button>
          </div>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 18 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, margin: "0 0 4px" }}>Rejoindre une partie</p>
            <Button onClick={() => { setError(null); onNavigate("multi-join-setup"); }}>Rejoindre</Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- HOST SETUP ----------
  if (screen === "multi-host-setup") {
    return (
      <div style={cardWrap}>
        <TopBar screen="multi-host-setup" onNavigate={onNavigate} />
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 20px" }}>Héberger une partie</h2>
        {user ? (
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 16px" }}>Connecté en tant que <b>{user.pseudo}</b></p>
        ) : (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton pseudo"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, marginBottom: 16, border: `2px solid ${COLORS.cardAlt}`, background: COLORS.card, color: COLORS.text, fontSize: 15 }} />
        )}
        {error && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 16px" }}>{error}</p>}
        <Button onClick={createRoom} disabled={!name.trim()} style={{ width: "100%" }}>Créer la partie</Button>
      </div>
    );
  }

  // ---------- JOIN SETUP ----------
  if (screen === "multi-join-setup") {
    return (
      <div style={cardWrap}>
        <TopBar screen="multi-join-setup" onNavigate={onNavigate} />
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 20px" }}>Rejoindre une partie</h2>
        <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder="Code (ex: HGFDO)"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, marginBottom: 12, border: `2px solid ${COLORS.cardAlt}`, background: COLORS.card, color: COLORS.text, fontSize: 15, letterSpacing: 2, textTransform: "uppercase" }} />
        {user ? (
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 16px" }}>Connecté en tant que <b>{user.pseudo}</b></p>
        ) : (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton pseudo"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, marginBottom: 16, border: `2px solid ${COLORS.cardAlt}`, background: COLORS.card, color: COLORS.text, fontSize: 15 }} />
        )}
        {error && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 16px" }}>{error}</p>}
        <Button onClick={joinRoom} disabled={!codeInput.trim() || !name.trim()} style={{ width: "100%" }}>Rejoindre</Button>
      </div>
    );
  }

  // ---------- LOBBY ----------
  if (screen === "multi-lobby" && room) {
    return (
      <div style={cardWrap}>
        {quitOpen && <QuitConfirmModal onCancel={() => setQuitOpen(false)} onConfirm={leaveRoom} />}
        <TopBar screen="multi-lobby" onNavigate={onNavigate} onRequestQuit={() => setQuitOpen(true)} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.muted }}>Code de la partie</p>
            <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 700, letterSpacing: 4 }}>{code}</p>
          </div>
          <button onClick={() => navigator.clipboard?.writeText(code)} style={{ background: COLORS.card, border: `2px solid ${COLORS.cardAlt}`, borderRadius: 12, padding: 10, cursor: "pointer" }}>
            <Copy size={18} color={COLORS.gold} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase" }}>Joueurs ({room.players.length})</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          {room.players.map((p, i) => (
            <div key={i} style={{ background: COLORS.card, borderRadius: 999, padding: "8px 14px", fontSize: 13, fontWeight: 700 }}>
              {p}{p === room.host_name ? " (hôte)" : ""}
            </div>
          ))}
        </div>

        {isHost ? (
          <>
            <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase" }}>Thèmes</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              {THEMES.map((t) => {
                const active = room.themes.includes(t);
                return (
                  <button key={t} onClick={() => toggleTheme(t)} style={{
                    padding: "8px 16px", borderRadius: 999, border: active ? `2px solid ${COLORS.gold}` : `2px solid ${COLORS.cardAlt}`,
                    background: active ? "rgba(59,130,246,0.12)" : COLORS.card, color: active ? COLORS.gold : COLORS.text, fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}>{t}</button>
                );
              })}
            </div>
            <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase" }}>Difficulté</p>
            <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => updateOptions({ difficulte: n })} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <Star size={26} color={COLORS.gold} fill={n <= room.difficulte ? COLORS.gold : "none"} />
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px" }}>Questions : <b>{room.nb_questions}</b></p>
            <input type="range" min={3} max={15} value={room.nb_questions} onChange={(e) => updateOptions({ nb_questions: Number(e.target.value) })}
              style={{ width: "100%", accentColor: COLORS.gold, marginBottom: 22 }} />
            {error && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
            <Button onClick={startGame} disabled={room.players.length < 2} style={{ width: "100%" }}>Lancer la partie</Button>
          </>
        ) : (
          <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 20 }}>
            <p style={{ margin: "0 0 6px", fontSize: 13, color: COLORS.muted }}>Thèmes : {room.themes.join(", ")}</p>
            <p style={{ margin: "0 0 6px", fontSize: 13, color: COLORS.muted }}>Difficulté max : {room.difficulte} ★</p>
            <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>Questions : {room.nb_questions}</p>
          </div>
        )}
      </div>
    );
  }

  // ---------- PLAY ----------
  if (screen === "multi-play" && state) {
    const q = state.current_question;
    const myAnswer = state.answers[name]?.choice ?? null;
    const isReveal = state.room.phase === "reveal";

    const startedAt = state.room.question_started_at ? Date.parse(state.room.question_started_at) : null;
    const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
    const timeLeft = Math.max(0, Math.ceil(TIME_PER_QUESTION - elapsed));
    const timePct = Math.max(0, Math.min(100, ((TIME_PER_QUESTION - elapsed) / TIME_PER_QUESTION) * 100));

    // Qui a trouvé : pendant la révélation, la bonne réponse est connue, donc
    // on peut distinguer trouvé / raté / pas répondu plutôt qu'un simple
    // "a répondu" qui ne disait rien du résultat.
    const correctIdx = q && q.bonne_reponse ? q.bonne_reponse - 1 : null;
    function playerOutcome(p) {
      const a = state.answers[p];
      if (!a) return "none";
      if (correctIdx === null) return "answered";
      return a.choice === correctIdx ? "correct" : "wrong";
    }

    if (!isReveal) {
      return (
        <div style={cardWrap}>
          {quitOpen && <QuitConfirmModal onCancel={() => setQuitOpen(false)} onConfirm={leaveRoom} />}
          <TopBar screen="multi-play" onNavigate={onNavigate} onRequestQuit={() => setQuitOpen(true)} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 700 }}>Question {state.room.current_index + 1} / {JSON.parse(state.room.question_ids || "[]").length || "?"}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: timeLeft <= 5 ? COLORS.danger : COLORS.muted }}>
              <Clock size={14} /><span style={{ fontSize: 13, fontWeight: 700 }}>{timeLeft}s</span>
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: COLORS.cardAlt, marginBottom: 16, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${timePct}%`, background: timeLeft <= 5 ? COLORS.danger : COLORS.gold, transition: "width 0.25s linear" }} />
          </div>
          {q && (
            <>
              <p style={{ fontSize: 12, color: COLORS.gold, fontWeight: 700, margin: "16px 0 8px", textTransform: "uppercase" }}>{q.theme}</p>
              <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, margin: "0 0 20px" }}>{q.question}</h3>
              <AnswerGrid choix={q.choix} answered={myAnswer} onPick={submitAnswer} revealCorrectness={false} />
            </>
          )}
          {error && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "18px 0 10px", textTransform: "uppercase" }}>
            Qui a répondu ({state.room.players.filter((p) => state.answers[p]).length}/{state.room.players.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {state.room.players.map((p) => {
              const done = !!state.answers[p];
              return (
                <div key={p} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: COLORS.card, borderRadius: 12, padding: "8px 14px",
                  border: `2px solid ${done ? COLORS.success : "transparent"}`,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{p}{p === name ? " (toi)" : ""}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: done ? COLORS.success : COLORS.muted }}>
                    {done ? <><Check size={14} /> A répondu</> : <><Minus size={14} /> En attente…</>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // reveal phase
    return (
      <div style={cardWrap}>
        <TopBar screen="multi-play" onNavigate={onNavigate} onRequestQuit={() => setQuitOpen(true)} />
        {q && (
          <>
            <p style={{ fontSize: 12, color: COLORS.gold, fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase" }}>{q.theme}</p>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, margin: "0 0 16px" }}>{q.question}</h3>
            <AnswerGrid choix={q.choix} answered={myAnswer ?? -1} correctIndex={q.bonne_reponse ? q.bonne_reponse - 1 : null} onPick={() => {}} />
            <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, margin: "8px 0 18px" }}>
              {q.explication && <p style={{ margin: "0 0 12px", fontSize: 14, color: COLORS.muted }}>{q.explication}</p>}
              <SearchLink question={q.question} reponse={correctIdx !== null ? q.choix[correctIdx] : ""} />
            </div>
          </>
        )}
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase" }}>Résultat de la manche</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
          {[...state.room.players].sort((a, b) => (state.scores[b] || 0) - (state.scores[a] || 0)).map((p) => {
            const outcome = playerOutcome(p);
            const color = outcome === "correct" ? COLORS.success : outcome === "wrong" ? COLORS.danger : COLORS.muted;
            const label = outcome === "correct" ? "Trouvé" : outcome === "wrong" ? "Raté" : "Pas répondu";
            const Icon = outcome === "correct" ? Check : outcome === "wrong" ? XIcon : Minus;
            return (
              <div key={p} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: COLORS.card, borderRadius: 12, padding: "9px 14px",
                borderLeft: `4px solid ${color}`,
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 }}>
                  <Icon size={15} color={color} />
                  {p}{p === name ? " (toi)" : ""}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
                  <span style={{ fontWeight: 700, color: COLORS.gold, fontSize: 13, minWidth: 46, textAlign: "right" }}>{state.scores[p] || 0} pts</span>
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: "center" }}>
          <Trophy size={24} color={COLORS.gold} style={{ marginBottom: 4 }} />
          <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>Prochaine question dans quelques secondes…</p>
        </div>
      </div>
    );
  }

  // ---------- RESULTS ----------
  if (screen === "multi-results" && state) {
    const sorted = [...state.room.players].sort((a, b) => (state.scores[b] || 0) - (state.scores[a] || 0));
    return (
      <div style={cardWrap}>
        <TopBar screen="multi-results" onNavigate={onNavigate} />
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 18px" }}>Résultats de la partie</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {sorted.map((p, i) => (
            <div key={p} style={{ display: "flex", justifyContent: "space-between", background: i === 0 ? "rgba(59,130,246,0.12)" : COLORS.card, border: i === 0 ? `2px solid ${COLORS.gold}` : "2px solid transparent", borderRadius: 12, padding: "10px 16px" }}>
              <span style={{ fontWeight: 700 }}>{i + 1}. {p}</span>
              <span style={{ fontWeight: 700, color: COLORS.muted }}>{state.scores[p] || 0} pts</span>
            </div>
          ))}
        </div>
        <Button variant="secondary" onClick={leaveRoom} style={{ width: "100%" }}>Accueil</Button>
      </div>
    );
  }

  // Cas transitoire (ex: venant de rejoindre mais room pas encore chargée) :
  // on retombe sur l'écran de choix plutôt que d'afficher une page blanche.
  return (
    <div style={cardWrap}>
      <TopBar screen="multi-choice" onNavigate={onNavigate} />
      <p style={{ color: COLORS.muted, fontSize: 14 }}>Chargement...</p>
    </div>
  );
}
