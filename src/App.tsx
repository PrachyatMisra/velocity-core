import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from './stores/telemetryStore';
import { useExtremeStore } from './stores/extremeStore';
import { TitleBar } from './components/TitleBar';
import { OverviewTab }    from './components/tabs/OverviewTab';
import { CpuTab }         from './components/tabs/CpuTab';
import { GpuTab }         from './components/tabs/GpuTab';
import { MemoryTab }      from './components/tabs/MemoryTab';
import { StorageTab }     from './components/tabs/StorageTab';
import { NetworkTab }     from './components/tabs/NetworkTab';
import { BatteryTab }     from './components/tabs/BatteryTab';
import { ProcessesTab }   from './components/tabs/ProcessesTab';
import { BenchmarkTab }   from './components/tabs/BenchmarkTab';
import { MaintenanceTab } from './components/tabs/MaintenanceTab';
import { AiTab }          from './components/tabs/AiTab';
import { SmcTab }         from './components/tabs/SmcTab';
import { HealingTab }     from './components/tabs/HealingTab';
import { AlertToast }     from './components/ui/AlertToast';
import { ExtremeOverlay } from './components/ExtremeMode';
import type { TelemetrySnapshot } from './types/telemetry';

const TABS: Record<string, React.ComponentType> = {
  overview: OverviewTab, cpu: CpuTab, gpu: GpuTab, memory: MemoryTab,
  storage: StorageTab, network: NetworkTab, battery: BatteryTab,
  processes: ProcessesTab, benchmark: BenchmarkTab, maintenance: MaintenanceTab,
  ai: AiTab, smc: SmcTab, healing: HealingTab,
};

// Cosmic particle background
function CosmicBg({ hot }: { hot: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame  = useRef(0);
  const t      = useRef(0);
  const hotRef = useRef(hot);
  hotRef.current = hot;

  useEffect(() => {
    const c = canvas.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    // Fixed particle field
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0002,
      r: Math.random() * 1.2 + 0.3,
      life: Math.random(),
    }));

    const draw = () => {
      t.current += 1;
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);

      // Deep void background
      const heat = hotRef.current;
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.7);
      bg.addColorStop(0, heat ? 'rgba(12,4,6,1)' : 'rgba(6,6,14,1)');
      bg.addColorStop(1, 'rgba(2,2,4,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Nebula glow
      const nebula = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W * 0.3, H * 0.4, W * 0.45);
      nebula.addColorStop(0, heat ? 'rgba(255,0,44,0.022)' : 'rgba(255,0,68,0.018)');
      nebula.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, W, H);
      const nb2 = ctx.createRadialGradient(W * 0.75, H * 0.6, 0, W * 0.75, H * 0.6, W * 0.35);
      nb2.addColorStop(0, 'rgba(0,100,255,0.010)');
      nb2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nb2;
      ctx.fillRect(0, 0, W, H);

      // Particles
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.life += 0.003;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
        const alpha = Math.sin(p.life * Math.PI) * 0.35 + 0.05;
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = heat ? `rgba(255,120,80,${alpha})` : `rgba(180,160,255,${alpha})`;
        ctx.fill();
      }

      // Subtle grid
      const gSize = 44;
      ctx.strokeStyle = heat ? 'rgba(255,0,44,0.012)' : 'rgba(255,0,68,0.010)';
      ctx.lineWidth = 0.5;
      const tx = (t.current * 0.15) % gSize;
      for (let x = -gSize + tx; x < W + gSize; x += gSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += gSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      frame.current = requestAnimationFrame(draw);
    };

    frame.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame.current); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas ref={canvas}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
  );
}

export default function App() {
  const { setSnapshot, activeTab } = useStore();
  const { extremeActive } = useExtremeStore();
  const thermal = useStore(s => s.snapshot?.throttle_risk?.level ?? 'nominal');
  const hot = extremeActive || thermal === 'critical' || thermal === 'emergency';

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<TelemetrySnapshot>('telemetry', e => setSnapshot(e.payload))
      .then(fn => { unlisten = fn; })
      .catch(console.error);
    return () => unlisten?.();
  }, [setSnapshot]);

  const ActiveTab = TABS[activeTab] ?? OverviewTab;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
      position: 'relative',
      filter: extremeActive ? 'hue-rotate(335deg) saturate(1.3)' : 'none',
      transition: 'filter 0.7s ease',
    }}>
      <CosmicBg hot={hot} />
      <div className="scanlines" />
      <div className="vignette" />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <TitleBar />
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.13, ease: 'easeOut' }}
            >
              <ActiveTab />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AlertToast />
      <ExtremeOverlay />
    </div>
  );
}
