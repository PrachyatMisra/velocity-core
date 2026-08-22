import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import type { Diagnostic } from '../../types/telemetry';

const SEV_COLOR: Record<string, string> = {
  critical: '#ff0044', warn: '#ff8800', info: '#00e5ff',
};
const SEV_CLASS: Record<string, string> = {
  critical: 'b-red', warn: 'b-amber', info: 'b-cyan',
};

interface HealResult {
  action_id: string;
  success: boolean;
  output: string;
  error?: string;
}

export function HealingTab() {
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [loading, setLoading]  = useState(true);
  const [healing, setHealing]  = useState<Set<string>>(new Set());
  const [healed,  setHealed]   = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const d = await invoke<Diagnostic[]>('get_diagnostics');
      setDiagnostics(d);
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const applyAction = async (diagId: string, actionId: string) => {
    const key = `${diagId}:${actionId}`;
    setHealing(prev => new Set([...prev, key]));
    try {
      const result = await invoke<HealResult>('apply_healing_action', { diagnostic_id: diagId, action_id: actionId });
      if (result.success) {
        setHealed(prev => new Set([...prev, key]));
      }
    } catch { /* */ }
    setHealing(prev => { const s = new Set(prev); s.delete(key); return s; });
  };

  const criticalCount = diagnostics.filter(d => d.severity === 'critical').length;
  const warnCount     = diagnostics.filter(d => d.severity === 'warn').length;
  const autoCount     = diagnostics.filter(d => d.auto_fixable).length;

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Summary bar */}
      <div className="panel" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div className="sh">HEALING INTELLIGENCE</div>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ padding: '5px 10px', borderRadius: 6, background: criticalCount > 0 ? 'rgba(255,0,68,0.10)' : 'rgba(0,255,127,0.07)', border: `1px solid ${criticalCount > 0 ? 'rgba(255,0,68,0.25)' : 'rgba(0,255,127,0.18)'}` }}>
                <div style={{ fontSize: 7.5, color: 'var(--text-3)', marginBottom: 1 }}>CRITICAL</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: criticalCount > 0 ? '#ff0044' : '#00ff7f', lineHeight: 1 }}>{criticalCount}</div>
              </div>
              <div style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(255,170,0,0.07)', border: '1px solid rgba(255,170,0,0.18)' }}>
                <div style={{ fontSize: 7.5, color: 'var(--text-3)', marginBottom: 1 }}>WARNINGS</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#ffaa00', lineHeight: 1 }}>{warnCount}</div>
              </div>
              <div style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.15)' }}>
                <div style={{ fontSize: 7.5, color: 'var(--text-3)', marginBottom: 1 }}>AUTO-FIXABLE</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#00e5ff', lineHeight: 1 }}>{autoCount}</div>
              </div>
            </div>
          </div>
          <motion.button onClick={refresh} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            className="btn btn-ghost" style={{ fontSize: 9, padding: '7px 14px' }}>
            {loading ? '◈ SCANNING...' : '↺ REFRESH'}
          </motion.button>
        </div>
      </div>

      {/* Global system health */}
      {!loading && diagnostics.length === 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          className="panel" style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✦</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#00ff7f', marginBottom: 8 }}>SYSTEM OPTIMAL</div>
          <div style={{ fontSize: 9, color: 'var(--text-3)' }}>No issues detected. All subsystems nominal.</div>
        </motion.div>
      )}

      {/* Diagnostic list */}
      <AnimatePresence>
        {diagnostics.map((diag, i) => {
          const sc = SEV_COLOR[diag.severity] ?? '#ff0044';
          const isOpen = expanded === diag.id;

          return (
            <motion.div
              key={diag.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ delay: i * 0.05 }}
              className="panel"
              style={{ overflow: 'hidden', borderColor: isOpen ? sc + '35' : 'var(--border)' }}
            >
              {/* Header row */}
              <div
                onClick={() => setExpanded(isOpen ? null : diag.id)}
                style={{
                  padding: '11px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: isOpen ? `${sc}06` : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                {/* Severity indicator */}
                <motion.div
                  animate={diag.severity === 'critical' ? { scale: [1, 1.25, 1] } : {}}
                  transition={{ duration: 1.0, repeat: Infinity }}
                  style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: sc, boxShadow: diag.severity === 'critical' ? `0 0 10px ${sc}` : 'none' }}
                />

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)' }}>{diag.title}</span>
                    <span className={`badge ${SEV_CLASS[diag.severity] ?? 'b-ghost'}`}>{diag.severity.toUpperCase()}</span>
                    {diag.auto_fixable && <span className="badge b-cyan">AUTO</span>}
                  </div>
                  <div style={{ fontSize: 8.5, color: 'var(--text-3)', marginTop: 2 }}>
                    {diag.category} · {diag.impact}
                  </div>
                </div>

                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>▾</motion.span>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    key="detail"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${sc}15` }}>
                      <div style={{ fontSize: 9.5, color: 'var(--text-2)', lineHeight: 1.7, padding: '10px 0 12px' }}>
                        {diag.description}
                      </div>

                      {diag.actions.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontSize: 8, color: 'var(--text-3)', letterSpacing: '0.12em' }}>AVAILABLE ACTIONS</div>
                          {diag.actions.map(action => {
                            const key      = `${diag.id}:${action.id}`;
                            const isHeal   = healing.has(key);
                            const isDone   = healed.has(key);
                            return (
                              <div key={action.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                                padding: '9px 11px', borderRadius: 7,
                                background: isDone ? 'rgba(0,255,127,0.06)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${isDone ? 'rgba(0,255,127,0.20)' : 'rgba(255,255,255,0.05)'}` }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 10, fontWeight: 600,
                                    color: isDone ? '#00ff7f' : 'var(--text-1)', marginBottom: 2 }}>
                                    {isDone ? '✓ ' : ''}{action.label}
                                  </div>
                                  <div style={{ fontSize: 8.5, color: 'var(--text-3)' }}>{action.description}</div>
                                  {action.destructive && (
                                    <span className="badge b-red" style={{ marginTop: 4, fontSize: 7 }}>DESTRUCTIVE</span>
                                  )}
                                </div>
                                {!isDone && (
                                  <motion.button
                                    onClick={() => applyAction(diag.id, action.id)}
                                    disabled={isHeal}
                                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                                    className={action.destructive ? 'btn btn-primary' : 'btn btn-ghost'}
                                    style={{ fontSize: 8.5, padding: '5px 12px', flexShrink: 0,
                                      opacity: isHeal ? 0.5 : 1 }}
                                  >
                                    {isHeal ? '...' : 'APPLY'}
                                  </motion.button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
