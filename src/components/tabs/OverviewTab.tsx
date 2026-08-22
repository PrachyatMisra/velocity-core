import { motion } from 'framer-motion';
import { useStore } from '../../stores/telemetryStore';
import { useTelemetry, useHistory, fmtBytes, fmtBps, fmtPower, fmtTemp, tempColor, usageColor } from '../../hooks/useTelemetry';
import { NeonGauge } from '../ui/NeonGauge';
import { SparkLine } from '../ui/SparkLine';
import { MetricCard } from '../ui/MetricCard';
import type { CoreStat } from '../../types/telemetry';

function stagger(i: number) { return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.04, duration: 0.18 } }; }

// Velocity score ring
function VelocityRing({ score, percentile }: { score: number; label?: string; percentile: number }) {
  const r = 52, sw = 7, C = 2 * Math.PI * r, arc = C * 0.75;
  const offset = arc - (arc * Math.min(score, 4000) / 4000);
  const pct = Math.min(score / 4000, 1);
  const color = pct > 0.8 ? '#00e5ff' : pct > 0.5 ? '#ff0044' : '#ff8800';
  return (
    <div style={{ position: 'relative', width: 126, height: 126, flexShrink: 0 }}>
      <svg viewBox="0 0 126 126" style={{ width: 126, height: 126, transform: 'rotate(135deg)' }}>
        <circle cx={63} cy={63} r={r} fill="none" stroke="rgba(255,255,255,0.04)"
          strokeWidth={sw} strokeDasharray={`${arc} ${C - arc}`} strokeLinecap="round" />
        <circle cx={63} cy={63} r={r} fill="none" stroke={color}
          strokeWidth={sw + 10} strokeDasharray={`${arc * pct} ${C}`} strokeLinecap="round"
          opacity={0.10} style={{ filter: `blur(8px)` }} />
        <motion.circle cx={63} cy={63} r={r} fill="none" stroke={color}
          strokeWidth={sw} strokeDasharray={`${arc} ${C - arc}`}
          animate={{ strokeDashoffset: offset }}
          initial={{ strokeDashoffset: arc }}
          transition={{ duration: 0.8, ease: [0.4,0,0.2,1] }}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', paddingTop: 6 }}>
        <motion.div animate={{ opacity: [0.8, 1] }} transition={{ duration: 0.3 }}
          style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.03em',
            textShadow: `0 0 16px ${color}80` }}>
          {score.toLocaleString()}
        </motion.div>
        <div style={{ fontSize: 7.5, color: 'var(--text-3)', letterSpacing: '0.14em', marginTop: 3 }}>
          TOP {(100 - percentile).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

// Core heatmap grid
function CoreGrid({ cores, onDrilldown }: { cores: CoreStat[]; onDrilldown: () => void }) {
  const perf = cores.filter(c => c.kind === 'performance');
  const eff  = cores.filter(c => c.kind !== 'performance');
  return (
    <div style={{ padding: '12px 14px' }}>
      <div className="sh">CORE MAP — {cores.length} cores</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {perf.length > 0 && (
          <div>
            <div style={{ fontSize: 7.5, color: 'var(--text-3)', letterSpacing: '0.14em', marginBottom: 5 }}>P-CORES</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {perf.map(c => {
                const clr = tempColor(c.temp_c);
                const u = c.usage_pct;
                return (
                  <motion.div key={c.id} whileHover={{ scale: 1.14, zIndex: 10 }} onClick={onDrilldown}
                    title={`P${c.id} · ${u.toFixed(0)}% · ${c.freq_mhz.toFixed(0)}MHz · ${c.temp_c.toFixed(0)}°C`}
                    style={{
                      width: 34, height: 34, borderRadius: 5, cursor: 'pointer',
                      position: 'relative', overflow: 'hidden',
                      background: `${clr}12`, border: `1px solid ${clr}45`,
                      boxShadow: u > 70 ? `0 0 10px ${clr}50` : 'none',
                    }}
                  >
                    <motion.div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: `linear-gradient(0deg, ${clr}dd, ${clr}66)` }}
                      animate={{ height: `${u}%` }} transition={{ duration: 0.35 }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex',
                      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{u.toFixed(0)}</div>
                      <div style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.45)' }}>P{c.id}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
        {eff.length > 0 && (
          <div>
            <div style={{ fontSize: 7.5, color: 'var(--text-3)', letterSpacing: '0.14em', marginBottom: 5 }}>E-CORES</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {eff.map(c => {
                const u = c.usage_pct;
                return (
                  <motion.div key={c.id} whileHover={{ scale: 1.12 }} onClick={onDrilldown}
                    title={`E${c.id} · ${u.toFixed(0)}%`}
                    style={{
                      width: 24, height: 24, borderRadius: 4, cursor: 'pointer',
                      position: 'relative', overflow: 'hidden',
                      background: 'rgba(120,0,50,0.14)', border: '1px solid rgba(180,0,60,0.30)',
                    }}
                  >
                    <motion.div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(180,0,60,0.7)' }}
                      animate={{ height: `${u}%` }} transition={{ duration: 0.35 }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                      <div style={{ fontSize: 7.5, color: '#fff' }}>{u.toFixed(0)}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
        {/* Sub-system chips */}
        <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
          {[['GPU', '#00e5ff'], ['ANE', '#00ff7f'], ['ISP', '#ffaa00'], ['MED', '#9966ff']].map(([name, c]) => (
            <div key={name} style={{
              flex: 1, height: 14, borderRadius: 3,
              background: `${c}0a`, border: `1px solid ${c}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 7, color: c, letterSpacing: '0.10em',
            }}>{name}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OverviewTab() {
  const snap   = useTelemetry();
  const setTab = useStore(s => s.setActiveTab);
  const cpuH   = useHistory('cpu.total_usage_pct', 60);
  const gpuH   = useHistory('gpu.usage_pct', 60);
  const memH   = useHistory('memory.usage_pct', 60);
  const tmpH   = useHistory('thermal.cpu_die_temp', 60);

  if (!snap) return <InitScreen />;
  const { cpu, gpu, memory, thermal, battery, storage, network, throttle_risk, anomaly_score, velocity_score, processes } = snap;

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Throttle alert banner */}
      {throttle_risk.level !== 'nominal' && (
        <motion.div {...stagger(0)} className={throttle_risk.level === 'emergency' ? 'panel-hot' : 'panel'}
          style={{
            padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 14,
            animation: 'critical-border 1.6s ease infinite',
          }}>
          <motion.div animate={{ opacity: [1,0.3,1] }} transition={{ duration: 0.65, repeat: Infinity }}
            style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff0044',
              boxShadow: '0 0 10px #ff0044', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#ff0044', letterSpacing: '0.14em' }}>
            ⚡ THERMAL {throttle_risk.level.toUpperCase()}
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-2)' }}>
            Score {(throttle_risk.score * 100).toFixed(0)}% · {throttle_risk.triggers.slice(0, 2).join(' · ')}
          </span>
        </motion.div>
      )}

      {/* Hero row — Velocity score + gauges */}
      <motion.div {...stagger(1)} className="panel" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <VelocityRing score={velocity_score.overall} percentile={velocity_score.percentile} />

          <div style={{ flex: 1 }}>
            <div className="sh" style={{ marginBottom: 6 }}>VELOCITY SCORE</div>
            <div style={{ fontSize: 9, color: 'var(--text-2)', marginBottom: 12 }}>
              {cpu.chip_name}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {([['CPU', velocity_score.cpu, '#ff0044'], ['GPU', velocity_score.gpu, '#00e5ff'],
                 ['RAM', velocity_score.memory, '#9966ff'], ['SSD', velocity_score.storage, '#00ff7f']] as [string,number,string][]).map(([k,v,c]) => (
                <div key={k}>
                  <div style={{ fontSize: 7.5, color: 'var(--text-3)', letterSpacing: '0.12em', marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: c, lineHeight: 1 }}>{v.toLocaleString()}</div>
                  <div style={{ marginTop: 4, height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                    <motion.div animate={{ width: `${Math.min(v / 2000 * 100, 100)}%` }}
                      style={{ height: '100%', background: c, borderRadius: 1, boxShadow: `0 0 4px ${c}` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Gauges + Core grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 10 }}>
        <motion.div {...stagger(2)} className="panel" style={{ padding: 14 }}>
          <div className="sh">SYSTEM TELEMETRY</div>
          <div style={{ display: 'flex', justifyContent: 'space-around', paddingTop: 4 }}>
            {([
              { v: cpu.total_usage_pct, l: 'CPU', s: fmtPower(cpu.package_power_mw), c: usageColor(cpu.total_usage_pct), t: 'cpu' },
              { v: gpu.usage_pct,       l: 'GPU', s: fmtPower(gpu.power_mw),         c: '#00e5ff',                        t: 'gpu' },
              { v: memory.usage_pct,    l: 'MEM', s: `${memory.pressure_level > 1 ? '⚠ P'+memory.pressure_level : fmtBytes(memory.used_bytes)}`, c: usageColor(memory.usage_pct), t: 'memory' },
              { v: (thermal.cpu_die_temp/110)*100, l: 'HEAT', s: fmtTemp(thermal.cpu_die_temp), c: tempColor(thermal.cpu_die_temp), t: 'smc', u: '°' },
            ] as { v: number; l: string; s: string; c: string; t: string; u?: string }[]).map(g => (
              <NeonGauge key={g.l} value={g.v} label={g.l} sublabel={g.s} unit={g.u ?? '%'}
                size={105} color={g.c} onClick={() => setTab(g.t)} />
            ))}
          </div>
        </motion.div>

        <motion.div {...stagger(2)} className="panel">
          <CoreGrid cores={cpu.cores} onDrilldown={() => setTab('cpu')} />
        </motion.div>
      </div>

      {/* Charts */}
      <motion.div {...stagger(3)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'CPU + GPU %', data: cpuH, data2: gpuH, c1: '#ff0044', c2: '#00e5ff' },
          { label: 'MEMORY %',    data: memH, c1: '#9966ff' },
          { label: 'CPU TEMP °C', data: tmpH, c1: '#ff8800', maxV: 110 },
        ].map((chart, i) => (
          <div key={i} className="panel" style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 8.5, color: 'var(--text-3)', letterSpacing: '0.12em', marginBottom: 6 }}>{chart.label}</div>
            <div style={{ position: 'relative', height: 44 }}>
              <SparkLine data={chart.data} height={44} color={chart.c1} max={chart.maxV ?? 100} showGrid />
              {chart.data2 && (
                <div style={{ position: 'absolute', inset: 0 }}>
                  <SparkLine data={chart.data2} height={44} color={chart.c2!} fillOpacity={0.05} showDot={false} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
              <span style={{ fontSize: 8.5, color: chart.c1 }}>
                {chart.label.includes('TEMP') ? fmtTemp(chart.data[chart.data.length-1]??0)
                  : `${(chart.data[chart.data.length-1]??0).toFixed(1)}%`}
              </span>
              {chart.data2 && (
                <span style={{ fontSize: 8.5, color: chart.c2! }}>
                  GPU {(chart.data2[chart.data2.length-1]??0).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Quick stats grid */}
      <motion.div {...stagger(4)} style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        <MetricCard title="DISK I/O" value={`${(storage.total_read_bps/1048576).toFixed(1)}`} unit="MB/s"
          subtitle={`↑ ${(storage.total_write_bps/1048576).toFixed(1)} MB/s`}
          color="#00ff7f" onClick={() => setTab('storage')} />
        <MetricCard title="NETWORK ↓" value={fmtBps(network.total_rx_bps)}
          subtitle={`↑ ${fmtBps(network.total_tx_bps)}`}
          color="#00e5ff" onClick={() => setTab('network')} />
        <MetricCard title={battery.present ? 'BATTERY' : 'POWER'}
          value={battery.present ? `${battery.charge_pct.toFixed(0)}%` : 'AC'}
          subtitle={battery.present ? `Health ${battery.health_pct.toFixed(0)}%` : 'Desktop'}
          color={battery.present && battery.health_pct < 80 ? '#ff8800' : '#00ff7f'}
          warning={battery.present && battery.health_pct < 80}
          onClick={() => setTab('battery')} />
        <MetricCard title="AI ANOMALY" value={`${(anomaly_score * 100).toFixed(0)}%`}
          subtitle={`Risk: ${throttle_risk.level}`}
          color={anomaly_score > 0.7 ? '#ff0044' : anomaly_score > 0.4 ? '#ff8800' : '#00ff7f'}
          critical={anomaly_score > 0.8} onClick={() => setTab('ai')} />
      </motion.div>

      {/* Top processes */}
      <motion.div {...stagger(5)} className="panel" style={{ padding: '12px 14px' }}>
        <div className="sh">TOP PROCESSES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {processes.slice(0, 8).map((p, i) => {
            const kc = p.kind === 'cryptominer' ? '#ff0044' : p.kind === 'electron' ? '#ffaa00'
              : p.kind === 'ml_workload' ? '#00e5ff' : 'var(--text-3)';
            return (
              <motion.div key={p.pid} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: kc, flexShrink: 0,
                  boxShadow: p.kind === 'cryptominer' ? '0 0 6px #ff0044' : 'none' }} />
                <div style={{ fontSize: 10, width: 130, overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', color: 'var(--text-1)' }}>{p.name}</div>
                <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                  <motion.div animate={{ width: `${Math.min(p.cpu_pct, 100)}%` }}
                    transition={{ duration: 0.3 }}
                    style={{ height: '100%', background: kc, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 10, width: 42, textAlign: 'right', color: kc, fontWeight: 700 }}>
                  {p.cpu_pct.toFixed(1)}%
                </div>
                <div style={{ fontSize: 9.5, width: 54, textAlign: 'right', color: 'var(--text-3)' }}>
                  {fmtBytes(p.memory_bytes)}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

function InitScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', flexDirection: 'column', gap: 20 }}>
      <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.1, repeat: Infinity }}
        style={{ fontSize: 22, fontWeight: 900, color: '#ff0044',
          textShadow: '0 0 20px rgba(255,0,68,0.6)', letterSpacing: '0.18em' }}>
        VELOCITY CORE
      </motion.div>
      <div style={{ fontSize: 8.5, color: 'var(--text-3)', letterSpacing: '0.22em' }}>
        INITIALIZING TELEMETRY ENGINE
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: 12 }, (_, i) => (
          <motion.div key={i} style={{ width: 2.5, height: 18, background: '#ff0044', borderRadius: 1 }}
            animate={{ scaleY: [0.15, 1, 0.15] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.07 }} />
        ))}
      </div>
    </div>
  );
}
