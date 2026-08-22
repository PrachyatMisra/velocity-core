import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';
import { useExtremeStore } from '../stores/extremeStore';

// Stable canvas reactor — uses refs to avoid restart on prop change
function ReactorCanvas({ intensityRef, tempRef }: {
  intensityRef: React.MutableRefObject<number>;
  tempRef: React.MutableRefObject<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useRef(0);
  const tick  = useRef(0);

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const S = 220;
    cv.width = S; cv.height = S;
    const cx = S / 2, cy = S / 2;

    const particles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[] = [];

    const draw = () => {
      tick.current += 1;
      const t = tick.current * 0.016;
      const heat = Math.max(0.01, Math.min(1, intensityRef.current));
      const temp = tempRef.current;

      ctx.clearRect(0, 0, S, S);

      // BG
      ctx.fillStyle = 'rgba(4,0,0,0.96)';
      ctx.fillRect(0, 0, S, S);

      // Outer ambient glow
      const amb = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.6);
      amb.addColorStop(0, `rgba(255,0,0,${0.04 * heat})`);
      amb.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = amb;
      ctx.fillRect(0, 0, S, S);

      // Plasma rings (3 rings)
      for (let ring = 0; ring < 3; ring++) {
        const R = 30 + ring * 30;
        const segs = 20 + ring * 10;
        const dir = ring % 2 === 0 ? 1 : -1;
        for (let s = 0; s < segs; s++) {
          const a = (s / segs) * Math.PI * 2 + t * dir * (0.4 + ring * 0.2);
          const wobble = Math.sin(s * 0.9 + t * 2.8) * heat * 8;
          const px = cx + Math.cos(a) * (R + wobble);
          const py = cy + Math.sin(a) * (R + wobble);
          const sz = 1.5 + heat * 3.5;
          const alpha = 0.3 + heat * 0.6;
          ctx.fillStyle = `rgba(255,${Math.floor(30 - heat*30)},0,${alpha})`;
          ctx.beginPath();
          ctx.arc(px, py, sz, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Turbine blades
      const bladeSpeed = 1.2 + heat * 3;
      for (let b = 0; b < 6; b++) {
        const a = (b / 6) * Math.PI * 2 + t * bladeSpeed;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        const g = ctx.createLinearGradient(0, 0, 68, 0);
        g.addColorStop(0, `rgba(255,${Math.floor(40 - heat * 40)},0,0.95)`);
        g.addColorStop(0.6, `rgba(200,0,0,0.4)`);
        g.addColorStop(1, 'rgba(140,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(20, -(5 + heat*6), 55, -(2+heat*4), 68, 0);
        ctx.bezierCurveTo(55, (2+heat*4), 20, (5+heat*6), 0, 0);
        ctx.fill();
        ctx.restore();
      }

      // Eject particles when hot
      if (heat > 0.3 && Math.random() < heat * 0.6) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * (40 + Math.random() * 80) / 60,
          vy: Math.sin(angle) * (40 + Math.random() * 80) / 60,
          life: 0, maxLife: 30 + Math.random() * 40,
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life++;
        p.vx *= 0.98; p.vy *= 0.98;
        if (p.life > p.maxLife) { particles.splice(i, 1); continue; }
        const alpha = (1 - p.life / p.maxLife) * 0.7;
        ctx.fillStyle = `rgba(255,${Math.floor(80 * (1-p.life/p.maxLife))},0,${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core pulse
      const pulse = 1 + Math.sin(t * (4 + heat * 8)) * 0.10 * heat;
      const coreR = (16 + heat * 22) * pulse;

      const outer = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
      outer.addColorStop(0, `rgba(255,30,0,${0.5 * heat})`);
      outer.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = outer;
      ctx.beginPath(); ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2); ctx.fill();

      const core = ctx.createRadialGradient(cx - coreR*0.2, cy - coreR*0.2, 0, cx, cy, coreR);
      core.addColorStop(0, `rgba(255,${Math.floor(200 - heat*200)},${Math.floor(100-heat*100)},1)`);
      core.addColorStop(0.4, `rgba(255,${Math.floor(60-heat*60)},0,0.9)`);
      core.addColorStop(1, `rgba(${Math.floor(120-heat*40)},0,0,0.3)`);
      ctx.shadowColor = `rgba(255,0,0,${0.7*heat})`;
      ctx.shadowBlur = 20 + heat * 25;
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Temp label
      ctx.fillStyle = `rgba(255,${Math.floor(80-heat*80)},0,0.85)`;
      ctx.font = `bold 11px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${temp.toFixed(0)}°C`, cx, cy + coreR + 19);

      frame.current = requestAnimationFrame(draw);
    };

    frame.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame.current);
  }, []); // Stable — uses refs

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 12 }} />;
}

function WarningModal({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  const [cd, setCd] = useState(5);
  useEffect(() => {
    if (cd <= 0) return;
    const id = setTimeout(() => setCd(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cd]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 24 }}
        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
        style={{
          width: 490, padding: '28px 30px',
          background: 'linear-gradient(150deg, rgba(14,2,2,0.99), rgba(8,0,0,0.99))',
          border: '1px solid rgba(255,0,0,0.42)',
          borderRadius: 16,
          boxShadow: '0 0 60px rgba(255,0,0,0.22), 0 24px 80px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <motion.div
            animate={{ scale: [1, 1.07, 1] }} transition={{ duration: 0.85, repeat: Infinity }}
            style={{ fontSize: 40, marginBottom: 12, lineHeight: 1 }}>⚠️</motion.div>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#ff0000', letterSpacing: '0.18em' }}>
            EXTREME MODE
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,80,80,0.6)', marginTop: 5, letterSpacing: '0.12em' }}>
            MAXIMUM PERFORMANCE · THERMAL OVERRIDE
          </div>
        </div>

        <div style={{
          background: 'rgba(255,0,0,0.055)', border: '1px solid rgba(255,0,0,0.18)',
          borderRadius: 8, padding: '13px 15px', marginBottom: 22,
          fontSize: 10, color: 'rgba(255,130,130,0.9)', lineHeight: 1.8,
        }}>
          <div style={{ fontWeight: 700, color: '#ff4040', marginBottom: 6, fontSize: 9, letterSpacing: '0.10em' }}>
            ACKNOWLEDGEMENT REQUIRED:
          </div>
          <div>◈ Fan curves maximized to 100% RPM</div>
          <div>◈ CPU/GPU at sustained peak thermal limits</div>
          <div>◈ Sleep disabled for session duration</div>
          <div>◈ Prolonged use accelerates hardware wear</div>
          <div style={{ marginTop: 8, fontSize: 8.5, color: 'rgba(255,60,60,0.45)' }}>
            Hardware protection circuits remain active. For benchmarking use only.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onDecline}
            style={{
              flex: 1, padding: '10px 0', fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.4)', borderRadius: 7, cursor: 'pointer',
            }}>CANCEL</button>
          <motion.button
            onClick={cd <= 0 ? onAccept : undefined} disabled={cd > 0}
            animate={cd <= 0 ? {
              boxShadow: ['0 0 6px rgba(255,0,0,0.3)', '0 0 24px rgba(255,0,0,0.7)', '0 0 6px rgba(255,0,0,0.3)']
            } : {}}
            transition={{ duration: 1.0, repeat: Infinity }}
            style={{
              flex: 1, padding: '10px 0', fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
              background: cd > 0 ? 'rgba(60,0,0,0.3)' : 'rgba(160,0,0,0.25)',
              border: `1px solid ${cd > 0 ? 'rgba(100,0,0,0.35)' : 'rgba(255,0,0,0.52)'}`,
              color: cd > 0 ? 'rgba(180,0,0,0.45)' : '#ff0000',
              borderRadius: 7, cursor: cd > 0 ? 'not-allowed' : 'pointer',
            }}>
            {cd > 0 ? `ENGAGE IN ${cd}s` : '🔴 ENGAGE EXTREME'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ExtremeOverlay() {
  const { extremeActive, reactorIntensity, cpuTempC, fanRpms } = useExtremeStore();
  const intRef  = useRef(reactorIntensity);
  const tempRef = useRef(cpuTempC);
  intRef.current  = reactorIntensity;
  tempRef.current = cpuTempC;

  return (
    <AnimatePresence>
      {extremeActive && (
        <motion.div key="reactor"
          initial={{ opacity: 0, scale: 0.8, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.75, x: 20 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          style={{
            position: 'fixed', bottom: 18, right: 18,
            width: 220, height: 220, zIndex: 9990,
            borderRadius: 14, overflow: 'hidden',
            border: '1px solid rgba(255,0,0,0.4)',
            boxShadow: '0 0 30px rgba(255,0,0,0.25), 0 8px 40px rgba(0,0,0,0.7)',
          }}
        >
          <ReactorCanvas intensityRef={intRef} tempRef={tempRef} />
          {fanRpms.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 5, left: 0, right: 0, textAlign: 'center',
              fontSize: 8, color: 'rgba(255,90,0,0.7)',
              letterSpacing: '0.08em',
            }}>
              {fanRpms.map(r => `${r}rpm`).join(' · ')}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ExtremeModeToggle() {
  const store = useExtremeStore();
  const [showWarning, setShowWarning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const activate = useCallback(async () => {
    try {
      await invoke('activate_extreme_mode');
      store.setExtremeActive(true);
      store.setAcknowledged(true);
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      const poll = async () => {
        try {
          const d = await invoke<{ reactor_intensity: number; cpu_temp_c: number; fan_rpms: number[] }>('get_extreme_telemetry');
          store.setReactorData(d.reactor_intensity, d.cpu_temp_c, d.fan_rpms);
        } catch { /* */ }
      };
      await poll();
      pollRef.current = setInterval(async () => {
        await poll();
      }, 2000);
    } catch (e) { console.error(e); }
  }, [store]);

  const deactivate = useCallback(async () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    try { await invoke('deactivate_extreme_mode'); } catch { /* */ }
    store.setExtremeActive(false);
    store.setReactorData(0, 50, []);
  }, [store]);

  const toggle = () => {
    if (store.extremeActive) { deactivate(); return; }
    if (!store.acknowledged) { setShowWarning(true); return; }
    activate();
  };

  return (
    <>
      <AnimatePresence>
        {showWarning && (
          <WarningModal
            onAccept={() => { setShowWarning(false); activate(); }}
            onDecline={() => setShowWarning(false)}
          />
        )}
      </AnimatePresence>

      <motion.button
        onClick={toggle}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.93 }}
        animate={store.extremeActive ? {
          boxShadow: ['0 0 6px rgba(255,0,0,0.3)', '0 0 18px rgba(255,0,0,0.7)', '0 0 6px rgba(255,0,0,0.3)'],
        } : {}}
        transition={store.extremeActive ? { duration: 1.1, repeat: Infinity } : undefined}
        style={{
          padding: '4px 12px', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em',
          background: store.extremeActive ? 'rgba(160,0,0,0.25)' : 'rgba(255,0,0,0.05)',
          border: `1px solid ${store.extremeActive ? 'rgba(255,0,0,0.52)' : 'rgba(255,0,0,0.16)'}`,
          color: store.extremeActive ? '#ff0000' : 'rgba(255,0,0,0.4)',
          borderRadius: 5, cursor: 'pointer', flexShrink: 0,
          transition: 'background 0.3s, border-color 0.3s, color 0.3s',
        }}
      >
        {store.extremeActive ? '🔴 EXTREME' : 'EXTREME'}
      </motion.button>
    </>
  );
}
