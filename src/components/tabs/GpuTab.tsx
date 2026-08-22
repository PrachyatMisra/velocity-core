import { motion } from 'framer-motion';
import { useTelemetry, useHistory, fmtBytes, fmtPower, fmtTemp, tempColor } from '../../hooks/useTelemetry';
import { NeonGauge } from '../ui/NeonGauge';
import { SparkLine } from '../ui/SparkLine';

export function GpuTab() {
  const snap = useTelemetry();
  const gpuH  = useHistory('gpu.usage_pct', 120);
  const tmpH  = useHistory('gpu.temp_c', 120);
  const pwrH  = useHistory('gpu.power_mw', 120);

  if (!snap) return null;
  const { gpu } = snap;

  const engines = [
    ['Vertex',   gpu.vertex_usage_pct,        '#00e5ff'],
    ['Fragment', gpu.fragment_usage_pct,       '#ff0044'],
    ['Compute',  gpu.compute_usage_pct,        '#9966ff'],
    ['Tiler',    gpu.tiler_usage_pct,          '#ff8800'],
    ['Encoder',  gpu.encoder_usage_pct,        '#00ff7f'],
    ['Decoder',  gpu.decoder_usage_pct,        '#ffdd00'],
    ['ANE',      gpu.neural_engine_usage_pct,  '#00e5ff'],
  ] as [string, number, string][];

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Hero */}
      <div className="panel" style={{ padding: 16 }}>
        <div className="sh">{gpu.name} — {gpu.vendor}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <NeonGauge value={gpu.usage_pct} label="GPU" size={110} color="#00e5ff"
            sublabel={`${gpu.freq_mhz.toFixed(0)}MHz`} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[
                ['POWER',  fmtPower(gpu.power_mw),                '#ff8800'],
                ['TEMP',   fmtTemp(gpu.temp_c),                   tempColor(gpu.temp_c)],
                ['VRAM',   `${(gpu.memory_used_mb/1024).toFixed(1)}G`, '#9966ff'],
                ['BW',     `${gpu.memory_bandwidth_gbs.toFixed(0)} GB/s`, '#00e5ff'],
                ['TOTAL',  `${(gpu.memory_total_mb/1024).toFixed(0)} GB`, 'var(--text-2)'],
                ['FREQ',   `${gpu.freq_mhz.toFixed(0)}MHz`,       '#00ff7f'],
              ].map(([k, v, c]) => (
                <div key={k as string} style={{ padding: '7px 9px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.042)' }}>
                  <div style={{ fontSize: 7, color: 'var(--text-3)', letterSpacing: '0.12em' }}>{k as string}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c as string, marginTop: 2 }}>{v as string}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="panel" style={{ padding: '10px 12px' }}>
          <div className="sh">GPU LOAD — 2min</div>
          <SparkLine data={gpuH} height={55} color="#00e5ff" showGrid />
          <div style={{ fontSize: 8.5, color: '#00e5ff', marginTop: 5 }}>{gpu.usage_pct.toFixed(1)}%</div>
        </div>
        <div className="panel" style={{ padding: '10px 12px' }}>
          <div className="sh">GPU POWER — 2min</div>
          <SparkLine data={pwrH} height={55} color="#ff8800" max={gpu.power_mw * 2 || 100} showGrid />
          <div style={{ fontSize: 8.5, color: '#ff8800', marginTop: 5 }}>{fmtPower(gpu.power_mw)}</div>
        </div>
      </div>

      {/* Engine breakdown */}
      <div className="panel" style={{ padding: '12px 14px' }}>
        <div className="sh">SHADER ENGINES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {engines.map(([name, val, color]) => (
            <div key={name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: 'var(--text-2)' }}>{name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color }}>{val.toFixed(1)}%</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                <motion.div animate={{ width: `${val}%` }}
                  transition={{ duration: 0.4 }}
                  style={{ height: '100%', background: `linear-gradient(90deg, ${color}cc, ${color})`,
                    borderRadius: 3, boxShadow: `0 0 8px ${color}50` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Memory usage */}
      <div className="panel" style={{ padding: '12px 14px' }}>
        <div className="sh">VRAM ALLOCATION</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <NeonGauge value={(gpu.memory_used_mb / Math.max(gpu.memory_total_mb, 1)) * 100}
            label="VRAM" size={88} color="#9966ff" unit="%" />
          <div style={{ flex: 1 }}>
            <div style={{ height: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
              <motion.div
                animate={{ width: `${(gpu.memory_used_mb / Math.max(gpu.memory_total_mb, 1)) * 100}%` }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #660099, #9966ff)', borderRadius: 6,
                  boxShadow: '0 0 12px rgba(153,102,255,0.5)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, color: '#9966ff' }}>{(gpu.memory_used_mb/1024).toFixed(1)} GB used</span>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{(gpu.memory_total_mb/1024).toFixed(0)} GB total</span>
            </div>
            <div style={{ fontSize: 9, color: '#00e5ff', marginTop: 5 }}>
              Bandwidth {gpu.memory_bandwidth_gbs.toFixed(0)} GB/s
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
