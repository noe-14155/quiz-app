import { useState, useEffect, useRef } from "react";
import { Copy, Star, Clock, Trophy } from "lucide-react";
import { cardWrap, COLORS, FONT_DISPLAY } from "../../design/theme";
import TopBar from "../../components/TopBar";
import Button from "../../components/Button";
import AnswerGrid from "../../components/AnswerGrid";
import QuitConfirmModal from "../../components/QuitConfirmModal";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const THEMES = [
  "Cinéma/Séries", "Géographie", "Histoire", "Pays", "Acteurs/Célébrités",
  "Anecdotes", "Sciences & Nature", "Sport", "Art & Littérature", "Gastronomie", "Technologie & Internet",
];
const POLL_MS = 2000;

export default function Multi({ screen, onNavigate }) {
  const { user } = useAuth();
  const [step, setStep] = useState("choice"); // choice | host-setup | join-setup | lobby | play | results
  const [name, setName] = useState(user ? user.pseudo : "");
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [room, setRoom] = useState(null);
  const [state, setState] = useState(null); // résultat de /state pendant "play"
  const [error, setError] = useState(null);
  const [quitOpen, setQuitOpen] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (user) setName(user.pseudo);
  }, [user]);

  // Le bouton "Retour" de TopBar met à jour le "screen" du parent sans
  // toucher à l'état interne "step" — cette synchronisation évite de rester
  // bloqué sur l'écran héberger/rejoindre après un clic sur "Retour".
  useEffect(() => {
    if (screen === "multi-choice") setStep("choice");
  }, [screen]);

  // ---------- lobby polling ----------
  useEffect(() => {
    if (step !== "lobby" || !code) return;
    async function poll() {
      try {
        const r = await apiFetch(`/api/multi/${code}`);
        setRoom(r);
        if (r.status === "playing") {
          setStep("play");
          onNavigate("multi-play");
        }
      } catch (e) { /* ignore ponctuel */ }
    }
    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, code]);

  // ---------- play polling ----------
  useEffect(() => {
    if (step !== "play" || !code) return;
    async function poll() {
      try {
        const r = await apiFetch(`/api/multi/${code}/state`);
        setState(r);
        if (r.room.status === "finished") {
          setStep("results");
          onNavigate("multi-results");
        }
      } catch (e) { /* ignore ponctuel */ }
    }
    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, code]);

  async function createRoom() {
    setError(null);
    try {
      const r = await apiFetch("/api/multi/create", { method: "POST", body: JSON.stringify({ host_name: name }) });
      setCode(r.code);
      setIsHost(true);
      const roomData = await apiFetch(`/api/multi/${r.code}`);
      setRoom(roomData);
      setStep("lobby");
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
      setStep("lobby");
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
    setStep("choice");
    onNavigate("home");
  }

  // ---------- CHOICE ----------
  if (step === "choice") {
    return (
      <div style={cardWrap}>
        <TopBar screen="multi-choice" onNavigate={onNavigate} />
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Mode Multi</h2>
        <p style={{ color: COLORS.muted, margin: "0 0 20px", fontSize: 14 }}>Héberge une partie ou rejoins-en une avec un code.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 18 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, margin: "0 0 4px" }}>Héberger une partie</p>
            <Button onClick={() => { setStep("host-setup"); setError(null); }}>Héberger</Button>
          </div>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 18 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, margin: "0 0 4px" }}>Rejoindre une partie</p>
            <Button onClick={() => { setStep("join-setup"); setError(null); }}>Rejoindre</Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- HOST SETUP ----------
  if (step === "host-setup") {
    return (
      <div style={cardWrap}>
        <TopBar screen="multi-host-setup" onNavigate={onNavigate} />
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 20px" }}>Héberger une partie</h2>
        {user ? (
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 16px" }}>Connecté en tant que <b>{user.pseudo}</b></p>
        ) : (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton pseudo"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, marginBottom: 16, border: `2px solid ${COLORS.cardAlt}`, background: COLORS.card, fontSize: 15 }} />
        )}
        {error && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 16px" }}>{error}</p>}
        <Button onClick={createRoom} disabled={!name.trim()} style={{ width: "100%" }}>Créer la partie</Button>
      </div>
    );
  }

  // ---------- JOIN SETUP ----------
  if (step === "join-setup") {
    return (
      <div style={cardWrap}>
        <TopBar screen="multi-join-setup" onNavigate={onNavigate} />
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 20px" }}>Rejoindre une partie</h2>
        <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder="Code (ex: HGFDO)"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, marginBottom: 12, border: `2px solid ${COLORS.cardAlt}`, background: COLORS.card, fontSize: 15, letterSpacing: 2, textTransform: "uppercase" }} />
        {user ? (
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 16px" }}>Connecté en tant que <b>{user.pseudo}</b></p>
        ) : (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton pseudo"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, marginBottom: 16, border: `2px solid ${COLORS.cardAlt}`, background: COLORS.card, fontSize: 15 }} />
        )}
        {error && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 16px" }}>{error}</p>}
        <Button onClick={joinRoom} disabled={!codeInput.trim() || !name.trim()} style={{ width: "100%" }}>Rejoindre</Button>
      </div>
    );
  }

  // ---------- LOBBY ----------
  if (step === "lobby" && room) {
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
  if (step === "play" && state) {
    const q = state.current_question;
    const myAnswer = state.answers[name]?.choice ?? null;
    const isReveal = state.room.phase === "reveal";

    if (!isReveal) {
      return (
        <div style={cardWrap}>
          {quitOpen && <QuitConfirmModal onCancel={() => setQuitOpen(false)} onConfirm={leaveRoom} />}
          <TopBar screen="multi-play" onNavigate={onNavigate} onRequestQuit={() => setQuitOpen(true)} />
          <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 700 }}>Question {state.room.current_index + 1} / {JSON.parse(state.room.question_ids || "[]").length || "?"}</span>
          {q && (
            <>
              <p style={{ fontSize: 12, color: COLORS.gold, fontWeight: 700, margin: "16px 0 8px", textTransform: "uppercase" }}>{q.theme}</p>
              <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, margin: "0 0 20px" }}>{q.question}</h3>
              <AnswerGrid choix={q.choix} answered={myAnswer} onPick={submitAnswer} revealCorrectness={false} />
            </>
          )}
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "18px 0 10px", textTransform: "uppercase" }}>Qui a répondu</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {state.room.players.map((p) => (
              <div key={p} style={{ display: "flex", justifyContent: "space-between", background: COLORS.card, borderRadius: 12, padding: "8px 14px" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{p}</span>
                <span style={{ fontSize: 12, color: state.answers[p] ? COLORS.success : COLORS.muted }}>{state.answers[p] ? "A répondu" : "En attente…"}</span>
              </div>
            ))}
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
            {q.explication && (
              <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, margin: "8px 0 18px" }}>
                <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>{q.explication}</p>
              </div>
            )}
          </>
        )}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <Trophy size={28} color={COLORS.gold} style={{ marginBottom: 6 }} />
          <p style={{ fontSize: 13, color: COLORS.muted }}>Prochaine question dans quelques secondes…</p>
        </div>
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase" }}>Score total</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...state.room.players].sort((a, b) => (state.scores[b] || 0) - (state.scores[a] || 0)).map((p) => (
            <div key={p} style={{ display: "flex", justifyContent: "space-between", background: COLORS.card, borderRadius: 12, padding: "8px 14px" }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{p}</span>
              <span style={{ fontWeight: 700, color: COLORS.gold, fontSize: 13 }}>{state.scores[p] || 0} pts</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------- RESULTS ----------
  if (step === "results" && state) {
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

  return null;
}
