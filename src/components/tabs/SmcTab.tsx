import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { useTelemetry, fmtTemp, tempColor } from '../../hooks/useTelemetry';
import { SparkLine } from '../ui/SparkLine';

export function SmcTab() {
  const snap = useTelemetry();
  const [smcKeys, setSmcKeys] = useState<[string, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all'|'temp'|'fan'|'power'>('temp');

  useEffect(() => {
    const fetch = async () => {
      try {
        const keys = await invoke<[string, number][]>('get_smc_keys');
        setSmcKeys(keys);
      } catch { /* */ }
      setLoading(false);
    };
    fetch();
    const t = setInterval(fetch, 2000);
    return () => clearInterval(t);
  }, []);

  if (!snap) return null;
  const { thermal } = snap;

  const fans    = thermal.fan_rpm.filter(r => r > 0);
  const sensors = thermal.all_sensors.filter(s => s.temp_c > 5);

  const filteredKeys = smcKeys.filter(([key]) => {
    if (filter === 'temp')  return key.startsWith('T');
    if (filter === 'fan')   return key.startsWith('F');
    if (filter === 'power') return key.startsWith('P');
    return true;
  });

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div className="panel" style={{ padding: '12px 14px' }}>
        <div className="sh">SYSTEM MANAGEMENT CONTROLLER</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            ['CPU DIE', fmtTemp(thermal.cpu_die_temp), tempColor(thermal.cpu_die_temp)],
            ['GPU',     fmtTemp(thermal.gpu_temp),     tempColor(thermal.gpu_temp)],
            ['NAND',    fmtTemp(thermal.nand_temp),    tempColor(thermal.nand_temp)],
            ['BATTERY', fmtTemp(thermal.battery_temp), thermal.battery_temp > 38 ? '#ff8800' : '#00ff7f'],
            ['AMBIENT', fmtTemp(thermal.ambient_temp), '#00e5ff'],
          ].map(([k, v, c]) => (
            <div key={k as string} style={{ padding: '8px 12px', background: `${c as string}09`, borderRadius: 7, border: `1px solid ${c as string}22`, minWidth: 80 }}>
              <div style={{ fontSize: 7.5, color: 'var(--text-3)', letterSpacing: '0.10em', marginBottom: 3 }}>{k as string}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: c as string,
                textShadow: thermal.cpu_die_temp > 85 ? `0 0 12px ${c as string}` : 'none' }}>
                {v as string}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fans */}
      {fans.length > 0 && (
        <div className="panel" style={{ padding: '12px 14px' }}>
          <div className="sh">FAN CONTROL</div>
          <div style={{ display: 'flex', gap: 24 }}>
            {fans.map((rpm, i) => {
              const pct = rpm / 6500;
              const color = pct > 0.8 ? '#ff0044' : pct > 0.5 ? '#ff8800' : '#00e5ff';
              return (
                <div key={i} style={{ textAlign: 'center' }}>
                  {/* Fan circle */}
                  <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 8 }}>
                    <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: Math.max(0.3, 3 - pct * 2.5), repeat: Infinity, ease: 'linear' }}
                      style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 80 80" style={{ width: 80, height: 80 }}>
                        {[0,60,120,180,240,300].map(a => (
                          <ellipse key={a} cx="40" cy="40" rx="16" ry="6"
                            fill={`${color}60`} stroke={color} strokeWidth="0.8"
                            transform={`rotate(${a} 40 40) translate(12,-3)`} />
                        ))}
                        <circle cx="40" cy="40" r="6" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
                      </svg>
                    </motion.div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>
                    {rpm.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--text-3)', marginTop: 2 }}>RPM · FAN {i + 1}</div>
                  <div style={{ marginTop: 6, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <motion.div animate={{ width: `${pct * 100}%` }}
                      style={{ height: '100%', background: color, borderRadius: 2, boxShadow: `0 0 6px ${color}` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Thermal sensor grid */}
      {sensors.length > 0 && (
        <div className="panel" style={{ padding: '12px 14px' }}>
          <div className="sh">THERMAL SENSORS — {sensors.length} active</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
            {sensors.map(s => {
              const c = tempColor(s.temp_c);
              const pct = (s.temp_c / 110) * 100;
              return (
                <motion.div key={s.key} whileHover={{ scale: 1.04 }}
                  style={{ padding: '8px 10px', borderRadius: 7, textAlign: 'center',
                    background: `${c}07`, border: `1px solid ${c}25` }}>
                  <div style={{ fontSize: 8, color: 'var(--text-3)', letterSpacing: '0.10em', marginBottom: 3 }}>{s.key}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: c, marginBottom: 1,
                    textShadow: s.temp_c > 85 ? `0 0 10px ${c}` : 'none' }}>
                    {fmtTemp(s.temp_c)}
                  </div>
                  <div style={{ fontSize: 7.5, color: 'var(--text-4)', marginBottom: 5 }}>{s.label || '—'}</div>
                  <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1, overflow: 'hidden' }}>
                    <motion.div animate={{ width: `${pct}%` }}
                      style={{ height: '100%', background: c, borderRadius: 1 }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw SMC keys */}
      <div className="panel" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div className="sh" style={{ marginBottom: 0, flex: 1 }}>RAW SMC KEYS</div>
          {loading && (
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
              style={{ fontSize: 8.5, color: '#ff0044' }}>READING...</motion.span>
          )}
          <div style={{ display: 'flex', gap: 3 }}>
            {(['all','temp','fan','power'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={filter === f ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ padding: '3px 8px', fontSize: 7.5 }}>{f.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
          {filteredKeys.map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px',
              borderRadius: 4, background: 'var(--red-lo)', border: '1px solid var(--red-border)' }}>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{key}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#ff0044' }}>{val.toFixed(1)}</span>
            </div>
          ))}
          {filteredKeys.length === 0 && !loading && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px 0',
              fontSize: 9, color: 'var(--text-3)' }}>
              No keys available — ioreg access may be restricted
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
