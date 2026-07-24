/**
 * Emblèmes de rang.
 *
 * Une famille cohérente, lisible d'un coup d'œil : le rang se devine au nombre
 * de marques, comme des galons. Les icônes génériques précédentes (un ticket,
 * une silhouette cochée) n'évoquaient rien et ne se hiérarchisaient pas entre
 * elles — on ne pouvait pas dire laquelle valait plus qu'une autre.
 *
 * Progression : un point, un chevron, deux chevrons, trois chevrons, une
 * étoile, une étoile couronnée de lauriers, une étoile rayonnante.
 *
 * Tracé en blanc sur le dégradé du rang, comme tout le reste de l'application.
 */

const CHEVRON = "M -9 3 L 0 -4 L 9 3";
const ETOILE = "M 0 -10 L 2.9 -3.1 L 10.4 -2.6 L 4.6 2.2 L 6.4 9.5 L 0 5.6 L -6.4 9.5 L -4.6 2.2 L -10.4 -2.6 L -2.9 -3.1 Z";
const LAURIER_G = "M -11 6 C -15 2 -15 -3 -12 -6 C -10 -2 -10 2 -8 5";
const LAURIER_D = "M 11 6 C 15 2 15 -3 12 -6 C 10 -2 10 2 8 5";

/* Chaque emblème est tracé dans un repère centré, de -14 à +14. */
const EMBLEMES = [
  // 0 — Novice : un simple disque, le point de départ
  <circle cx="0" cy="0" r="5.5" />,

  // 1 — Apprenti : un chevron
  <path d={CHEVRON} />,

  // 2 — Confirmé : deux chevrons
  <>
    <path d={CHEVRON} transform="translate(0,-4)" />
    <path d={CHEVRON} transform="translate(0,4)" />
  </>,

  // 3 — Expert : trois chevrons
  <>
    <path d={CHEVRON} transform="translate(0,-7)" />
    <path d={CHEVRON} transform="translate(0,0)" />
    <path d={CHEVRON} transform="translate(0,7)" />
  </>,

  // 4 — Champion : l'étoile pleine
  <path d={ETOILE} fill="currentColor" stroke="none" />,

  // 5 — Maître : l'étoile entre deux lauriers
  <>
    <path d={ETOILE} transform="scale(0.78)" fill="currentColor" stroke="none" />
    <path d={LAURIER_G} />
    <path d={LAURIER_D} />
  </>,

  // 6 — Légende : l'étoile rayonnante
  <>
    <path d={ETOILE} transform="scale(0.7)" fill="currentColor" stroke="none" />
    <path d="M 0 -13 v -2.5" />
    <path d="M 0 13 v 2.5" />
    <path d="M -13 0 h -2.5" />
    <path d="M 13 0 h 2.5" />
    <path d="M -9.2 -9.2 l -1.8 -1.8" />
    <path d="M 9.2 -9.2 l 1.8 1.8" />
    <path d="M -9.2 9.2 l -1.8 1.8" />
    <path d="M 9.2 9.2 l 1.8 1.8" />
  </>,
];

export const NB_RANGS = EMBLEMES.length;

/**
 * @param rangIndex 0 (Novice) à 6 (Légende)
 * @param size côté du carré, en pixels
 */
export default function RankEmblem({ rangIndex = 0, size = 20, color = "#fff", style }) {
  const emblem = EMBLEMES[Math.max(0, Math.min(rangIndex, EMBLEMES.length - 1))];
  return (
    <svg
      width={size}
      height={size}
      viewBox="-16 -18 32 36"
      fill="none"
      stroke={color}
      color={color}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {emblem}
    </svg>
  );
}
