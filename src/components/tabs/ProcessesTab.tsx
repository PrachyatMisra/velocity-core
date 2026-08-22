import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../stores/telemetryStore';
import { fmtBytes } from '../../hooks/useTelemetry';

const KIND_COLOR: Record<string, string> = {
  cryptominer:  '#ff0044',
  electron:     '#ffaa00',
  ml_workload:  '#00e5ff',
  compiler:     '#00ff7f',
  media:        '#ff3399',
  system:       '#484868',
  normal:       '#484868',
};
const KIND_LABEL: Record<string, string> = {
  cryptominer:  '⚠ MINER',
  electron:     '⬡ ELECTRON',
  ml_workload:  '◈ ML',
  compiler:     '⚙ BUILD',
  media:        '▷ MEDIA',
  system:       '◉ SYSTEM',
  normal:       '',
};

type Sort = 'cpu' | 'memory' | 'name' | 'gpu';

export function ProcessesTab() {
  const processes = useStore(s => s.snapshot?.processes ?? []);
  const [sort, setSort] = useState<Sort>('cpu');
  const [filter, setFilter] = useState('');
  const [killing, setKilling] = useState<number | null>(null);
  const [killed, setKilled] = useState<Set<number>>(new Set());

  const sorted = [...processes]
    .filter(p => !killed.has(p.pid))
    .filter(p => !filter || p.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'cpu')    return b.cpu_pct - a.cpu_pct;
      if (sort === 'memory') return b.memory_bytes - a.memory_bytes;
      if (sort === 'gpu')    return b.gpu_pct - a.gpu_pct;
      return a.name.localeCompare(b.name);
    });

  const maxCpu = Math.max(...sorted.map(p => p.cpu_pct), 1);

  const doKill = async (pid: number) => {
    setKilling(pid);
    try {
      await invoke('kill_process', { pid });
      setKilled(prev => new Set([...prev, pid]));
    } catch (e) { console.error(e); }
    setKilling(null);
  };

  const miners  = processes.filter(p => p.kind === 'cryptominer' && !killed.has(p.pid));
  const bloated = processes.filter(p => p.bloat_score > 70 && !killed.has(p.pid));

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Alerts */}
      {miners.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="panel-hot critical-pulse"
          style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.7, repeat: Infinity }}
            style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff0044', boxShadow: '0 0 12px #ff0044' }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#ff0044', letterSpacing: '0.12em' }}>
            ⚠ CRYPTOMINER DETECTED — {miners.map(p => p.name).join(', ')}
          </span>
        </motion.div>
      )}

      {/* Controls */}
      <div className="panel" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter processes..."
          style={{ flex: 1, padding: '6px 10px', fontSize: 10 }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {(['cpu', 'memory', 'gpu', 'name'] as Sort[]).map(s => (
            <button key={s} onClick={() => setSort(s)}
              className={sort === s ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ padding: '5px 10px', fontSize: 8.5 }}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 8.5, color: 'var(--text-3)' }}>{sorted.length} procs</span>
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr 80px 70px 60px 60px 64px',
        gap: 8, padding: '0 4px',
        fontSize: 7.5, color: 'var(--text-3)', letterSpacing: '0.12em',
      }}>
        <div />
        <div>PROCESS</div>
        <div style={{ textAlign: 'right' }}>CPU %</div>
        <div style={{ textAlign: 'right' }}>MEM</div>
        <div style={{ textAlign: 'right' }}>GPU %</div>
        <div style={{ textAlign: 'right' }}>THREADS</div>
        <div />
      </div>

      {/* Process rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <AnimatePresence>
          {sorted.map((proc, i) => {
            const kc = KIND_COLOR[proc.kind] ?? '#484868';
            const kl = KIND_LABEL[proc.kind];
            return (
              <motion.div
                key={proc.pid}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.15 }}
                className="panel"
                style={{
                  padding: '8px 10px',
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr 80px 70px 60px 60px 64px',
                  alignItems: 'center', gap: 8,
                  borderColor: proc.kind === 'cryptominer' ? 'rgba(255,0,68,0.3)' : 'var(--border)',
                }}
              >
                {/* Kind dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: kc,
                  boxShadow: proc.kind === 'cryptominer' || proc.kind === 'ml_workload'
                    ? `0 0 8px ${kc}` : 'none',
                  margin: 'auto',
                }} />

                {/* Name + CPU bar */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-1)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                      {proc.name}
                    </span>
                    {kl && (
                      <span style={{ fontSize: 7.5, color: kc, flexShrink: 0 }}>{kl}</span>
                    )}
                  </div>
                  {/* CPU bar */}
                  <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 1, overflow: 'hidden' }}>
                    <motion.div animate={{ width: `${(proc.cpu_pct / maxCpu) * 100}%` }}
                      style={{ height: '100%', background: kc, borderRadius: 1 }} />
                  </div>
                </div>

                {/* CPU % */}
                <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 700,
                  color: proc.cpu_pct > 50 ? '#ff0044' : proc.cpu_pct > 20 ? '#ff8800' : 'var(--text-1)' }}>
                  {proc.cpu_pct.toFixed(1)}%
                </div>

                {/* Memory */}
                <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-2)' }}>
                  {fmtBytes(proc.memory_bytes)}
                </div>

                {/* GPU % */}
                <div style={{ textAlign: 'right', fontSize: 10,
                  color: proc.gpu_pct > 30 ? '#00e5ff' : 'var(--text-3)' }}>
                  {proc.gpu_pct > 0 ? `${proc.gpu_pct.toFixed(0)}%` : '—'}
                </div>

                {/* Threads */}
                <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-3)' }}>
                  {proc.threads}
                </div>

                {/* Kill button */}
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => doKill(proc.pid)}
                  disabled={killing === proc.pid}
                  style={{
                    padding: '3px 8px', fontSize: 8, fontWeight: 700, cursor: 'pointer',
                    background: 'rgba(255,0,68,0.08)', border: '1px solid rgba(255,0,68,0.18)',
                    color: 'rgba(255,0,68,0.7)', borderRadius: 4,
                    opacity: killing === proc.pid ? 0.5 : 1,
                    letterSpacing: '0.08em',
                  }}
                >
                  {killing === proc.pid ? '...' : 'KILL'}
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
