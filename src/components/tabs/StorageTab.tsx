import { motion } from 'framer-motion';
import { useTelemetry, useHistory, fmtBytes } from '../../hooks/useTelemetry';
import { SparkLine } from '../ui/SparkLine';
import { MetricCard } from '../ui/MetricCard';

function LatencyBar({ label, us, maxUs, color }: { label: string; us: number; maxUs: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 8.5, color: 'var(--text-3)' }}>{label}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color }}>{us.toFixed(0)}μs</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div animate={{ width: `${Math.min((us / maxUs) * 100, 100)}%` }}
          transition={{ duration: 0.4 }}
          style={{ height: '100%', background: color, borderRadius: 2, boxShadow: `0 0 6px ${color}70` }} />
      </div>
    </div>
  );
}

export function StorageTab() {
  const snap   = useTelemetry();
  const readH  = useHistory('storage.total_read_bps', 120);
  const writeH = useHistory('storage.total_write_bps', 120);
  if (!snap) return null;
  const { storage } = snap;

  const totalRead  = storage.total_read_bps  / 1_048_576;
  const totalWrite = storage.total_write_bps / 1_048_576;

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* I/O Overview */}
      <div className="panel" style={{ padding: '12px 14px' }}>
        <div className="sh">I/O BANDWIDTH — 2min</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#00ff7f', lineHeight: 1 }}>
                {totalRead.toFixed(1)}
              </span>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>MB/s READ</span>
              <div style={{ width: 8, height: 2, background: '#00ff7f', marginLeft: 4, borderRadius: 1 }} />
            </div>
            <div style={{ position: 'relative', height: 55 }}>
              <SparkLine data={readH} height={55} color="#00ff7f" max={readH.reduce((a,b)=>Math.max(a,b),1)*1.3} showGrid />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#ff0044', lineHeight: 1 }}>
                {totalWrite.toFixed(1)}
              </span>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>MB/s WRITE</span>
              <div style={{ width: 8, height: 2, background: '#ff0044', marginLeft: 4, borderRadius: 1 }} />
            </div>
            <div style={{ position: 'relative', height: 55 }}>
              <SparkLine data={writeH} height={55} color="#ff0044" max={writeH.reduce((a,b)=>Math.max(a,b),1)*1.3} showGrid />
            </div>
          </div>
        </div>
      </div>

      {/* Per-disk cards */}
      {storage.disks.map((disk, i) => {
        const pct  = disk.usage_pct;
        const fc   = pct >= 90 ? '#ff0044' : pct >= 75 ? '#ff8800' : '#00ff7f';
        const rMbs = disk.read_bps  / 1_048_576;
        const wMbs = disk.write_bps / 1_048_576;
        const maxLat = Math.max(disk.latency_p99_us, 200);

        return (
          <motion.div key={disk.device}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="panel" style={{ padding: '14px 16px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)', marginBottom: 2 }}>
                  {disk.mount_point}
                </div>
                <div style={{ fontSize: 8.5, color: 'var(--text-3)' }}>
                  {disk.device} · {disk.fs_type}
                </div>
              </div>
              <span className={`badge ${disk.smart_status === 'Verified' ? 'b-green' : 'b-red'}`}>
                SMART: {disk.smart_status}
              </span>
            </div>

            {/* Usage bar */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ height: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <motion.div
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: [0.4,0,0.2,1] }}
                  style={{
                    height: '100%',
                    background: `linear-gradient(90deg, ${fc}bb, ${fc})`,
                    borderRadius: 4,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15)`,
                  }}
                />
                {/* Sweep shimmer */}
                <motion.div
                  initial={{ x: '-100%' }} animate={{ x: '300%' }}
                  transition={{ duration: 2.5, delay: 0.5 }}
                  style={{
                    position: 'absolute', top: 0, bottom: 0, width: '30%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  padding: '0 10px', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>
                    {fmtBytes(disk.used_bytes)} used
                  </span>
                  <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.5)' }}>
                    {fmtBytes(disk.free_bytes)} free · {pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr) 1fr 1fr 1fr', gap: 8 }}>
              {[
                ['READ',  `${rMbs.toFixed(1)} MB/s`, '#00ff7f'],
                ['WRITE', `${wMbs.toFixed(1)} MB/s`, '#ff0044'],
                ['IOPS',  `${(disk.read_iops + disk.write_iops).toFixed(0)}`, '#00e5ff'],
              ].map(([k, v, c]) => (
                <div key={k as string} style={{ padding: '7px 9px', background: 'rgba(255,255,255,0.025)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 7, color: 'var(--text-3)', letterSpacing: '0.12em' }}>{k as string}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c as string, marginTop: 2 }}>{v as string}</div>
                </div>
              ))}
              <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: 5, padding: '6px 8px', background: 'rgba(255,255,255,0.025)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
                <LatencyBar label="p50" us={disk.latency_p50_us} maxUs={maxLat} color="#00e5ff" />
                <LatencyBar label="p95" us={disk.latency_p95_us} maxUs={maxLat} color="#ff8800" />
                <LatencyBar label="p99" us={disk.latency_p99_us} maxUs={maxLat} color="#ff0044" />
              </div>
            </div>

            {/* Capacity donut */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
              <svg viewBox="0 0 48 48" style={{ width: 48, height: 48, flexShrink: 0, transform: 'rotate(-90deg)' }}>
                <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
                <motion.circle cx="24" cy="24" r="19" fill="none" stroke={fc} strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${119.4}`}
                  animate={{ strokeDashoffset: 119.4 * (1 - pct / 100) }}
                  initial={{ strokeDashoffset: 119.4 }}
                  transition={{ duration: 0.8 }}
                  style={{ filter: `drop-shadow(0 0 4px ${fc})` }}
                />
              </svg>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>CAPACITY</div>
                <div style={{ fontSize: 11, color: 'var(--text-1)' }}>
                  {fmtBytes(disk.total_bytes)} total · <span style={{ color: fc }}>{pct.toFixed(1)}% used</span>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
