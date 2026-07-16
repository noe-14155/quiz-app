import { useState } from "react";
import { Users } from "lucide-react";
import { cardWrap, COLORS, FONT_DISPLAY } from "../../../design/theme";
import TopBar from "../../../components/TopBar";
import Button from "../../../components/Button";
import AnswerGrid from "../../../components/AnswerGrid";
import { apiFetch } from "../../../api/client";

const THEMES = [
  "Cinéma/Séries", "Géographie", "Histoire", "Pays", "Acteurs/Célébrités",
  "Anecdotes", "Sciences & Nature", "Sport", "Art & Littérature", "Gastronomie", "Technologie & Internet",
];

function randomTheme() {
  return THEMES[Math.floor(Math.random() * THEMES.length)];
}

export default function Mise({ screen, onNavigate }) {
  const [phase, setPhase] = useState("setup"); // setup | bidding | question | results
  const [nameInput, setNameInput] = useState("");
  const [players, setPlayers] = useState([]);
  const [target, setTarget] = useState(50);

  const [round, setRound] = useState(1);
  const [startIndex, setStartIndex] = useState(0);
  const [theme, setTheme] = useState(null);
  const [bids, setBids] = useState({});
  const [bidOrder, setBidOrder] = useState([]);
  const [bidStep, setBidStep] = useState(0);
  const [questionStep, setQuestionStep] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answered, setAnswered] = useState(null);
  const [usedIds, setUsedIds] = useState([]);
  const [error, setError] = useState(null);

  function addPlayer() {
    const name = nameInput.trim();
    if (!name) return;
    setPlayers((p) => [...p, { name, score: 0 }]);
    setNameInput("");
  }
  function removePlayer(i) {
    setPlayers((p) => p.filter((_, idx) => idx !== i));
  }

  function beginRound(sIndex, nbPlayers) {
    const order = Array.from({ length: nbPlayers }, (_, i) => (sIndex + i) % nbPlayers);
    setTheme(randomTheme());
    setBids({});
    setBidOrder(order);
    setBidStep(0);
    setQuestionStep(0);
    setCurrentQuestion(null);
    setAnswered(null);
    setPhase("bidding");
  }

  function start() {
    if (players.length < 2) return;
    setPlayers((p) => p.map((pl) => ({ ...pl, score: 0 })));
    setRound(1);
    setStartIndex(0);
    setUsedIds([]);
    beginRound(0, players.length);
    onNavigate("mise-play");
  }

  async function submitBid(value) {
    const bidderIndex = bidOrder[bidStep];
    const newBids = { ...bids, [bidderIndex]: value };
    setBids(newBids);
    if (bidStep + 1 >= bidOrder.length) {
      setPhase("question");
      await drawQuestionFor(0, newBids);
    } else {
      setBidStep((s) => s + 1);
    }
  }

  async function drawQuestionFor(step, bidsObj) {
    const playerIndex = bidOrder[step];
    const bid = bidsObj[playerIndex];
    try {
      const result = await apiFetch(
        `/api/local/mise/question?theme=${encodeURIComponent(theme)}&bid=${bid}&exclude_ids=${usedIds.join(",")}`
      );
      if (result.question) {
        setCurrentQuestion(result.question);
        setUsedIds((ids) => [...ids, result.question.id]);
      } else {
        setCurrentQuestion(null);
      }
      setAnswered(null);
    } catch (e) {
      setError(e.message);
    }
  }

  function pick(choiceIdx) {
    if (answered !== null || !currentQuestion) return;
    setAnswered(choiceIdx);
    const playerIndex = bidOrder[questionStep];
    const bid = bids[playerIndex];
    const correct = choiceIdx === currentQuestion.bonne_reponse - 1;
    if (correct) {
      setPlayers((players) => players.map((p, i) => (i === playerIndex ? { ...p, score: p.score + bid } : p)));
    }
  }

  async function nextStep() {
    const step = questionStep + 1;
    if (step >= bidOrder.length) {
      const winner = players.find((p) => p.score >= target);
      if (winner) {
        setPhase("results");
        onNavigate("mise-results");
        return;
      }
      const newStart = (startIndex + 1) % players.length;
      setStartIndex(newStart);
      setRound((r) => r + 1);
      beginRound(newStart, players.length);
    } else {
      setQuestionStep(step);
      await drawQuestionFor(step, bids);
    }
  }

  if (phase === "setup" || screen === "mise-setup") {
    return (
      <div style={cardWrap}>
        <TopBar screen="mise-setup" onNavigate={onNavigate} />
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Tu te mets combien ?</h2>
        <p style={{ color: COLORS.muted, margin: "0 0 20px", fontSize: 14 }}>
          Thème tiré au sort chaque manche. Mise 1 à 10 (valeur déjà prise interdite) : ta mise détermine la difficulté et les points gagnés.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()}
            placeholder="Prénom du joueur"
            style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: `2px solid ${COLORS.cardAlt}`, background: COLORS.card, fontSize: 15 }} />
          <Button onClick={addPlayer} disabled={!nameInput.trim()} style={{ padding: "0 18px" }}>+</Button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {players.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", background: COLORS.card, borderRadius: 12, padding: "10px 14px" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
              <button onClick={() => removePlayer(i)} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase" }}>Objectif de points</p>
        <input type="number" min={10} step={5} value={target} onChange={(e) => setTarget(Math.max(10, Number(e.target.value) || 10))}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, marginBottom: 20, border: `2px solid ${COLORS.cardAlt}`, background: COLORS.card, fontSize: 15 }} />
        <Button onClick={start} disabled={players.length < 2} style={{ width: "100%" }}>Commencer</Button>
      </div>
    );
  }

  const scoreboard = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
      {players.map((p, i) => (
        <div key={i} style={{ background: COLORS.card, borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700 }}>
          {p.name} <span style={{ color: COLORS.gold }}>{p.score}</span>
        </div>
      ))}
    </div>
  );

  if (phase === "bidding") {
    const bidderIndex = bidOrder[bidStep];
    const bidder = players[bidderIndex];
    const taken = new Set(Object.values(bids));
    return (
      <div style={cardWrap}>
        <TopBar screen="mise-play" onNavigate={onNavigate} />
        <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 700 }}>Manche {round} · Objectif {target} pts</span>
        {scoreboard}
        <p style={{ fontSize: 15, color: COLORS.gold, fontWeight: 700, margin: "12px 0 4px", textTransform: "uppercase" }}>{theme}</p>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 700, margin: "0 0 16px" }}>{bidder.name}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const isTaken = taken.has(n);
            return (
              <button key={n} onClick={() => !isTaken && submitBid(n)} disabled={isTaken}
                style={{ padding: "12px 0", borderRadius: 10, border: `2px solid ${COLORS.cardAlt}`,
                  background: isTaken ? COLORS.bg : COLORS.card, opacity: isTaken ? 0.4 : 1, fontWeight: 700, cursor: isTaken ? "not-allowed" : "pointer" }}>
                {n}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (phase === "question") {
    const playerIndex = bidOrder[questionStep];
    const player = players[playerIndex];
    const bid = bids[playerIndex];
    if (!currentQuestion) return <div style={cardWrap}><TopBar screen="mise-play" onNavigate={onNavigate} /><p>Chargement...</p></div>;
    return (
      <div style={cardWrap}>
        <TopBar screen="mise-play" onNavigate={onNavigate} />
        {scoreboard}
        <p style={{ fontSize: 15, color: COLORS.gold, fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase" }}>{currentQuestion.theme}</p>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 16px" }}>{player.name}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.card, borderRadius: 14, padding: "14px 16px", marginBottom: 18 }}>
          <Users size={18} color={COLORS.gold} />
          <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>Misé à {bid} points</p>
        </div>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, margin: "0 0 18px" }}>{currentQuestion.question}</h3>
        <AnswerGrid choix={currentQuestion.choix} answered={answered} correctIndex={answered !== null ? currentQuestion.bonne_reponse - 1 : null} onPick={pick} />
        {answered !== null && (
          <>
            <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 18 }}>
              <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>{currentQuestion.explication}</p>
              <p style={{ margin: "8px 0 0", fontWeight: 700, color: answered === currentQuestion.bonne_reponse - 1 ? COLORS.success : COLORS.danger }}>
                {answered === currentQuestion.bonne_reponse - 1 ? `+${bid} points pour ${player.name}` : "Pas de points cette fois"}
              </p>
            </div>
            <Button onClick={nextStep} style={{ width: "100%" }}>
              {questionStep + 1 >= bidOrder.length ? "Manche suivante" : "Joueur suivant"}
            </Button>
          </>
        )}
      </div>
    );
  }

  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div style={cardWrap}>
      <TopBar screen="mise-results" onNavigate={onNavigate} />
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 18px" }}>Résultats</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {sorted.map((p, i) => (
          <div key={p.name} style={{ display: "flex", justifyContent: "space-between", background: i === 0 ? "rgba(59,130,246,0.12)" : COLORS.card, border: i === 0 ? `2px solid ${COLORS.gold}` : "2px solid transparent", borderRadius: 12, padding: "10px 16px" }}>
            <span style={{ fontWeight: 700 }}>{i + 1}. {p.name}</span>
            <span style={{ fontWeight: 700, color: COLORS.muted }}>{p.score} pts</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="secondary" onClick={() => onNavigate("home")} style={{ flex: 1 }}>Accueil</Button>
        <Button onClick={() => setPhase("setup")} style={{ flex: 1 }}>Rejouer</Button>
      </div>
    </div>
  );
}
