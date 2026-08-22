import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

class SplineErrorBoundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('Spline load error, switching to interactive canvas fallback:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function SiliconCoreCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 500);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 500);

    const onResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', onResize);

    const rings = [
      { radius: 120, speed: 0.008, color: 'rgba(255, 23, 68, 0.7)', dots: 24 },
      { radius: 170, speed: -0.005, color: 'rgba(255, 110, 64, 0.6)', dots: 36 },
      { radius: 220, speed: 0.003, color: 'rgba(233, 30, 99, 0.5)', dots: 48 },
    ];

    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;

      // Glow center
      const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, 180);
      gradient.addColorStop(0, 'rgba(255, 23, 68, 0.25)');
      gradient.addColorStop(0.5, 'rgba(255, 110, 64, 0.08)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, 180, 0, Math.PI * 2);
      ctx.fill();

      // Center core
      ctx.beginPath();
      ctx.arc(cx, cy, 35 + Math.sin(angle * 3) * 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 23, 68, 0.9)';
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 25;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Orbital rings & nodes
      rings.forEach((ring, idx) => {
        const currentAngle = angle * (ring.speed / 0.005);
        ctx.beginPath();
        ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color.replace('0.7', '0.2').replace('0.6', '0.15').replace('0.5', '0.1');
        ctx.lineWidth = 1.5;
        ctx.stroke();

        for (let i = 0; i < ring.dots; i++) {
          const theta = currentAngle + (i * (Math.PI * 2)) / ring.dots;
          const x = cx + Math.cos(theta) * ring.radius;
          const y = cy + Math.sin(theta) * ring.radius;

          ctx.beginPath();
          ctx.arc(x, y, (idx === 0 ? 3 : 2.2), 0, Math.PI * 2);
          ctx.fillStyle = ring.color;
          ctx.fill();
        }
      });

      angle += 0.015;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', maxWidth: '600px', maxHeight: '600px' }} />
    </div>
  );
}

const LazySpline = (props: { scene: string }) => {
  const [loadSpline, setLoadSpline] = useState(true);

  useEffect(() => {
    // Timeout to ensure fast rendering if 3D remote takes > 4s
    const timer = setTimeout(() => {
      // Keep trying, but fallback will show if needed
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="hero-spline">
      <SplineErrorBoundary fallback={<SiliconCoreCanvas />}>
        {loadSpline ? (
          <Suspense fallback={<SiliconCoreCanvas />}>
            <Spline scene={props.scene} onError={() => setLoadSpline(false)} />
          </Suspense>
        ) : (
          <SiliconCoreCanvas />
        )}
      </SplineErrorBoundary>
    </div>
  );
};

export default LazySpline;
