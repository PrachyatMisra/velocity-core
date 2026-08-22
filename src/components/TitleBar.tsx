import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../stores/telemetryStore';
import { useExtremeStore } from '../stores/extremeStore';
import { ExtremeModeToggle } from './ExtremeMode';
import { fmtTemp, tempColor } from '../hooks/useTelemetry';

const TABS = [
  { id: 'overview',     label: 'OVERVIEW',   icon: '◈' },
  { id: 'cpu',          label: 'CPU',        icon: '⬡' },
  { id: 'gpu',          label: 'GPU',        icon: '◇' },
  { id: 'memory',       label: 'RAM',        icon: '▦' },
  { id: 'storage',      label: 'STORAGE',    icon: '◉' },
  { id: 'network',      label: 'NETWORK',    icon: '⬡' },
  { id: 'battery',      label: 'POWER',      icon: '⬟' },
  { id: 'processes',    label: 'PROCS',      icon: '≡' },
  { id: 'benchmark',    label: 'BENCH',      icon: '▷' },
  { id: 'maintenance',  label: 'MAINT',      icon: '⚙' },
  { id: 'ai',           label: 'AI INTEL',   icon: '◈' },
  { id: 'smc',          label: 'SMC',        icon: '◫' },
  { id: 'healing',      label: 'HEAL',       icon: '✦' },
];

function p2(n: number) { return n.toString().padStart(2, '0'); }

export function TitleBar() {
  const { activeTab, setActiveTab, connected, snapshot } = useStore();
  const { extremeActive } = useExtremeStore();
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const win    = getCurrentWindow();
  const ts     = `${p2(time.getHours())}:${p2(time.getMinutes())}:${p2(time.getSeconds())}`;
  const cpu    = snapshot?.cpu.total_usage_pct ?? 0;
  const temp   = snapshot?.thermal.cpu_die_temp ?? 0;
  const batt   = snapshot?.battery;
  const level  = snapshot?.throttle_risk.level ?? 'nominal';
  const accent = extremeActive ? '#ff0000' : '#ff0044';
  const borderC = extremeActive ? 'rgba(255,0,0,0.22)' : 'rgba(255,255,255,0.06)';
  const bgC     = extremeActive ? 'rgba(8,0,0,0.96)'   : 'rgba(5,5,12,0.95)';

  return (
    <div style={{
      flexShrink: 0,
      background: bgC,
      borderBottom: `1px solid ${borderC}`,
      backdropFilter: 'blur(32px) saturate(1.8)',
      WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
      transition: 'background 0.5s, border-color 0.5s',
    }}>
      {/* Top bar */}
      <div data-tauri-drag-region style={{
        display: 'flex', alignItems: 'center', height: 42,
        padding: '0 14px', gap: 10,
      }}>
        {/* Traffic lights */}
        <div style={{ display: 'flex', gap: 5.5, flexShrink: 0 }}>
          {([
            ['#ff5f57', () => win.close()],
            ['#febc2e', () => win.minimize()],
            ['#28c840', () => win.toggleMaximize()],
          ] as [string, ()=>void][]).map(([c, fn], i) => (
            <motion.button key={i} onClick={fn} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.88 }}
              style={{ width: 12, height: 12, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', padding: 0 }} />
          ))}
        </div>

        {/* Wordmark */}
        <div data-tauri-drag-region style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, marginLeft: 4 }}>
          {/* Logo glyph */}
          <motion.div
            animate={extremeActive ? { rotate: [0, 360] } : {}}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            style={{
              width: 16, height: 16, position: 'relative', flexShrink: 0,
            }}
          >
            <svg viewBox="0 0 16 16" style={{ width: 16, height: 16 }}>
              <polygon points="8,1 15,5 15,11 8,15 1,11 1,5"
                fill="none" stroke={accent} strokeWidth="1.2"
                style={{ filter: `drop-shadow(0 0 4px ${accent})` }} />
              <polygon points="8,4 12,6.5 12,9.5 8,12 4,9.5 4,6.5"
                fill={accent} opacity="0.6"
                style={{ filter: `drop-shadow(0 0 2px ${accent})` }} />
            </svg>
          </motion.div>

          <div>
            <div style={{
              fontSize: 11, fontWeight: 900, letterSpacing: '0.18em',
              color: accent, lineHeight: 1,
              textShadow: `0 0 12px ${accent}70`,
              transition: 'color 0.4s, text-shadow 0.4s',
            }}>
              VELOCITY CORE
            </div>
            <div style={{ fontSize: 7, color: 'var(--text-4)', letterSpacing: '0.22em', marginTop: 1 }}>
              APEX  ·  v3.0
            </div>
          </div>
        </div>

        {/* Live stats strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 8, flexShrink: 0 }}>
          {/* Connection dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <motion.div
              animate={connected ? { scale: [1, 0.5, 1], opacity: [1, 0.3, 1] } : {}}
              transition={{ duration: 1.8, repeat: Infinity }}
              style={{ width: 5, height: 5, borderRadius: '50%',
                background: connected ? '#00ff7f' : '#ff0044',
                boxShadow: connected ? '0 0 8px #00ff7f80' : 'none',
              }}
            />
            <span style={{ fontSize: 8, color: 'var(--text-3)', letterSpacing: '0.10em' }}>
              {connected ? 'LIVE' : 'SYNC...'}
            </span>
          </div>

          {/* CPU quick meter */}
          {connected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                <motion.div
                  animate={{ width: `${cpu}%` }}
                  transition={{ duration: 0.4 }}
                  style={{
                    height: '100%', borderRadius: 2,
                    background: cpu > 80 ? '#ff0044' : '#ff0044',
                    boxShadow: cpu > 80 ? '0 0 6px #ff0044' : 'none',
                  }}
                />
              </div>
              <span style={{ fontSize: 8, color: 'var(--text-3)', width: 28 }}>{cpu.toFixed(0)}%</span>
            </div>
          )}

          {/* Temp badge */}
          {temp > 0 && (
            <AnimatePresence>
              <motion.span
                key={Math.floor(temp)}
                animate={{ opacity: [0.7, 1] }} transition={{ duration: 0.2 }}
                style={{
                  fontSize: 9, fontWeight: 700,
                  color: tempColor(temp),
                  textShadow: temp > 85 ? `0 0 8px ${tempColor(temp)}` : 'none',
                  letterSpacing: '0.04em',
                }}
              >
                {fmtTemp(temp)}
              </motion.span>
            </AnimatePresence>
          )}

          {/* Throttle alert */}
          {level !== 'nominal' && (
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.7, repeat: Infinity }}
              style={{ fontSize: 8, fontWeight: 700, color: '#ff0044', letterSpacing: '0.12em' }}
            >
              ⚡ {level.toUpperCase()}
            </motion.span>
          )}
        </div>

        <div data-tauri-drag-region style={{ flex: 1 }} />

        {/* Battery mini */}
        {batt?.present && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <div style={{
              position: 'relative', width: 22, height: 11,
              border: `1px solid rgba(255,255,255,0.15)`, borderRadius: 2,
            }}>
              <div style={{
                position: 'absolute', right: -3, top: '50%', transform: 'translateY(-50%)',
                width: 2.5, height: 5, background: 'rgba(255,255,255,0.15)', borderRadius: '0 1px 1px 0',
              }} />
              <motion.div
                animate={{ width: `${Math.max(3, batt.charge_pct - 4)}%` }}
                style={{
                  margin: '1.5px', height: 6, borderRadius: 1,
                  background: batt.charge_pct < 20 ? '#ff0044' : batt.charging ? '#00ff7f' : '#00e5ff',
                  maxWidth: 'calc(100% - 3px)',
                  boxShadow: batt.charging ? '0 0 6px #00ff7f' : 'none',
                }}
              />
            </div>
            <span style={{ fontSize: 8, color: 'var(--text-3)' }}>{batt.charge_pct.toFixed(0)}%</span>
          </div>
        )}

        {/* Extreme toggle */}
        <ExtremeModeToggle />

        {/* Clock */}
        <span data-tauri-drag-region
          style={{ fontSize: 9.5, color: 'var(--text-4)', letterSpacing: '0.10em', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {ts}
        </span>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', overflowX: 'auto', padding: '0 14px',
        borderTop: '1px solid rgba(255,255,255,0.032)',
        scrollbarWidth: 'none',
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileHover={{ color: active ? accent : 'rgba(255,255,255,0.55)' }}
              style={{
                position: 'relative', padding: '6px 11px', flexShrink: 0,
                fontSize: 8.5, fontWeight: active ? 700 : 500,
                letterSpacing: '0.13em',
                color: active ? accent : 'var(--text-3)',
                background: active ? `${accent}0a` : 'transparent',
                border: 'none', cursor: 'pointer',
                transition: 'color 0.15s, background 0.15s',
                borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
              }}
            >
              {tab.label}
              {active && (
                <motion.div
                  layoutId="tabIndicator"
                  style={{
                    position: 'absolute', inset: 0,
                    background: `linear-gradient(180deg, ${accent}10 0%, transparent 100%)`,
                    borderRadius: '2px 2px 0 0', pointerEvents: 'none',
                  }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
