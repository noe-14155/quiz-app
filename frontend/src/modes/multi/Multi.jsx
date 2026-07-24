import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, Users, Copy, Check, Crown, Trophy, Wifi } from "lucide-react";
import {
  cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, gradient, gradientText, sectionLabel, tint,
} from "../../design/theme";
import AnswerGrid from "../../components/AnswerGrid";
import Button from "../../components/Button";
import Avatar from "../../components/Avatar";
import TimerBar from "../../components/TimerBar";
import { inputStyle } from "../../components/PageTitle";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { feedbackBon, feedbackMauvais, feedbackFin, feedbackUrgence } from "../../design/feedback";

/**
 * Mode multi en temps réel.
 *
 * Le client ne reçoit JAMAIS l'ordre de passer à la question suivante : il le
 * calcule, à partir de l'horodatage de départ envoyé par le serveur. C'est la
 * même arithmétique que dans `modes/multi/service.py`, volontairement dupliquée
 * — c'est ce qui permet à l'affichage d'être fluide entre deux sondages, et à
 * un téléphone qui se réveille de retrouver sa place tout seul.
 *
 * Le décalage d'horloge est mesuré une fois à l'arrivée (`serveur_now`) : sans
 * cela, un téléphone dont l'heure avance de vingt secondes verrait la partie en
 * avance sur tout le monde.
 */

const DUREE_DECOMPTE = 3;

/** Même calcul que le serveur : où en est la partie, à cet instant précis. */
function calculer(etat, maintenant) {
  if (!etat?.started_at) return { statut: "salon", index: null, phase: null, resteMs: null };
  const debut = new Date(etat.started_at).getTime();
  const cycle = (etat.duree_question + etat.duree_reveal) * 1000;
  let ecoule = maintenant - debut;

  if (ecoule < DUREE_DECOMPTE * 1000) {
    return { statut: "decompte", index: 0, phase: "decompte", resteMs: DUREE_DECOMPTE * 1000 - ecoule };
  }
  ecoule -= DUREE_DECOMPTE * 1000;
  const index = Math.floor(ecoule / cycle);
  if (index >= etat.nb_questions) return { statut: "termine", index: etat.nb_questions, phase: "fin", resteMs: 0 };

  const resteCycle = ecoule % cycle;
  const dureeQ = etat.duree_question * 1000;
  return resteCycle < dureeQ
    ? { statut: "en_cours", index, phase: "question", resteMs: dureeQ - resteCycle }
    : { statut: "en_cours", index, phase: "reveal", resteMs: cycle - resteCycle };
}

export default function Multi({ onNavigate }) {
  const { user } = useAuth();
  const [vue, setVue] = useState("accueil");     // accueil | partie
  const [etat, setEtat] = useState(null);
  const [parties, setParties] = useState([]);
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState(null);
  const [copie, setCopie] = useState(false);
  const [nbQuestions, setNbQuestions] = useState(10);
  const [duree, setDuree] = useState(15);

  const [question, setQuestion] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [repondu, setRepondu] = useState(null);
  const [horloge, setHorloge] = useState(Date.now());

  // Décalage entre l'heure du téléphone et celle du serveur, mesuré une fois.
  const offset = useRef(0);
  const prefetch = useRef({});     // questions déjà téléchargées, par index
  const dernierePhase = useRef("");

  const local = calculer(etat, horloge + offset.current);

  /* --- Horloge locale : 200 ms suffisent pour un affichage fluide --------- */
  useEffect(() => {
    const t = setInterval(() => setHorloge(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const rafraichir = useCallback(async (code) => {
    try {
      const r = await apiFetch(`/api/multi/${code || etat?.code}`);
      offset.current = new Date(r.serveur_now).getTime() - Date.now();
      setEtat(r);
      return r;
    } catch (e) { setErreur(e.message); }
  }, [etat?.code]);

  /* --- Sondage : fréquent dans le salon, léger pendant la partie ---------- */
  useEffect(() => {
    if (vue !== "partie" || !etat?.code) return;
    // Dans le salon, on guette l'arrivée des joueurs et le départ ; pendant une
    // question, on ne rafraîchit que le compteur « x/y ont répondu ». Rien de
    // vital ne dépend de ce sondage : l'avancement, lui, est calculé en local.
    const periode = local.statut === "salon" ? 2000 : 3000;
    if (local.statut === "termine") return;
    const t = setInterval(() => rafraichir(), periode);
    return () => clearInterval(t);
  }, [vue, etat?.code, local.statut, rafraichir]);

  /* --- Réactions aux changements de phase --------------------------------- */
  useEffect(() => {
    if (vue !== "partie" || !etat?.code) return;
    const cle = `${local.statut}-${local.index}-${local.phase}`;
    if (cle === dernierePhase.current) return;
    dernierePhase.current = cle;

    if (local.phase === "question") {
      setReveal(null);
      setRepondu(null);
      charger(local.index);
      // Préchargement de la suivante pendant qu'on joue celle-ci : elle ne sera
      // servie qu'à partir de la phase de correction, mais l'appel est sans
      // risque et évite tout temps mort.
    } else if (local.phase === "reveal") {
      chargerReveal(local.index);
      charger(local.index + 1);
    } else if (local.statut === "termine") {
      rafraichir();
      feedbackFin(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vue, etat?.code, local.statut, local.index, local.phase]);

  /* --- Dernières secondes : petite vibration ------------------------------ */
  useEffect(() => {
    if (local.phase !== "question" || repondu !== null) return;
    const s = Math.ceil(local.resteMs / 1000);
    if (s === 3) feedbackUrgence();
  }, [Math.ceil((local.resteMs || 0) / 1000), local.phase, repondu]);

  async function charger(index) {
    if (index == null || index < 0) return;
    if (prefetch.current[index]) { setQuestion(prefetch.current[index]); return; }
    try {
      const r = await apiFetch(`/api/multi/${etat.code}/question/${index}`);
      prefetch.current[index] = r.question;
      if (index === local.index) setQuestion(r.question);
    } catch (e) { /* pas encore disponible : la phase suivante réessaiera */ }
  }

  async function chargerReveal(index) {
    try {
      const r = await apiFetch(`/api/multi/${etat.code}/reveal/${index}`);
      setReveal(r);
      if (repondu !== null) repondu === r.correct_index ? feedbackBon() : feedbackMauvais();
    } catch (e) { /* ignoré : le prochain tour de boucle réessaiera */ }
  }

  async function repondre(choix) {
    if (repondu !== null) return;
    setRepondu(choix);   // affichage immédiat, sans attendre le serveur
    try {
      const r = await apiFetch(`/api/multi/${etat.code}/answer`, {
        method: "POST",
        body: JSON.stringify({ question_index: local.index, choix }),
      });
      setEtat((e) => ({ ...e, nb_reponses: r.nb_reponses }));
    } catch (e) { /* hors fenêtre : le serveur tranche, on n'insiste pas */ }
  }

  async function creer() {
    setErreur(null);
    try {
      const r = await apiFetch("/api/multi/create", {
        method: "POST",
        body: JSON.stringify({ nb_questions: nbQuestions, duree_question: duree }),
      });
      offset.current = new Date(r.serveur_now).getTime() - Date.now();
      prefetch.current = {};
      setEtat(r); setVue("partie");
    } catch (e) { setErreur(e.message); }
  }

  async function rejoindre(code) {
    const c = (code || saisie).trim().toUpperCase();
    if (c.length !== 5) { setErreur("Le code fait 5 caractères."); return; }
    setErreur(null);
    try {
      const r = await apiFetch(`/api/multi/${c}/join`, { method: "POST" });
      offset.current = new Date(r.serveur_now).getTime() - Date.now();
      prefetch.current = {};
      setEtat(r); setVue("partie");
    } catch (e) {
      // Une partie déjà lancée à laquelle on participe déjà : on l'ouvre quand même.
      if (e.status === 409) { const r = await rafraichir(c); if (r?.je_participe) { setVue("partie"); return; } }
      setErreur(e.message);
    }
  }

  async function lancer() {
    try { setEtat(await apiFetch(`/api/multi/${etat.code}/start`, { method: "POST" })); }
    catch (e) { setErreur(e.message); }
  }

  useEffect(() => {
    apiFetch("/api/multi").then((r) => setParties(r.parties)).catch(() => {});
  }, [vue]);

  function copier() {
    navigator.clipboard?.writeText(etat.code).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 1800);
    }).catch(() => {});
  }

  /* ======================================================================= */

  if (!user) {
    return (
      <div style={cardWrap}>
        <Entete onRetour={() => onNavigate("jouer")} titre="Multi" />
        <p style={{ color: COLORS.muted, fontSize: 14 }}>Il faut un compte pour jouer à plusieurs.</p>
        <Button onClick={() => onNavigate("login")} style={{ marginTop: 16 }}>Se connecter</Button>
      </div>
    );
  }

  if (vue === "accueil") {
    return (
      <div style={cardWrap}>
        <Entete onRetour={() => onNavigate("jouer")} titre="Multi" />
        <p style={{ color: COLORS.muted, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 22px" }}>
          Tout le monde répond aux mêmes questions en même temps. Le plus rapide marque le plus de points.
        </p>

        <div style={sectionLabel}>Créer une partie</div>
        <Reglage titre="Questions" valeurs={[5, 10, 15]} actif={nbQuestions} onChange={setNbQuestions} />
        <Reglage titre="Secondes par question" valeurs={[10, 15, 20, 30]} actif={duree} onChange={setDuree} />
        <Button onClick={creer} style={{ marginTop: 14 }}>
          <Users size={17} /> Créer le salon
        </Button>

        <div style={sectionLabel}>Rejoindre</div>
        <div style={{ display: "flex", gap: 9 }}>
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value.toUpperCase().slice(0, 5))}
            placeholder="CODE"
            style={inputStyle({ flex: 1, textAlign: "center", letterSpacing: 4, fontSize: 20 })}
          />
          <Button onClick={() => rejoindre()} variant="secondary" style={{ width: 120 }}>Entrer</Button>
        </div>

        {erreur && <Erreur>{erreur}</Erreur>}

        {parties.length > 0 && (
          <>
            <div style={sectionLabel}>Mes parties</div>
            {parties.map((p) => (
              <button
                key={p.code}
                onClick={() => rejoindre(p.code)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                  background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`, borderRadius: 14,
                  padding: "13px 14px", marginBottom: 9, cursor: "pointer",
                }}
              >
                <span style={{
                  fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, letterSpacing: 2,
                  color: COLORS.gold, minWidth: 62,
                }}>{p.code}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>
                    {p.statut === "termine"
                      ? `${p.ma_position === 1 ? "🏆 Gagné" : `${p.ma_position}ᵉ`} · ${p.mes_points} pts`
                      : p.statut === "salon" ? "En attente" : "En cours"}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: COLORS.muted }}>
                    {p.nb_joueurs} joueur{p.nb_joueurs > 1 ? "s" : ""} · {p.nb_questions} questions
                  </span>
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    );
  }

  /* ---- Salon ------------------------------------------------------------ */
  if (local.statut === "salon") {
    return (
      <div style={cardWrap}>
        <Entete onRetour={() => { setVue("accueil"); setEtat(null); }} titre="Salon" />
        <div style={{
          textAlign: "center", padding: "26px 16px", borderRadius: 20,
          background: tint(COLORS.gold, 8), border: `1px solid ${tint(COLORS.gold, 20)}`, marginBottom: 18,
        }}>
          <div style={{ fontSize: 11.5, color: COLORS.muted, fontWeight: 700, letterSpacing: 1 }}>
            CODE DE LA PARTIE
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, letterSpacing: 8, ...gradientText(120) }}>
            {etat.code}
          </div>
          <button onClick={copier} style={{
            marginTop: 6, background: "none", border: "none", cursor: "pointer",
            color: COLORS.muted, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5,
          }}>
            {copie ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier le code</>}
          </button>
        </div>

        <div style={sectionLabel}>
          Joueurs ({etat.nb_joueurs}/{etat.max_joueurs})
        </div>
        {etat.joueurs.map((j) => (
          <div key={j.pseudo} style={{
            display: "flex", alignItems: "center", gap: 11, padding: "9px 2px",
            borderBottom: `1px solid ${COLORS.cardAlt}`,
          }}>
            <Avatar face={j.avatar_face} color={j.avatar_color} size={34} />
            <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: COLORS.text }}>{j.pseudo}</span>
            {j.pseudo === etat.hote && <Crown size={15} color={COLORS.accent3} />}
          </div>
        ))}

        <p style={{ color: COLORS.muted, fontSize: 12.5, margin: "16px 0 0", display: "flex", gap: 6 }}>
          <Wifi size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          {etat.je_suis_hote
            ? `Dicte le code à tes amis. Il faut au moins ${etat.min_joueurs} joueurs.`
            : "En attente du lancement par l'hôte…"}
        </p>

        {etat.je_suis_hote && (
          <Button onClick={lancer} disabled={etat.nb_joueurs < etat.min_joueurs} style={{ marginTop: 18 }}>
            Lancer la partie
          </Button>
        )}
        {erreur && <Erreur>{erreur}</Erreur>}
      </div>
    );
  }

  /* ---- Décompte --------------------------------------------------------- */
  if (local.statut === "decompte") {
    return (
      <div style={{ ...cardWrap, textAlign: "center", paddingTop: 90 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 96, ...gradientText(120), animation: "sqpop .4s both" }}>
          {Math.ceil(local.resteMs / 1000)}
        </div>
        <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 8 }}>Prépare-toi…</p>
      </div>
    );
  }

  /* ---- Fin de partie ----------------------------------------------------- */
  if (local.statut === "termine") {
    const classement = etat.classement || [];
    const moi = classement.find((j) => j.pseudo === user.pseudo);
    return (
      <div style={cardWrap}>
        <Entete onRetour={() => { setVue("accueil"); setEtat(null); }} titre="Résultat" />
        <div style={{ textAlign: "center", margin: "10px 0 26px" }}>
          <Trophy size={34} color={COLORS.accent3} />
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 30, ...gradientText(120), marginTop: 6 }}>
            {moi?.position === 1 ? "Victoire !" : `${moi?.position}ᵉ place`}
          </div>
          <div style={{ color: COLORS.muted, fontSize: 13.5 }}>{moi?.points} points · {moi?.bonnes} bonnes réponses</div>
        </div>
        <Classement lignes={classement} moi={user.pseudo} />
        <Button onClick={() => { setVue("accueil"); setEtat(null); }} style={{ marginTop: 20 }}>
          Nouvelle partie
        </Button>
      </div>
    );
  }

  /* ---- Correction -------------------------------------------------------- */
  if (local.phase === "reveal") {
    return (
      <div style={cardWrap}>
        <TimerBar duree={etat.duree_reveal} cle={`rev-${local.index}`} hauteur={6} style={{ marginBottom: 18 }} />
        {reveal ? (
          <>
            <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700 }}>
              Question {local.index + 1}/{etat.nb_questions}
            </div>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, margin: "6px 0 14px", color: COLORS.text }}>
              {reveal.question}
            </p>
            <div style={{
              padding: "12px 14px", borderRadius: 14, marginBottom: 6,
              background: tint(COLORS.success, 12), border: `1px solid ${tint(COLORS.success, 28)}`,
            }}>
              <div style={{ fontSize: 11.5, color: COLORS.muted, fontWeight: 700 }}>BONNE RÉPONSE</div>
              <div style={{ fontWeight: 800, fontSize: 15.5, color: COLORS.text }}>
                {reveal.choix[reveal.correct_index]}
              </div>
            </div>
            {reveal.explication && (
              <p style={{ color: COLORS.muted, fontSize: 12.5, lineHeight: 1.5, margin: "0 0 16px" }}>
                {reveal.explication}
              </p>
            )}
            <div style={sectionLabel}>Classement</div>
            <Classement lignes={reveal.classement} moi={user.pseudo} compact />
          </>
        ) : (
          <p style={{ color: COLORS.muted, fontSize: 14, textAlign: "center", padding: 30 }}>Correction…</p>
        )}
      </div>
    );
  }

  /* ---- Question ---------------------------------------------------------- */
  const secondes = Math.ceil(local.resteMs / 1000);
  return (
    <div style={cardWrap}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 42, lineHeight: 0.85, ...gradientText(120) }}>
          {String(local.index + 1).padStart(2, "0")}
        </span>
        <span style={{
          fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20,
          color: secondes <= 3 ? COLORS.danger : COLORS.muted,
        }}>
          {secondes}s
        </span>
      </div>
      <TimerBar duree={etat.duree_question} cle={`q-${local.index}`} danger={secondes <= 3}
                hauteur={9} style={{ marginBottom: 18 }} />

      {question ? (
        <>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18.5, lineHeight: 1.3, margin: "0 0 18px", color: COLORS.text }}>
            {question.question}
          </p>
          <AnswerGrid
            choix={question.choix}
            answered={repondu}
            correctIndex={null}
            revealCorrectness={false}
            onPick={repondre}
          />
          <div style={{
            textAlign: "center", fontSize: 12.5, color: COLORS.muted, fontFamily: FONT_BODY, marginTop: 4,
          }}>
            {repondu !== null
              ? `Réponse envoyée · ${etat.nb_reponses}/${etat.nb_joueurs} ont répondu`
              : `${etat.nb_reponses}/${etat.nb_joueurs} ont répondu`}
          </div>
        </>
      ) : (
        <p style={{ color: COLORS.muted, fontSize: 14, textAlign: "center", padding: 30 }}>Chargement…</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Entete({ onRetour, titre }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <button onClick={onRetour} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
        <ChevronLeft size={22} color={COLORS.muted} />
      </button>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, margin: 0, color: COLORS.text }}>
        {titre}
      </h2>
    </div>
  );
}

function Reglage({ titre, valeurs, actif, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12.5, color: COLORS.muted, fontWeight: 700, marginBottom: 7 }}>{titre}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {valeurs.map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 12, cursor: "pointer",
              fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15,
              border: `1.5px solid ${v === actif ? COLORS.gold : COLORS.cardAlt}`,
              background: v === actif ? tint(COLORS.gold, 12) : COLORS.soft,
              color: v === actif ? COLORS.gold : COLORS.muted,
            }}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function Classement({ lignes, moi, compact = false }) {
  return (
    <div>
      {lignes.map((j) => {
        const cestMoi = j.pseudo === moi;
        return (
          <div key={j.pseudo} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: compact ? "7px 10px" : "10px 12px", borderRadius: 12, marginBottom: 6,
            background: cestMoi ? tint(COLORS.gold, 10) : COLORS.card,
            border: `1px solid ${cestMoi ? tint(COLORS.gold, 24) : COLORS.cardAlt}`,
          }}>
            <span style={{
              fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14,
              color: j.position === 1 ? COLORS.accent3 : COLORS.muted, minWidth: 18,
            }}>
              {j.position}
            </span>
            <Avatar face={j.avatar_face} color={j.avatar_color} size={compact ? 26 : 30} />
            <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {j.pseudo}
            </span>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: COLORS.text }}>
              {j.points}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Erreur({ children }) {
  return (
    <p style={{
      color: COLORS.danger, fontSize: 13, marginTop: 12, padding: "10px 12px",
      background: tint(COLORS.danger, 10), borderRadius: 12,
    }}>
      {children}
    </p>
  );
}
