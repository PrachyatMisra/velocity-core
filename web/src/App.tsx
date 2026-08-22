import { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import './App.css';

import LazySpline from './components/LazySpline';
import DarkModeToggle from './components/DarkModeToggle';

/* ─── Animated counter hook ─── */
function useCounter(end: number, duration = 2000, inView: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = end / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= end) { setVal(end); clearInterval(id); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(id);
  }, [end, duration, inView]);
  return val;
}

/* ─── Particle background ─── */
function ParticleBg() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0002,
      vy: (Math.random() - 0.5) * 0.0002,
      r: Math.random() * 1.2 + 0.3,
      alpha: Math.random() * 0.3 + 0.05,
    }));
    let frame = 0;
    const draw = () => {
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,120,160,${p.alpha})`;
        ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvas} className="particle-canvas" />;
}



/* ─── Nav ─── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <motion.nav
      className={`nav ${scrolled ? 'nav-scrolled' : ''}`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="nav-inner">
        <div className="nav-brand">
          <div className="nav-logo">
            <span className="nav-logo-icon">⚡</span>
          </div>
          <span className="nav-name">VELOCITY<span className="gradient-text">CORE</span></span>
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#performance">Performance</a>
          <a href="#download">Download</a>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="btn-secondary nav-btn">
            GitHub ↗
          </a>
        </div>
      </div>
    </motion.nav>
  );
}

/* ─── Hero Section ─── */
function Hero() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 0.3], [0, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  return (
    <section className="hero">
      <ParticleBg />
      <div className="hero-glow" />

      <motion.div className="hero-content" style={{ y, opacity }}>
        <motion.div
          className="hero-badge"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
        >
          <span className="badge-dot" />
          v3.0.0 — Available Now
        </motion.div>

        <motion.h1
          className="hero-title"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          System Intelligence<br />
          <span className="gradient-text">Redefined.</span>
        </motion.h1>

        <motion.p
          className="hero-sub"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.7 }}
        >
          The most advanced macOS system monitor, benchmarker, and AI diagnostic
          platform — engineered for Apple Silicon in 2026.
        </motion.p>

        <motion.div
          className="hero-actions"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <a href="#download" className="btn-primary">
            <span>↓</span> Download for macOS
          </a>
          <a href="#features" className="btn-secondary">
            Explore Features →
          </a>
        </motion.div>
      </motion.div>

                <LazySpline scene="https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode" />

      <div className="hero-scroll-indicator">
        <motion.div
          className="scroll-dot"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
    </section>
  );
}

/* ─── Feature Card ─── */
function FeatureCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      className="glass-card feature-card"
      initial={{ y: 40, opacity: 0 }}
      animate={inView ? { y: 0, opacity: 1 } : {}}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="feature-icon">{icon}</div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{desc}</p>
    </motion.div>
  );
}

/* ─── Features Section ─── */
function Features() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  const features = [
    { icon: '🧠', title: 'AI Diagnostics', desc: 'Python-powered sidecar engine runs anomaly detection, thermal forecasting, and system fingerprinting — all locally, zero network.' },
    { icon: '⚡', title: 'Real-Time Telemetry', desc: '500ms polling interval across 9 subsystems: CPU, GPU, Memory, Thermal, Battery, Storage, Network, Process, and SMC.' },
    { icon: '🔥', title: 'Extreme Mode', desc: 'Push your Mac to the absolute limit with dedicated stress testing, caffeinate integration, and reactor-grade thermal monitoring.' },
    { icon: '📊', title: 'Benchmarking Suite', desc: 'CPU Integer, Float, Crypto, Compression, Memory Bandwidth, Disk Sequential/Random 4K — validated against Geekbench & Novabench baselines.' },
    { icon: '🛡️', title: 'Self-Healing', desc: 'Automatically diagnoses memory pressure, legacy kexts, disk space, Rosetta overhead, swap usage — with one-click remediation actions.' },
    { icon: '🧹', title: 'Deep Maintenance', desc: 'Identifies 13+ cleaning targets — Xcode DerivedData, Simulator Devices, Homebrew/npm/pip caches, Trash — safely reclaim gigabytes.' },
  ];

  return (
    <section id="features" className="section" ref={ref}>
      <div className="section-inner">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={inView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className="section-label">Features</div>
          <h2 className="section-title">
            Every metric.<br />
            <span className="gradient-text">Every insight.</span>
          </h2>
          <p className="section-sub">
            13 dedicated tabs, 19 IPC commands, and 9 telemetry subsystems — all running natively on Apple Silicon with Rust + Tauri v2.
          </p>
        </motion.div>

        <div className="feature-grid" style={{ marginTop: '3rem' }}>
          {features.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Performance Stats ─── */
function Stats() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  const stats = [
    { value: 19, suffix: '', label: 'IPC Commands' },
    { value: 13, suffix: '', label: 'UI Tabs' },
    { value: 500, suffix: 'ms', label: 'Polling Interval' },
    { value: 255, suffix: 'MB', label: 'App Bundle' },
  ];

  return (
    <section id="performance" className="section" ref={ref}>
      <div className="section-inner">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={inView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className="section-label">Performance</div>
          <h2 className="section-title">
            Built for <span className="gradient-text">speed.</span>
          </h2>
        </motion.div>

        <div className="stats-grid" style={{ marginTop: '3rem' }}>
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              className="glass-card stat-card"
              initial={{ y: 30, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ delay: i * 0.12, duration: 0.5 }}
            >
              <div className="stat-value gradient-text">
                <Counter end={s.value} inView={inView} />{s.suffix}
              </div>
              <div className="stat-label">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Tech stack */}
        <div className="tech-stack" style={{ marginTop: '4rem' }}>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={inView ? { y: 0, opacity: 1 } : {}}
            transition={{ delay: 0.5 }}
          >
            <div className="section-label">Tech Stack</div>
            <div className="tech-pills">
              {['Rust 1.91', 'Tauri v2', 'React 19', 'TypeScript 5.5', 'Python 3.11', 'Apple Silicon', 'Zustand', 'Tokio'].map(t => (
                <span key={t} className="tech-pill">{t}</span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Counter({ end, inView }: { end: number; inView: boolean }) {
  const val = useCounter(end, 1500, inView);
  return <>{val}</>;
}

/* ─── Architecture Section ─── */
function Architecture() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  const layers = [
    { name: 'Frontend', tech: 'React 19 + TypeScript 5.5', desc: '13 tabs, Zustand state, Framer Motion, Recharts', color: '#ff1744' },
    { name: 'IPC Bridge', tech: 'Tauri v2 Invoke Handler', desc: '19 registered commands with serde serialization', color: '#e91e63' },
    { name: 'Backend', tech: 'Rust + parking_lot + tokio', desc: 'TelemetryEngine, panic recovery, RwLock state', color: '#ff6e40' },
    { name: 'System Layer', tech: 'IOKit + sysctl + SMC', desc: 'CPU/GPU/Memory/Thermal/Battery/Storage/Network', color: '#ff9100' },
    { name: 'AI Sidecar', tech: 'Python 3.11 + PyInstaller', desc: 'Anomaly detection, thermal forecast, fingerprinting', color: '#ffab40' },
  ];

  return (
    <section className="section" ref={ref}>
      <div className="section-inner">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={inView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className="section-label">Architecture</div>
          <h2 className="section-title">
            5-layer <span className="gradient-text">engine.</span>
          </h2>
        </motion.div>

        <div className="arch-stack" style={{ marginTop: '3rem' }}>
          {layers.map((l, i) => (
            <motion.div
              key={l.name}
              className="glass-card arch-layer"
              initial={{ x: -40, opacity: 0 }}
              animate={inView ? { x: 0, opacity: 1 } : {}}
              transition={{ delay: i * 0.1 + 0.2, duration: 0.5 }}
            >
              <div className="arch-indicator" style={{ background: l.color }} />
              <div className="arch-info">
                <h4>{l.name}</h4>
                <code className="mono">{l.tech}</code>
                <p>{l.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Download Section ─── */
function Download() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="download" className="section download-section" ref={ref}>
      <div className="section-inner" style={{ textAlign: 'center' }}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={inView ? { scale: 1, opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          <div className="download-glow" />
          <div className="section-label" style={{ justifyContent: 'center' }}>Download</div>
          <h2 className="section-title" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>
            Ready to <span className="gradient-text">accelerate?</span>
          </h2>
          <p className="section-sub" style={{ maxWidth: 500, margin: '1rem auto 2rem' }}>
            VelocityCore v3.0.0 is available for macOS 13+ with native Apple Silicon support.
          </p>

          <div className="download-actions">
              <a href="/download/VelocityCore.dmg" className="btn-primary">
                <span>⬇</span> Download for macOS
                <span className="download-size">255 MB</span>
              </a>
          </div>

          <div className="download-meta">
            <span>macOS 13+ required</span>
            <span>•</span>
            <span>Apple Silicon native</span>
            <span>•</span>
            <span>v3.0.0</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="footer">
      <div className="section-inner">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="nav-logo-icon">⚡</span>
            <span>VELOCITY<span className="gradient-text">CORE</span></span>
          </div>
          <p className="footer-copy">
            © 2026 VelocityCore. Built with Rust, React, and obsessive attention to detail.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── App ─── */
export default function App() {
  return (
    <div className="app"><DarkModeToggle />
        <div className="nebula-bg"></div>
      <div className="scanline-overlay" />
      <Nav />
      <Hero />
      <Features />
      <Stats />
      <Architecture />
      <Download />
      <Footer />
    </div>
  );
}
