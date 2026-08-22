import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';

interface CleanTarget {
  id: string; label: string; path: string; size_bytes: number;
  file_count: number; category: string; safe: boolean; description: string;
}
interface CleanResult {
  id: string; freed_bytes: number; files_removed: number; success: boolean; message: string;
}
interface NetResult {
  dns_flushed: boolean; routes_reset: boolean; arp_cleared: boolean;
  bufferbloat_set: boolean; details: string[];
}

function fmtBytes(b: number) {
  if (b >= 1e9) return `${(b/1e9).toFixed(2)} GB`;
  if (b >= 1e6) return `${(b/1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b/1e3).toFixed(0)} KB`;
  return `${b} B`;
}

const CAT_COLORS: Record<string, string> = {
  caches: '#ff0044', development: '#00e5ff', diagnostics: '#ff8800', user: '#aa55ff',
};

export function MaintenanceTab() {
  const [targets,  setTargets]  = useState<CleanTarget[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [cleaning, setCleaning] = useState<Set<string>>(new Set());
  const [results,  setResults]  = useState<Record<string, CleanResult>>({});
  const [netResult, setNetResult] = useState<NetResult | null>(null);
  const [netRunning, setNetRunning] = useState(false);
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [totalFreed, setTotalFreed] = useState(0);

  useEffect(() => {
    invoke<CleanTarget[]>('get_maintenance_targets')
      .then(t => setTargets(t))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalSize = targets.reduce((a, t) => a + t.size_bytes, 0);
  const safeSize  = targets.filter(t => t.safe).reduce((a, t) => a + t.size_bytes, 0);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const selectAll = () => setSelected(new Set(targets.filter(t => t.safe).map(t => t.id)));
  const selectNone = () => setSelected(new Set());

  const clean = async (ids: string[]) => {
    for (const id of ids) {
      setCleaning(prev => new Set([...prev, id]));
      try {
        const r = await invoke<CleanResult>('deep_clean', { targetId: id });
        setResults(prev => ({ ...prev, [id]: r }));
        if (r.success) setTotalFreed(f => f + r.freed_bytes);
      } catch { /* */ }
      setCleaning(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const runNetDetox = async () => {
    setNetRunning(true);
    try { setNetResult(await invoke<NetResult>('network_detox')); } catch { /* */ }
    setNetRunning(false);
  };

  const categories = [...new Set(targets.map(t => t.category))];

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Hero stats */}
      <div className="panel" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div className="sh">STORAGE MAINTENANCE</div>
            <div style={{ display: 'flex', gap: 20 }}>
              <div>
                <div style={{ fontSize: 8, color: 'var(--text-3)', letterSpacing: '0.12em' }}>RECLAIMABLE</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#ff0044', lineHeight: 1 }}>{fmtBytes(safeSize)}</div>
              </div>
              <div>
                <div style={{ fontSize: 8, color: 'var(--text-3)', letterSpacing: '0.12em' }}>TOTAL FOUND</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-2)', lineHeight: 1 }}>{fmtBytes(totalSize)}</div>
              </div>
              {totalFreed > 0 && (
                <div>
                  <div style={{ fontSize: 8, color: 'var(--text-3)', letterSpacing: '0.12em' }}>FREED THIS SESSION</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#00ff7f', lineHeight: 1 }}>{fmtBytes(totalFreed)}</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={selectAll}  className="btn btn-ghost" style={{ fontSize: 9, padding: '6px 12px' }}>SELECT SAFE</button>
            <button onClick={selectNone} className="btn btn-ghost" style={{ fontSize: 9, padding: '6px 12px' }}>CLEAR</button>
            <motion.button
              onClick={() => clean([...selected])}
              disabled={selected.size === 0 || cleaning.size > 0}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              className="btn btn-primary"
              style={{ fontSize: 9, padding: '6px 14px', opacity: selected.size === 0 || cleaning.size > 0 ? 0.5 : 1 }}
            >
              {cleaning.size > 0 ? `CLEANING ${cleaning.size}...` : `CLEAN SELECTED (${selected.size})`}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Target list by category */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 9, color: 'var(--text-3)' }}>
          SCANNING SYSTEM...
        </div>
      ) : (
        categories.map(cat => {
          const catTargets = targets.filter(t => t.category === cat);
          const catColor   = CAT_COLORS[cat] ?? '#ff0044';
          return (
            <div key={cat}>
              <div className="sh" style={{ padding: '0 2px' }}>
                {cat.toUpperCase()} — {catTargets.length} items
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {catTargets.map((target, i) => {
                  const result  = results[target.id];
                  const isCleaning = cleaning.has(target.id);
                  const isSel   = selected.has(target.id);
                  const isDone  = !!result;

                  return (
                    <motion.div key={target.id}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => !isDone && toggleSelect(target.id)}
                      className="panel"
                      style={{
                        padding: '10px 13px', cursor: isDone ? 'default' : 'pointer',
                        borderColor: isSel ? catColor + '40' : isDone ? 'rgba(0,255,127,0.2)' : 'var(--border)',
                        background: isSel ? `${catColor}07` : isDone ? 'rgba(0,255,127,0.04)' : undefined,
                      }}
                    >
                      {/* Sweep while cleaning */}
                      {isCleaning && (
                        <motion.div animate={{ x: ['-100%', '200%'] }} transition={{ duration: 0.9, repeat: Infinity }}
                          style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg,transparent,${catColor}22,transparent)`, borderRadius: 'inherit', pointerEvents: 'none' }} />
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Checkbox */}
                        <div style={{
                          width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${isSel ? catColor : 'rgba(255,255,255,0.12)'}`,
                          background: isSel ? catColor : 'transparent', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: isSel ? `0 0 8px ${catColor}60` : 'none',
                          transition: 'all 0.15s',
                        }}>
                          {isSel && <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>✓</span>}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: isDone ? '#00ff7f' : 'var(--text-1)' }}>
                              {target.label}
                            </span>
                            {!target.safe && <span className="badge b-amber" style={{ fontSize: 7 }}>REVIEW</span>}
                          </div>
                          <div style={{ fontSize: 8.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 340 }}>
                            {isDone ? (result.success ? `✓ Freed ${fmtBytes(result.freed_bytes)}` : `✗ ${result.message}`) : target.description}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {isCleaning ? (
                            <motion.div animate={{ rotate: [0,360] }} transition={{ duration: 0.8, repeat: Infinity }}
                              style={{ width: 14, height: 14, border: `2px solid ${catColor}`, borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 700,
                              color: isDone ? '#00ff7f' : target.size_bytes > 1e8 ? '#ff0044' : 'var(--text-2)' }}>
                              {fmtBytes(target.size_bytes)}
                            </span>
                          )}
                        </div>

                        {!isDone && (
                          <motion.button
                            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }}
                            onClick={e => { e.stopPropagation(); clean([target.id]); }}
                            disabled={isCleaning}
                            className="btn btn-primary"
                            style={{ fontSize: 8, padding: '4px 10px', flexShrink: 0 }}
                          >
                            CLEAN
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Network Detox */}
      <div className="panel-cold" style={{ padding: '14px 16px' }}>
        <div className="sh">NETWORK DETOX</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ flex: 1, fontSize: 9, color: 'var(--text-2)', lineHeight: 1.7 }}>
            Flushes DNS cache, removes stale ARP entries, resets routing table,
            and optimizes TCP buffer settings for reduced bufferbloat.
          </div>
          <motion.button
            onClick={runNetDetox} disabled={netRunning}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            className="btn btn-ghost"
            style={{ fontSize: 9, padding: '7px 14px', flexShrink: 0,
              borderColor: 'var(--cyan-border)', color: '#00e5ff', opacity: netRunning ? 0.5 : 1 }}
          >
            {netRunning ? '◈ RUNNING...' : '◈ RUN DETOX'}
          </motion.button>
        </div>

        <AnimatePresence>
          {netResult && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              style={{ marginTop: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {netResult.details.map((d, i) => (
                  <div key={i} style={{ fontSize: 9, color: d.includes('✓') ? '#00ff7f' : d.includes('⚠') ? '#ff8800' : 'var(--text-2)', padding: '3px 0' }}>
                    {d}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
