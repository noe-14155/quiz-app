/**
 * Avatar : une expression de visage tracée en blanc sur un fond de couleur.
 *
 * Dessiné en SVG plutôt qu'en image : aucun fichier à charger, la taille
 * s'adapte sans perte, et le trait reste net sur tous les écrans. Les huit
 * visages sont volontairement simples — à 32 pixels dans une ligne de
 * classement, un dessin détaillé devient une tache.
 */
export const NB_VISAGES = 8;

export const COULEURS_AVATAR = [
  "#7C4DFF", "#FF4D9D", "#FF8A3D", "#12B981",
  "#38BDF8", "#F43F5E", "#FFC94D", "#8A93A5",
];

/* Chaque visage : les traits à dessiner dans un carré de 48. */
const VISAGES = [
  // 0 — Sourire
  <>
    <circle cx="17" cy="19" r="2.6" fill="#fff" />
    <circle cx="31" cy="19" r="2.6" fill="#fff" />
    <path d="M15 29c2.6 3.4 6 5 9 5s6.4-1.6 9-5" />
  </>,
  // 1 — Grand sourire
  <>
    <circle cx="17" cy="18" r="2.6" fill="#fff" />
    <circle cx="31" cy="18" r="2.6" fill="#fff" />
    <path d="M14 27h20c0 5.5-4.5 9-10 9s-10-3.5-10-9Z" fill="#fff" stroke="none" />
  </>,
  // 2 — Clin d'œil
  <>
    <circle cx="17" cy="19" r="2.6" fill="#fff" />
    <path d="M27.5 19h7" />
    <path d="M15 29c2.6 3.4 6 5 9 5s6.4-1.6 9-5" />
  </>,
  // 3 — Surpris
  <>
    <circle cx="17" cy="18" r="2.8" fill="#fff" />
    <circle cx="31" cy="18" r="2.8" fill="#fff" />
    <ellipse cx="24" cy="31" rx="4.5" ry="5.5" />
  </>,
  // 4 — Concentré
  <>
    <path d="M12.5 13.5 20 16" />
    <path d="M35.5 13.5 28 16" />
    <circle cx="17" cy="21" r="2.6" fill="#fff" />
    <circle cx="31" cy="21" r="2.6" fill="#fff" />
    <path d="M16 32h16" />
  </>,
  // 5 — Lunettes
  <>
    <rect x="9.5" y="15" width="12" height="9" rx="3" />
    <rect x="26.5" y="15" width="12" height="9" rx="3" />
    <path d="M21.5 19h5" />
    <path d="M16 30c2.4 3 5 4.4 8 4.4s5.6-1.4 8-4.4" />
  </>,
  // 6 — Neutre
  <>
    <circle cx="17" cy="19" r="2.6" fill="#fff" />
    <circle cx="31" cy="19" r="2.6" fill="#fff" />
    <path d="M16.5 31h15" />
  </>,
  // 7 — Rieur
  <>
    <path d="M12.5 21c1.6-3 3.4-4.5 5-4.5s3.4 1.5 5 4.5" />
    <path d="M25.5 21c1.6-3 3.4-4.5 5-4.5s3.4 1.5 5 4.5" />
    <path d="M14 28h20c0 5.5-4.5 9-10 9s-10-3.5-10-9Z" fill="#fff" stroke="none" />
  </>,
];

export default function Avatar({ face = 0, color = "#7C4DFF", size = 44, radius, style }) {
  const visage = VISAGES[Math.max(0, Math.min(face, VISAGES.length - 1))];
  // Un carré très arrondi plutôt qu'un cercle : c'est la forme de toutes les
  // pastilles de l'application, l'avatar s'y fond naturellement.
  const rayon = radius !== undefined ? radius : Math.round(size * 0.32);

  return (
    <span style={{
      width: size, height: size, borderRadius: rayon, flexShrink: 0,
      background: `linear-gradient(135deg, ${color}, ${color}cc)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      ...style,
    }}>
      <svg
        width={size * 0.78}
        height={size * 0.78}
        viewBox="0 0 48 48"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {visage}
      </svg>
    </span>
  );
}
