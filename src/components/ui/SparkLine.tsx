import { useMemo } from 'react';

interface Props {
  data: number[];
  height?: number;
  color?: string;
  fillOpacity?: number;
  max?: number;
  min?: number;
  showDot?: boolean;
  showGrid?: boolean;
  strokeWidth?: number;
}

export function SparkLine({
  data, height = 40, color = '#ff0044', fillOpacity = 0.14,
  max, min = 0, showDot = true, showGrid = false, strokeWidth = 1.5,
}: Props) {
  const geo = useMemo(() => {
    if (data.length < 2) return null;
    const vMax = Math.max(max ?? Math.max(...data, 1), 1);
    const vMin = min;
    const range = vMax - vMin || 1;
    const W = 200, H = height;
    const pad = 4;
    const step = W / (data.length - 1);
    const pts = data.map((v, i) => ({
      x: i * step,
      y: H - pad - ((v - vMin) / range) * (H - pad * 2),
    }));
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], c = pts[i];
      const cx = (p.x + c.x) / 2;
      path += ` C ${cx} ${p.y} ${cx} ${c.y} ${c.x} ${c.y}`;
    }
    const last = pts[pts.length - 1];
    const fill = `${path} L ${last.x} ${H} L 0 ${H} Z`;
    return { path, fill, lx: last.x, ly: last.y, W, H };
  }, [data, height, max, min]);

  if (!geo) return <div style={{ height }} />;
  const id = `sl${color.replace('#', '')}${height}`;

  return (
    <svg
      viewBox={`0 0 ${geo.W} ${geo.H}`}
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height, overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity * 2.2} />
          <stop offset="60%" stopColor={color} stopOpacity={fillOpacity * 0.5} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <filter id={`${id}f`}>
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {showGrid && [25, 50, 75].map(pct => (
        <line
          key={pct}
          x1={0} y1={geo.H * (1 - pct / 100)}
          x2={geo.W} y2={geo.H * (1 - pct / 100)}
          stroke="rgba(255,255,255,0.04)" strokeWidth={1}
        />
      ))}

      <path d={geo.fill} fill={`url(#${id}g)`} />
      <path d={geo.path} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round" filter={`url(#${id}f)`} />

      {showDot && (
        <circle cx={geo.lx} cy={geo.ly} r={2.8}
          fill={color} filter={`url(#${id}f)`}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      )}
    </svg>
  );
}
