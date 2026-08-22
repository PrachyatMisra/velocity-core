import { motion } from 'framer-motion';

interface Props {
  value: number;
  label: string;
  sublabel?: string;
  unit?: string;
  size?: number;
  color?: string;
  criticalAt?: number;
  warningAt?: number;
  onClick?: () => void;
  trackOpacity?: number;
}

export function NeonGauge({
  value, label, sublabel, unit = '%', size = 110,
  color, criticalAt = 90, warningAt = 70, onClick, trackOpacity = 0.05,
}: Props) {
  const v = Math.max(0, Math.min(100, value));
  const r = size * 0.355;
  const sw = size * 0.058;
  const C = 2 * Math.PI * r;
  const arc = C * 0.75;
  const offset = arc - (arc * v / 100);

  const clr = color ?? (v >= criticalAt ? '#ff1a1a' : v >= warningAt ? '#ff8800' : '#ff0044');
  const hot = v >= criticalAt;

  return (
    <motion.div
      onClick={onClick}
      whileHover={onClick ? { scale: 1.04 } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        width: size, cursor: onClick ? 'pointer' : 'default', userSelect: 'none',
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        {hot && (
          <motion.div
            animate={{ opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            style={{
              position: 'absolute', inset: -3, borderRadius: '50%',
              border: `1px solid ${clr}`, boxShadow: `0 0 18px ${clr}55`,
              pointerEvents: 'none',
            }}
          />
        )}

        <svg viewBox={`0 0 ${size} ${size}`}
          style={{ width: size, height: size, transform: 'rotate(135deg)' }}>

          {/* Track */}
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={`rgba(255,255,255,${trackOpacity})`} strokeWidth={sw}
            strokeDasharray={`${arc} ${C - arc}`} strokeLinecap="round" />

          {/* Glow */}
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={clr} strokeWidth={sw + 8}
            strokeDasharray={`${arc * v / 100} ${C}`} strokeLinecap="round"
            opacity={0.12} style={{ filter: `blur(${sw * 0.7}px)` }} />

          {/* Arc */}
          <motion.circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={clr} strokeWidth={sw}
            strokeDasharray={`${arc} ${C - arc}`}
            animate={{ strokeDashoffset: offset }}
            initial={{ strokeDashoffset: arc }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 ${hot ? 12 : 5}px ${clr})` }} />

          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map(pct => {
            const ang = (135 + (pct / 100) * 270) * Math.PI / 180;
            const len = pct % 50 === 0 ? 7 : 4;
            const ri = r - sw / 2 - 1;
            const ro = ri - len;
            return (
              <line key={pct}
                x1={size/2 + ri * Math.cos(ang)} y1={size/2 + ri * Math.sin(ang)}
                x2={size/2 + ro * Math.cos(ang)} y2={size/2 + ro * Math.sin(ang)}
                stroke={`rgba(255,255,255,${pct % 50 === 0 ? 0.14 : 0.07})`}
                strokeWidth={pct % 50 === 0 ? 1.5 : 1} />
            );
          })}
        </svg>

        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          paddingTop: size * 0.07,
        }}>
          <motion.span
            key={Math.round(v)}
            animate={{ opacity: [0.7, 1] }}
            transition={{ duration: 0.2 }}
            style={{
              fontFamily: 'var(--font)', fontSize: size * 0.20, fontWeight: 800,
              color: clr, lineHeight: 1, letterSpacing: '-0.03em',
              textShadow: `0 0 ${hot ? 16 : 8}px ${clr}80`,
            }}
          >
            {v.toFixed(0)}
          </motion.span>
          <span style={{
            fontFamily: 'var(--font)', fontSize: size * 0.09,
            color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em', marginTop: 1,
          }}>{unit}</span>
          {sublabel && (
            <span style={{
              fontFamily: 'var(--font)', fontSize: size * 0.082,
              color: 'rgba(255,255,255,0.22)', marginTop: 2, letterSpacing: '0.04em',
              maxWidth: size * 0.75, textAlign: 'center', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{sublabel}</span>
          )}
        </div>
      </div>

      <span style={{
        fontFamily: 'var(--font)', fontSize: 8.5, fontWeight: 600,
        color: 'var(--text-3)', letterSpacing: '0.15em',
        textTransform: 'uppercase', marginTop: 3,
      }}>{label}</span>
    </motion.div>
  );
}
