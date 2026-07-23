/**
 * Retours tactiles et sonores.
 *
 * Deux règles ont guidé l'implémentation :
 *  - tout est optionnel et mémorisé (certains détestent les vibrations) ;
 *  - rien ne doit jamais lever d'erreur : ces API sont inégalement supportées
 *    selon les navigateurs, et un quiz ne doit pas planter pour un son.
 *
 * Les sons sont synthétisés à la volée (Web Audio) plutôt que chargés depuis
 * des fichiers : aucun téléchargement, aucun décalage au premier déclenchement.
 */
const CLE = "quiz_feedback";

function lire() {
  try {
    const v = JSON.parse(localStorage.getItem(CLE));
    return { vibration: v?.vibration !== false, son: v?.son === true };
  } catch (e) {
    return { vibration: true, son: false };
  }
}

export let FEEDBACK = lire();

export function setFeedback(patch) {
  FEEDBACK = { ...FEEDBACK, ...patch };
  try { localStorage.setItem(CLE, JSON.stringify(FEEDBACK)); } catch (e) { /* mode privé */ }
}

function vibrer(motif) {
  if (!FEEDBACK.vibration) return;
  try { navigator.vibrate?.(motif); } catch (e) { /* non supporté */ }
}

let ctx = null;
function bip(frequences, duree = 0.09, volume = 0.06) {
  if (!FEEDBACK.son) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    // Les navigateurs suspendent le contexte tant qu'aucune interaction n'a eu
    // lieu ; on le relance à la première utilisation.
    if (ctx.state === "suspended") ctx.resume();
    frequences.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      const debut = ctx.currentTime + i * duree * 0.8;
      gain.gain.setValueAtTime(volume, debut);
      gain.gain.exponentialRampToValueAtTime(0.001, debut + duree);
      osc.connect(gain).connect(ctx.destination);
      osc.start(debut);
      osc.stop(debut + duree);
    });
  } catch (e) { /* jamais bloquant */ }
}

/** Bonne réponse : vibration courte, deux notes montantes. */
export function feedbackBon() {
  vibrer(35);
  bip([660, 880]);
}

/** Mauvaise réponse : double vibration, note descendante. */
export function feedbackMauvais() {
  vibrer([45, 60, 45]);
  bip([320, 220], 0.13);
}

/** Fin de partie : petite fanfare. */
export function feedbackFin(reussi = true) {
  vibrer(reussi ? [40, 50, 40, 50, 90] : 70);
  bip(reussi ? [523, 659, 784, 1047] : [400, 300], 0.11);
}

/** Compte à rebours qui s'emballe (5 dernières secondes). */
export function feedbackUrgence() {
  vibrer(18);
  bip([880], 0.05, 0.03);
}
