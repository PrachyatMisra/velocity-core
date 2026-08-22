import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTelemetry, useHistory, fmtTemp, fmtTime } from '../../hooks/useTelemetry';
import { SparkLine } from '../ui/SparkLine';

interface BatteryPrediction {
  current_health_pct: number;
  predicted_12m_pct: number;
  predicted_24m_pct: number;
  cycles_per_month_est: number;
  months_to_80pct: number | null;
  replacement_urgency: string;
  monthly_degradation: [number, number][];
}

function WaveCanvas({ chargePct, charging, condition }: { chargePct: number; charging: boolean; condition: string }) {
  const ref   = useRef<HTMLCanvasElement>(null);
  const frame = useRef(0);
  const phase = useRef(0);
  const lvlRef = useRef(chargePct / 100);
  const ok = condition === 'Normal';

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const W = 240, H = 360;
    cv.width = W; cv.height = H;
    const BW = 130, BH = 260, BX = (W - BW) / 2, BY = 50;

    const c1 = ok ? '#00ff7f' : '#ff8800';

    const draw = () => {
      phase.current += charging ? 0.055 : 0.022;
      const target = chargePct / 100;
      lvlRef.current += (target - lvlRef.current) * 0.04;
      const lv = lvlRef.current;
      const p  = phase.current;

      ctx.clearRect(0, 0, W, H);

      // Battery outline glow
      ctx.save();
      ctx.shadowColor = c1;
      ctx.shadowBlur  = 16 * lv;
      ctx.strokeStyle = `rgba(${ok ? '0,255,127' : '255,136,0'},${0.4 + lv * 0.4})`;
      ctx.lineWidth   = 2;
      ctx.strokeRect(BX, BY, BW, BH);
      // Nub
      const nubW = 32, nubH = 12;
      ctx.strokeRect(BX + (BW - nubW) / 2, BY - nubH, nubW, nubH);
      ctx.restore();

      // Clip to battery interior
      ctx.save();
      ctx.beginPath();
      ctx.rect(BX + 1, BY + 1, BW - 2, BH - 2);
      ctx.clip();

      // BG
      ctx.fillStyle = 'rgba(4,4,12,0.95)';
      ctx.fillRect(BX, BY, BW, BH);

      // Fill level
      const fillY = BY + BH * (1 - lv);

      // Wave 1
      ctx.beginPath();
      ctx.moveTo(BX, BY + BH);
      for (let x = 0; x <= BW; x++) {
        const y = fillY + Math.sin((x / BW) * Math.PI * 3 + p) * 8 * (1 - lv * 0.5);
        ctx.lineTo(BX + x, y);
      }
      ctx.lineTo(BX + BW, BY + BH);
      ctx.closePath();
      const g1 = ctx.createLinearGradient(0, fillY, 0, BY + BH);
      g1.addColorStop(0, ok ? `rgba(0,200,100,0.7)` : `rgba(255,100,0,0.7)`);
      g1.addColorStop(1, ok ? `rgba(0,120,60,0.9)`  : `rgba(200,60,0,0.9)`);
      ctx.fillStyle = g1;
      ctx.fill();

      // Wave 2 (offset)
      ctx.beginPath();
      ctx.moveTo(BX, BY + BH);
      for (let x = 0; x <= BW; x++) {
        const y = fillY + 4 + Math.sin((x / BW) * Math.PI * 2.5 + p * 1.3 + 1.2) * 6 * (1 - lv * 0.4);
        ctx.lineTo(BX + x, y);
      }
      ctx.lineTo(BX + BW, BY + BH);
      ctx.closePath();
      ctx.fillStyle = ok ? `rgba(0,160,80,0.35)` : `rgba(200,80,0,0.35)`;
      ctx.fill();

      ctx.restore();

      // Charge % text
      ctx.fillStyle = '#fff';
      ctx.font = `bold 32px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${chargePct.toFixed(0)}%`, W / 2, BY + BH / 2 + 12);

      // Charging bolt
      if (charging) {
        const pulse = 0.7 + Math.sin(p * 4) * 0.3;
        ctx.fillStyle = `rgba(255,255,0,${pulse})`;
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 12;
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('⚡', W / 2, BY + BH / 2 - 20);
        ctx.shadowBlur = 0;
      }

      frame.current = requestAnimationFrame(draw);
    };

    frame.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame.current);
  }, [chargePct, charging, condition]);

  return <canvas ref={ref} style={{ width: 240, height: 360, display: 'block' }} />;
}

export function BatteryTab() {
  const snap    = useTelemetry();
  const voltH   = useHistory('battery.voltage_mv', 120);
  const [prediction, setPrediction] = useState<BatteryPrediction | null>(null);

  useEffect(() => {
    if (!snap?.battery.present) return;
    const b = snap.battery;
    invoke<BatteryPrediction>('predict_battery_life', {
      health_pct: b.health_pct,
      cycle_count: b.cycle_count,
      design_capacity_mah: b.design_capacity_mah,
    }).then(r => setPrediction(r)).catch(() => {});
  }, [snap?.battery?.health_pct, snap?.battery?.cycle_count, snap?.battery?.design_capacity_mah, snap?.battery?.present]);

  if (!snap) return null;
  const { battery } = snap;

  if (!battery.present) return (
    <div style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70%', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 48 }}>🔌</div>
      <div style={{ fontSize: 11, color: 'var(--text-2)', letterSpacing: '0.14em' }}>NO BATTERY DETECTED</div>
      <div style={{ fontSize: 9, color: 'var(--text-3)' }}>Desktop or clamshell with AC power</div>
    </div>
  );

  const hColor = battery.health_pct < 70 ? '#ff0044' : battery.health_pct < 80 ? '#ff8800' : '#00ff7f';
  const cColor = battery.charge_pct  < 20 ? '#ff0044' : battery.charging ? '#00ff7f' : '#00e5ff';

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 10, alignItems: 'start' }}>

        {/* Wave battery visual */}
        <div className="panel" style={{ padding: '10px', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
          <WaveCanvas chargePct={battery.charge_pct} charging={battery.charging} condition={battery.condition} />
        </div>

        {/* Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="panel" style={{ padding: '12px 14px' }}>
            <div className="sh">STATUS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['CHARGE',    `${battery.charge_pct.toFixed(0)}%`,              cColor],
                ['HEALTH',    `${battery.health_pct.toFixed(0)}%`,              hColor],
                ['CONDITION', battery.condition,                                 battery.condition === 'Normal' ? '#00ff7f' : '#ff8800'],
                ['STATUS',    battery.charging ? 'CHARGING ⚡' : 'DISCHARGING', battery.charging ? '#00ff7f' : '#ff8800'],
                ['CYCLES',    battery.cycle_count.toString(),                    battery.cycle_count > 800 ? '#ff8800' : 'var(--text-1)'],
                ['POWER',     `${battery.power_watts.toFixed(1)} W`,             '#00e5ff'],
              ].map(([k, v, c]) => (
                <div key={k as string} style={{ padding: '7px 9px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 7.5, color: 'var(--text-3)', letterSpacing: '0.10em' }}>{k as string}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c as string, marginTop: 2 }}>{v as string}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ padding: '12px 14px' }}>
            <div className="sh">CAPACITY</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                ['Current Max', battery.max_capacity_mah, battery.design_capacity_mah, '#00e5ff'],
                ['Current',     battery.current_capacity_mah, battery.max_capacity_mah, hColor],
              ].map(([k, v, max, c]) => (
                <div key={k as string}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 8.5, color: 'var(--text-3)' }}>{k as string}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: c as string }}>
                      {(v as number).toLocaleString()} / {(max as number).toLocaleString()} mAh
                    </span>
                  </div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                    <motion.div animate={{ width: `${((v as number) / Math.max(max as number, 1)) * 100}%` }}
                      style={{ height: '100%', background: c as string, borderRadius: 3, boxShadow: `0 0 6px ${c as string}60` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {battery.time_remaining_min && (
            <div className="panel" style={{ padding: '10px 14px' }}>
              <div className="sh">TIME REMAINING</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: cColor }}>
                {fmtTime(battery.time_remaining_min)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Health prediction */}
      {prediction && (
        <div className="panel" style={{ padding: '12px 14px' }}>
          <div className="sh">HEALTH FORECAST — 24 months</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 7.5, color: 'var(--text-3)', marginBottom: 2 }}>12M FORECAST</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: prediction.predicted_12m_pct < 80 ? '#ff8800' : '#00ff7f' }}>
                {prediction.predicted_12m_pct.toFixed(0)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 7.5, color: 'var(--text-3)', marginBottom: 2 }}>24M FORECAST</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: prediction.predicted_24m_pct < 80 ? '#ff0044' : '#ff8800' }}>
                {prediction.predicted_24m_pct.toFixed(0)}%
              </div>
            </div>
            <div style={{ flex: 1, padding: '8px 12px', borderRadius: 6, background: 'rgba(255,170,0,0.06)', border: '1px solid rgba(255,170,0,0.14)' }}>
              <div style={{ fontSize: 7.5, color: 'var(--text-3)', marginBottom: 2 }}>RECOMMENDATION</div>
              <div style={{ fontSize: 9, color: '#ffaa00', lineHeight: 1.5 }}>{prediction.replacement_urgency}</div>
            </div>
          </div>
          {/* Mini degradation chart */}
          <SparkLine
            data={prediction.monthly_degradation.map(([,v]) => v)}
            height={44} color={hColor} max={100} min={50} showGrid />
        </div>
      )}

      {/* Electrical */}
      <div className="panel" style={{ padding: '12px 14px' }}>
        <div className="sh">ELECTRICAL</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[
            ['VOLTAGE',    `${(battery.voltage_mv / 1000).toFixed(2)} V`,  '#00e5ff'],
            ['AMPERAGE',   `${battery.amperage_ma} mA`,                     battery.amperage_ma < 0 ? '#ff8800' : '#00ff7f'],
            ['TEMPERATURE', fmtTemp(battery.temperature_c),                  battery.temperature_c > 40 ? '#ff8800' : 'var(--text-1)'],
            ['OPTIMIZED',  battery.optimized_charging ? 'ON' : 'OFF',        battery.optimized_charging ? '#00ff7f' : 'var(--text-3)'],
          ].map(([k, v, c]) => (
            <div key={k as string} style={{ padding: '7px 9px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 7, color: 'var(--text-3)', letterSpacing: '0.10em' }}>{k as string}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: c as string, marginTop: 2 }}>{v as string}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
