import { COLORS } from "../design/theme";

/**
 * Courbe en ligne, SVG pur (aucune dépendance). Prend une liste de points
 * {jour, n} et trace une ligne avec zone remplie sous la courbe.
 */
export default function LineChart({ data, label = "", color = COLORS.gold, height = 120 }) {
  if (!data || data.length === 0) {
    return <p style={{ fontSize: 12, color: COLORS.muted, margin: "0 0 8px" }}>Aucune donnée sur la période.</p>;
  }
  if (data.length === 1) {
    // Une seule valeur : pas de courbe à tracer, on affiche le chiffre.
    return (
      <p style={{ fontSize: 13, color: COLORS.text, margin: "0 0 8px" }}>
        {data[0].jour} : <b>{data[0].n}</b> {label}
      </p>
    );
  }

  const W = 320, H = height, pad = 24;
  const max = Math.max(...data.map((d) => d.n), 1);
  const min = 0;
  const xStep = (W - pad * 2) / (data.length - 1);
  const y = (v) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
  const x = (i) => pad + i * xStep;

  const pts = data.map((d, i) => `${x(i)},${y(d.n)}`).join(" ");
  const areaPts = `${pad},${H - pad} ${pts} ${x(data.length - 1)},${H - pad}`;

  return (
    <div style={{ marginBottom: 12 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {/* grille horizontale légère */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={y(max * f)} y2={y(max * f)} stroke={COLORS.cardAlt} strokeWidth="1" />
        ))}
        {/* zone remplie */}
        <polygon points={areaPts} fill={color} opacity="0.12" />
        {/* courbe */}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* points + valeurs */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.n)} r="3" fill={color} />
            <text x={x(i)} y={y(d.n) - 8} fontSize="9" fill={COLORS.muted} textAnchor="middle" fontWeight="700">{d.n}</text>
            <text x={x(i)} y={H - 8} fontSize="8" fill={COLORS.muted} textAnchor="middle">{d.jour.slice(8, 10)}/{d.jour.slice(5, 7)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
