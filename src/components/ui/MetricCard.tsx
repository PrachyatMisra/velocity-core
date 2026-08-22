import { motion } from 'framer-motion';
import { SparkLine } from './SparkLine';

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  badge?: string;
  history?: number[];
  color?: string;
  critical?: boolean;
  warning?: boolean;
  onClick?: () => void;
  unit?: string;
}

export function MetricCard({
  title, value, subtitle, badge, history, color = '#ff0044',
  critical, warning, onClick, unit,
}: Props) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={onClick ? { scale: 1.018, y: -1 } : undefined}
      whileTap={onClick ? { scale: 0.985 } : undefined}
      animate={critical ? {
        boxShadow: ['0 0 0px rgba(255,0,68,0)', '0 0 20px rgba(255,0,68,0.35)', '0 0 0px rgba(255,0,68,0)'],
        borderColor: ['rgba(255,0,68,0.18)', 'rgba(255,0,68,0.55)', 'rgba(255,0,68,0.18)'],
      } : {}}
      transition={critical ? { duration: 1.6, repeat: Infinity } : undefined}
      className={critical ? 'panel-hot' : 'panel'}
      style={{
        padding: '11px 13px',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Sweep on mount */}
      <motion.div
        initial={{ x: '-120%' }} animate={{ x: '120%' }}
        transition={{ duration: 0.6, delay: 0.1 }}
        style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(90deg, transparent, ${color}18, transparent)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5 }}>
        {title}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <motion.span
          key={value}
          animate={{ opacity: [0.6, 1] }}
          transition={{ duration: 0.2 }}
          style={{
            fontSize: 16, fontWeight: 800, color,
            lineHeight: 1, letterSpacing: '-0.02em',
            textShadow: critical ? `0 0 12px ${color}` : 'none',
          }}
        >
          {value}
        </motion.span>
        {unit && <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{unit}</span>}
      </div>

      {subtitle && (
        <div style={{ fontSize: 9, color: warning ? '#ff8800' : 'var(--text-3)', marginTop: 3, letterSpacing: '0.04em' }}>
          {subtitle}
        </div>
      )}

      {badge && (
        <div className="badge b-ghost"
          style={{ position: 'absolute', top: 8, right: 8, fontSize: 7 }}>
          {badge}
        </div>
      )}

      {history && history.length > 2 && (
        <div style={{ marginTop: 7, marginLeft: -1, marginRight: -1 }}>
          <SparkLine data={history} height={22} color={color} fillOpacity={0.10} showDot={false} />
        </div>
      )}
    </motion.div>
  );
}
