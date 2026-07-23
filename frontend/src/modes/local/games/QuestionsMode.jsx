import { useState } from "react";
import { cardWrap, COLORS, FONT_DISPLAY, tint } from "../../../design/theme";
import TopBar from "../../../components/TopBar";
import { inputStyle } from "../../../components/PageTitle";
import Button from "../../../components/Button";
import QuitConfirmModal from "../../../components/QuitConfirmModal";
import { Check } from "lucide-react";
import { apiFetch } from "../../../api/client";


const THEMES = [
  "Cinéma/Séries", "Géographie", "Histoire", "Pays", "Acteurs/Célébrités",
  "Anecdotes", "Sciences & Nature", "Sport", "Art & Littérature", "Gastronomie", "Technologie & Internet",
];

export default function QuestionsMode({ screen, onNavigate }) {
  const [phase, setPhase] = useState("setup");
  const [nameInput, setNameInput] = useState("");
  const [players, setPlayers] = useState([]);
  const [themes, setThemes] = useState(THEMES);
  const [diff, setDiff] = useState(3);
  const [target, setTarget] = useState(30);

  const [round, setRound] = useState(1);
  const [question, setQuestion] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [correctIds, setCorrectIds] = useState(new Set());
  const [usedIds, setUsedIds] = useState([]);
  const [error, setError] = useState(null);
  const [quitOpen, setQuitOpen] = useState(false);

  function addPlayer() {
    const name = nameInput.trim();
    if (!name) return;
    setPlayers((p) => [...p, { name, score: 0 }]);
    setNameInput("");
  }
  function removePlayer(i) { setPlayers((p) => p.filter((_, idx) => idx !== i)); }
  function toggleTheme(t) { setThemes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])); }

  function leaveToHome() {
    setQuitOpen(false);
    setPhase("setup");
    onNavigate("home");
  }

  function start() {
    if (players.length < 2 || themes.length === 0) return;
    setPlayers((p) => p.map((pl) => ({ ...pl, score: 0 })));
    setRound(1);
    setUsedIds([]);
    setQuestion(null);
    setPhase("play");
    onNavigate("questions-mode-play");
  }

  async function draw() {
    setError(null);
    try {
      const result = await apiFetch(
        `/api/local/questions-mode/question?themes=${encodeURIComponent(themes.join(","))}&difficulte_max=${diff}&exclude_ids=${usedIds.join(",")}`
      );
      if (result.question) {
        setQuestion(result.question);
        setUsedIds((ids) => [...ids, result.question.id]);
      }
      setRevealed(false);
      setCorrectIds(new Set());
    } catch (e) {
      setError(e.message);
    }
  }

  function toggleCorrect(i) {
    setCorrectIds((s) => {
      const next = new Set(s);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function validateRound() {
    const points = question.difficulte;
    const newPlayers = players.map((p, i) => (correctIds.has(i) ? { ...p, score: p.score + points } : p));
    setPlayers(newPlayers);
    const winner = newPlayers.find((p) => p.score >= target);
    if (winner) {
      setPhase("results");
      onNavigate("questions-mode-results");
      return;
    }
    setRound((r) => r + 1);
    setQuestion(null);
  }

  if (screen === "questions-mode-setup") {
    return (
      <div style={cardWrap}>
        <TopBar screen="questions-mode-setup" onNavigate={onNavigate} />
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800, margin: "0 0 4px" }}>Mode Questions</h2>
        <p style={{ color: COLORS.muted, margin: "0 0 20px", fontSize: 14 }}>Ajoute les joueurs, choisis les thèmes, la difficulté et l'objectif de points.</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()}
            placeholder="Prénom du joueur"
            style={inputStyle({ flex: 1 })} />
          <Button onClick={addPlayer} disabled={!nameInput.trim()} style={{ padding: "0 18px" }}>+</Button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {players.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", background: COLORS.card, borderRadius: 14, padding: "10px 14px" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
              <button onClick={() => removePlayer(i)} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase" }}>Thèmes</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {THEMES.map((t) => {
            const active = themes.includes(t);
            return (
              <button key={t} onClick={() => toggleTheme(t)} style={{
                padding: "8px 15px", borderRadius: 20, border: `1.5px solid ${active ? COLORS.gold : COLORS.cardAlt}`,
                background: active ? tint(COLORS.gold, 10) : COLORS.bg, color: active ? COLORS.gold : COLORS.muted, fontWeight: 800, fontSize: 13, cursor: "pointer",
              }}>{t}</button>
            );
          })}
        </div>

        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase" }}>Objectif de points</p>
        <input type="number" min={5} step={5} value={target} onChange={(e) => setTarget(Math.max(5, Number(e.target.value) || 5))}
          style={inputStyle({ marginBottom: 20 })} />

        {error && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
        <Button onClick={start} disabled={players.length < 2 || themes.length === 0}>Commencer</Button>
      </div>
    );
  }

  const scoreboard = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
      {players.map((p, i) => (
        <div key={i} style={{ background: COLORS.card, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 800, border: `1px solid ${COLORS.cardAlt}` }}>
          {p.name} <span style={{ color: COLORS.gold }}>{p.score}</span>
        </div>
      ))}
    </div>
  );

  if (screen === "questions-mode-play") {
    return (
      <div style={cardWrap}>
        {quitOpen && <QuitConfirmModal onCancel={() => setQuitOpen(false)} onConfirm={leaveToHome} />}
        <TopBar screen="questions-mode-play" onNavigate={onNavigate} onRequestQuit={() => setQuitOpen(true)} />
        <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 700 }}>Question {round}</span>
        {scoreboard}
        {!question && <Button onClick={draw}>Poser la question</Button>}
        {question && (
          <>
            <p style={{ fontSize: 15, color: COLORS.gold, fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase" }}>{question.theme}</p>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 800, margin: "0 0 18px" }}>{question.question}</h3>
            {!revealed ? (
              <Button onClick={() => setRevealed(true)}>Révéler la réponse</Button>
            ) : (
              <>
                <div style={{ background: COLORS.card, borderRadius: 18, padding: 16, marginBottom: 18 }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, color: COLORS.success }}>{question.choix[question.bonne_reponse - 1]}</p>
                  <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>{question.explication}</p>
                </div>
                <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase" }}>
                  Qui a trouvé ? (+{question.difficulte} pt chacun)
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                  {players.map((p, i) => {
                    const active = correctIds.has(i);
                    return (
                      <button key={i} onClick={() => toggleCorrect(i)} style={{
                        padding: "10px 16px", borderRadius: 20, border: `1.5px solid ${active ? COLORS.success : COLORS.cardAlt}`,
                        background: active ? tint(COLORS.success, 12) : COLORS.bg, color: active ? COLORS.success : COLORS.muted,
                        fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                      }}>
                        {active && <Check size={14} />}{p.name}
                      </button>
                    );
                  })}
                </div>
                <Button onClick={validateRound}>Question suivante</Button>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div style={cardWrap}>
      <TopBar screen="questions-mode-results" onNavigate={onNavigate} />
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800, margin: "0 0 18px" }}>Résultats</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {sorted.map((p, i) => (
          <div key={p.name} style={{ display: "flex", justifyContent: "space-between", background: i === 0 ? tint(COLORS.gold, 10) : COLORS.card, border: `1px solid ${i === 0 ? COLORS.gold : COLORS.cardAlt}`, borderRadius: 14, padding: "11px 16px" }}>
            <span style={{ fontWeight: 700 }}>{i + 1}. {p.name}</span>
            <span style={{ fontWeight: 700, color: COLORS.muted }}>{p.score} pts</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="secondary" onClick={() => onNavigate("home")} style={{ flex: 1 }}>Accueil</Button>
        <Button onClick={() => onNavigate("questions-mode-setup")} style={{ flex: 1 }}>Rejouer</Button>
      </div>
    </div>
  );
}
