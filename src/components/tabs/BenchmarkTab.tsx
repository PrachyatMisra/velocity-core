import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../stores/telemetryStore';
import { useTelemetry } from '../../hooks/useTelemetry';
import type { BenchmarkResult } from '../../types/telemetry';

const BENCHES = [
  { id: 'cpu_single', label: 'CPU Single',   icon: '①', unit: 'K ops/s', color: '#ff0044',  group: 'cpu' },
  { id: 'cpu_multi',  label: 'CPU Multi',    icon: '⑧', unit: 'K ops/s', color: '#ff4466',  group: 'cpu' },
  { id: 'cpu_int',    label: 'Integer ALU',  icon: '1',  unit: 'M int/s', color: '#ff6688',  group: 'cpu' },
  { id: 'cpu_float',  label: 'Float/FFT',    icon: 'π',  unit: 'K ops/s', color: '#ff8800',  group: 'cpu' },
  { id: 'cpu_crypto', label: 'Crypto Hash',  icon: '#',  unit: 'K H/s',   color: '#ffaa00',  group: 'cpu' },
  { id: 'memory',     label: 'Memory BW',    icon: '▦',  unit: 'MB/s',    color: '#aa55ff',  group: 'mem' },
  { id: 'disk_seq_read',  label: 'Disk Read  SEQ', icon: '↓', unit: 'MB/s', color: '#00ff7f', group: 'disk' },
  { id: 'disk_seq_write', label: 'Disk Write SEQ', icon: '↑', unit: 'MB/s', color: '#00e5ff', group: 'disk' },
  { id: 'disk_rand_4k',   label: 'Disk 4K Rand',   icon: '⊞', unit: 'IOPS', color: '#00c8ff', group: 'disk' },
];

interface TruthLayerResult {
  truth_score?: {
    calculated_score?: number;
    validation_status?: string;
  };
  ipc?: {
    ipc_score?: number;
  };
}

function ScoreBar({ score, maxScore, color }: { score: number; maxScore: number; color: string }) {
  const pct = maxScore > 0 ? Math.min((score / maxScore) * 100, 100) : 0;
  return (
    <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.4,0,0.2,1] }}
        style={{ height: '100%', background: `linear-gradient(90deg, ${color}99, ${color})`,
          borderRadius: 3, boxShadow: `0 0 8px ${color}60` }}
      />
    </div>
  );
}

function BenchCard({ bench, result, running, onRun }: {
  bench: typeof BENCHES[0];
  result?: BenchmarkResult;
  running: boolean;
  onRun: () => void;
}) {
  const val = result
    ? (result.mbps ?? result.iops ?? result.score ?? 0)
    : 0;
  const isRunning = running;

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      className={result ? 'panel' : 'panel'}
      style={{
        padding: '11px 13px', cursor: isRunning ? 'wait' : 'pointer',
        borderColor: isRunning ? bench.color + '55' : result ? bench.color + '22' : 'var(--border)',
        boxShadow: isRunning ? `0 0 20px ${bench.color}22` : undefined,
      }}
      onClick={!isRunning ? onRun : undefined}
    >
      {/* Sweep animation while running */}
      {isRunning && (
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(90deg, transparent, ${bench.color}18, transparent)`,
            pointerEvents: 'none', borderRadius: 'inherit',
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 14, fontWeight: 900,
          background: `${bench.color}14`, color: bench.color,
          border: `1px solid ${bench.color}30`,
          boxShadow: isRunning ? `0 0 12px ${bench.color}60` : 'none',
        }}>{bench.icon}</div>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{bench.label}</div>
          <div style={{ fontSize: 7.5, color: 'var(--text-3)', marginTop: 2 }}>{bench.unit}</div>
        </div>
      </div>

      {result ? (
        <>
          <motion.div
            key={val}
            animate={{ opacity: [0.6, 1] }} transition={{ duration: 0.25 }}
            style={{ fontSize: 18, fontWeight: 800, color: bench.color, lineHeight: 1, marginBottom: 6,
              textShadow: `0 0 10px ${bench.color}60` }}>
            {val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            <span style={{ fontSize: 9, color: 'var(--text-3)', marginLeft: 4 }}>{bench.unit}</span>
          </motion.div>
          <ScoreBar score={val} maxScore={val * 1.5} color={bench.color} />
          <div style={{ marginTop: 6, fontSize: 8, color: 'var(--text-3)' }}>
            {(result.elapsed_ms / 1000).toFixed(1)}s · {result.chip.split(' ').slice(-2).join(' ')}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {isRunning ? (
            <>
              <motion.div animate={{ rotate: [0,360] }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                style={{ width: 12, height: 12, border: `2px solid ${bench.color}`, borderTopColor: 'transparent',
                  borderRadius: '50%', flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: bench.color }}>RUNNING...</span>
            </>
          ) : (
            <span style={{ fontSize: 9, color: 'var(--text-3)' }}>Click to run</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

export function BenchmarkTab() {
  const results = useStore(s => s.benchmarkResults);
  const addResult = useStore(s => s.addBenchmark);
  const snap = useTelemetry();
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [runningAll, setRunningAll] = useState(false);
  const [truthRunning, setTruthRunning] = useState(false);
  const [truthResult, setTruthResult] = useState<TruthLayerResult | null>(null);

  const latestFor = (kind: string) =>
    [...results].reverse().find(r => r.kind === kind);

  const runBench = async (id: string) => {
    if (running.has(id)) return;
    setRunning(prev => new Set([...prev, id]));
    try {
      const r = await invoke<BenchmarkResult>('run_benchmark', { kind: id });
      addResult(r);
    } catch (e) { console.error(e); }
    setRunning(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const runAll = async () => {
    setRunningAll(true);
    for (const b of BENCHES) await runBench(b.id);
    setRunningAll(false);
  };

  const runTruth = async () => {
    setTruthRunning(true);
    try {
      const r = await invoke<TruthLayerResult>('run_truth_benchmark');
      setTruthResult(r);
    } catch (e) { console.error(e); }
    setTruthRunning(false);
  };

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Controls */}
      <div className="panel" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>
            BENCHMARK SUITE
          </div>
          <div style={{ fontSize: 8.5, color: 'var(--text-3)' }}>
            {snap?.cpu.chip_name} · Click individual or run all
          </div>
        </div>
        <motion.button
          onClick={runTruth} disabled={truthRunning || runningAll}
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          className="btn btn-ghost"
          style={{ padding: '8px 16px', fontSize: 9, opacity: truthRunning ? 0.6 : 1 }}
        >
          {truthRunning ? '◈ TRUTH LAYER...' : '◈ TRUTH LAYER'}
        </motion.button>
        <motion.button
          onClick={runAll} disabled={runningAll || truthRunning}
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: 9, opacity: runningAll ? 0.6 : 1 }}
        >
          {runningAll ? '⚡ RUNNING...' : '⚡ RUN ALL'}
        </motion.button>
      </div>

      {/* Truth layer result */}
      <AnimatePresence>
        {truthResult && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="panel-cold" style={{ padding: '14px 16px' }}>
            <div className="sh">TRUTH LAYER ANALYSIS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 7.5, color: 'var(--text-3)', marginBottom: 4 }}>CALCULATED SCORE</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#00e5ff', lineHeight: 1 }}>
                  {truthResult.truth_score?.calculated_score?.toLocaleString() ?? '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 7.5, color: 'var(--text-3)', marginBottom: 4 }}>VALIDATION</div>
                <div style={{ fontSize: 13, fontWeight: 700,
                  color: truthResult.truth_score?.validation_status?.includes('VALIDATED') ? '#00ff7f' : '#ff8800' }}>
                  {truthResult.truth_score?.validation_status ?? '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 7.5, color: 'var(--text-3)', marginBottom: 4 }}>IPC SCORE</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#aa55ff' }}>
                  {truthResult.ipc?.ipc_score?.toFixed(2) ?? '—'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Benchmark groups */}
      {(['cpu','mem','disk'] as const).map(group => {
        const groupBenches = BENCHES.filter(b => b.group === group);
        const labels = { cpu: 'CPU TESTS', mem: 'MEMORY', disk: 'STORAGE I/O' };
        return (
          <div key={group}>
            <div className="sh" style={{ padding: '0 2px' }}>{labels[group]}</div>
            <div style={{ display: 'grid', gridTemplateColumns: group === 'cpu' ? 'repeat(3,1fr)' : group === 'disk' ? 'repeat(3,1fr)' : '1fr', gap: 8 }}>
              {groupBenches.map(b => (
                <BenchCard
                  key={b.id}
                  bench={b}
                  result={latestFor(b.id)}
                  running={running.has(b.id) || runningAll}
                  onRun={() => runBench(b.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* History */}
      {results.length > 0 && (
        <div className="panel" style={{ padding: '12px 14px' }}>
          <div className="sh">RUN HISTORY</div>
          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[...results].reverse().slice(0, 20).map((r, i) => {
              const bench = BENCHES.find(b => b.id === r.kind);
              const val   = r.mbps ?? r.iops ?? r.score ?? 0;
              const color = bench?.color ?? '#ff0044';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px',
                  borderRadius: 5, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: 'var(--text-2)', flex: 1 }}>{bench?.label ?? r.kind}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color }}>
                    {val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    <span style={{ fontSize: 8, color: 'var(--text-3)', marginLeft: 3 }}>{bench?.unit}</span>
                  </span>
                  <span style={{ fontSize: 8, color: 'var(--text-4)' }}>
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
