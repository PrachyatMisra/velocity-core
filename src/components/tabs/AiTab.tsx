import { motion } from 'framer-motion';
import { useTelemetry, useHistory } from '../../hooks/useTelemetry';
import { SparkLine } from '../ui/SparkLine';
import { NeonGauge } from '../ui/NeonGauge';

const RISK_COLOR: Record<string, string> = {
  nominal: '#00ff7f', elevated: '#ffaa00', critical: '#ff4400', emergency: '#ff0000',
};

function RadarViz({ scores }: { scores: Record<string, number> }) {
  const keys   = Object.keys(scores);
  const size   = 140;
  const cx     = size / 2, cy = size / 2, R = size * 0.40;
  const N      = keys.length;
  const pts    = keys.map((k, i) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    const v = Math.max(0, Math.min(1, scores[k]));
    return { k, a, v, x: cx + Math.cos(a) * R * v, y: cy + Math.sin(a) * R * v,
             lx: cx + Math.cos(a) * (R + 16), ly: cy + Math.sin(a) * (R + 16) };
  });
  const poly = pts.map(p => `${p.x},${p.y}`).join(' ');
  const grid  = pts.map(p => `${cx + Math.cos(p.a) * R},${cy + Math.sin(p.a) * R}`).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1.0].map(f => (
        <polygon key={f} points={pts.map(p => {
          return `${cx + Math.cos(p.a) * R * f},${cy + Math.sin(p.a) * R * f}`;
        }).join(' ')}
          fill="none" stroke={`rgba(255,0,68,${0.05 + f * 0.05})`} strokeWidth={0.8} />
      ))}
      {/* Spokes */}
      {pts.map(p => (
        <line key={p.k} x1={cx} y1={cy} x2={cx + Math.cos(p.a) * R} y2={cy + Math.sin(p.a) * R}
          stroke="rgba(255,0,68,0.10)" strokeWidth={0.8} />
      ))}
      {/* Data polygon */}
      <polygon points={poly} fill="rgba(255,0,68,0.10)" stroke="#ff0044" strokeWidth={1.5}
        style={{ filter: 'drop-shadow(0 0 4px rgba(255,0,68,0.5))' }} />
      {pts.map(p => (
        <circle key={p.k} cx={p.x} cy={p.y} r={2.5} fill="#ff0044"
          style={{ filter: 'drop-shadow(0 0 3px #ff0044)' }} />
      ))}
      {/* Labels */}
      {pts.map(p => (
        <text key={p.k + 'l'} x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: '6px', fill: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>
          {p.k.toUpperCase()}
        </text>
      ))}
    </svg>
  );
}

export function AiTab() {
  const snap      = useTelemetry();
  const anomalyH  = useHistory('anomaly_score', 120);
  const throttleH = useHistory('throttle_risk.score', 120);

  if (!snap) return null;
  const { anomaly_score, throttle_risk, processes, velocity_score } = snap;

  const pct    = anomaly_score * 100;
  const acolor = pct >= 70 ? '#ff0044' : pct >= 40 ? '#ff8800' : pct >= 20 ? '#ffaa00' : '#00ff7f';
  const alevel = pct >= 70 ? 'CRITICAL' : pct >= 40 ? 'ELEVATED' : pct >= 20 ? 'CAUTION' : 'NOMINAL';
  const rcolor = RISK_COLOR[throttle_risk.level] ?? '#ff0044';

  const miners   = processes.filter(p => p.kind === 'cryptominer');
  const electron = processes.filter(p => p.kind === 'electron');
  const ml       = processes.filter(p => p.kind === 'ml_workload');
  const bloated  = processes.filter(p => p.bloat_score > 70);

  const radarScores = {
    cpu:    velocity_score.cpu    / 2000,
    gpu:    velocity_score.gpu    / 2000,
    memory: velocity_score.memory / 2000,
    storage: velocity_score.storage / 2000,
    anomaly: 1 - anomaly_score,
    thermal: 1 - throttle_risk.score,
  };

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Engine header */}
      <div className="panel-violet" style={{ padding: '12px 16px' }}>
        <div className="sh" style={{ color: 'rgba(170,85,255,0.6)' }}>
          <span style={{ color: '#aa55ff' }}>◈</span> AI INTELLIGENCE ENGINE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          {[
            ['ANOMALY DETECTOR',  'IsolationForest · Autoencoder · Z-Score'],
            ['THERMAL FORECAST',  'LSTM + Attention (30s / 60s / 5min horizon)'],
            ['FINGERPRINTER',     'Behavioral Rules · Process Signature DB'],
            ['INFERENCE',         'Apple MPS (Metal Performance Shaders)'],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '7px 10px', background: 'rgba(170,85,255,0.05)',
              borderRadius: 6, border: '1px solid rgba(170,85,255,0.12)' }}>
              <div style={{ fontSize: 7.5, color: 'rgba(170,85,255,0.5)', letterSpacing: '0.10em', marginBottom: 2 }}>{k}</div>
              <div style={{ fontSize: 9.5, color: 'var(--text-1)' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Anomaly + Radar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 10 }}>
        <div className="panel" style={{ padding: '12px 14px' }}>
          <div className="sh">BEHAVIORAL ANOMALY</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 12 }}>
            <NeonGauge value={pct} label="ANOMALY" unit="%" size={110} color={acolor}
              sublabel={alevel} criticalAt={70} warningAt={40} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  ['ISOLATION FOREST', pct * 0.85, acolor],
                  ['AUTOENCODER',      pct * 0.92, acolor],
                  ['Z-SCORE',          pct * 1.05, acolor],
                ].map(([l, v, c]) => (
                  <div key={l as string}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 8.5, color: 'var(--text-3)' }}>{l as string}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: c as string }}>
                        {Math.min(v as number, 100).toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                      <motion.div animate={{ width: `${Math.min(v as number, 100)}%` }}
                        style={{ height: '100%', background: c as string, borderRadius: 2,
                          boxShadow: `0 0 6px ${c as string}60` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <SparkLine data={anomalyH} height={40} color={acolor} max={1} showGrid />
          <div style={{ fontSize: 8.5, color: 'var(--text-3)', marginTop: 5 }}>Anomaly score — 2min history</div>
        </div>

        <div className="panel" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="sh">SYSTEM RADAR</div>
          <RadarViz scores={radarScores} />
          <div style={{ fontSize: 8, color: 'var(--text-3)', marginTop: 4, textAlign: 'center', lineHeight: 1.5 }}>
            Composite health across<br />6 system dimensions
          </div>
        </div>
      </div>

      {/* Thermal forecast */}
      <div className="panel" style={{ padding: '12px 14px' }}>
        <div className="sh">THERMAL RISK FORECAST</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 10 }}>
          {[
            ['30s',  throttle_risk.forecast_30s,  rcolor],
            ['60s',  throttle_risk.forecast_60s,  rcolor],
            ['5min', throttle_risk.forecast_300s, rcolor],
          ].map(([t, v, c]) => (
            <div key={t as string} style={{ textAlign: 'center', padding: '10px', borderRadius: 7,
              background: `${c as string}08`, border: `1px solid ${c as string}20` }}>
              <div style={{ fontSize: 7.5, color: 'var(--text-3)', marginBottom: 4 }}>+{t as string}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c as string, lineHeight: 1 }}>
                {((v as number) * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: 7.5, color: 'var(--text-3)', marginTop: 2 }}>risk</div>
            </div>
          ))}
        </div>
        <SparkLine data={throttleH} height={40} color={rcolor} max={1} showGrid />
        {throttle_risk.triggers.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {throttle_risk.triggers.map((trigger, i) => (
              <span key={i} className="badge b-amber">{trigger}</span>
            ))}
          </div>
        )}
      </div>

      {/* Process intelligence */}
      <div className="panel" style={{ padding: '12px 14px' }}>
        <div className="sh">PROCESS INTELLIGENCE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'CRYPTO MINERS',   procs: miners,   color: '#ff0044', icon: '⚠' },
            { label: 'ELECTRON APPS',   procs: electron, color: '#ffaa00', icon: '⬡' },
            { label: 'ML WORKLOADS',    procs: ml,       color: '#00e5ff', icon: '◈' },
            { label: 'HIGH BLOAT',      procs: bloated,  color: '#ff8800', icon: '▲' },
          ].map(({ label, procs, color, icon }) => (
            <div key={label} style={{ padding: '10px 11px', borderRadius: 7,
              background: procs.length > 0 ? `${color}08` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${procs.length > 0 ? color + '25' : 'rgba(255,255,255,0.04)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ color, fontSize: 12 }}>{icon}</span>
                <span style={{ fontSize: 7.5, color: 'var(--text-3)', letterSpacing: '0.10em' }}>{label}</span>
                <span className={`badge ${procs.length > 0 ? 'b-red' : 'b-green'}`}
                  style={{ marginLeft: 'auto', fontSize: 8 }}>{procs.length}</span>
              </div>
              {procs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {procs.slice(0, 3).map(p => (
                    <div key={p.pid} style={{ fontSize: 9, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name} — {p.cpu_pct.toFixed(1)}%
                    </div>
                  ))}
                  {procs.length > 3 && <div style={{ fontSize: 8, color: 'var(--text-3)' }}>+{procs.length - 3} more</div>}
                </div>
              ) : (
                <div style={{ fontSize: 9, color: '#00ff7f' }}>Clean ✓</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
