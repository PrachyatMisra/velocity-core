import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTelemetry, useHistory, fmtBps, fmtBytes } from '../../hooks/useTelemetry';
import { SparkLine } from '../ui/SparkLine';
import type { NetworkInterface } from '../../types/telemetry';

function SignalBar({ rssi }: { rssi: number }) {
  const pct = rssi === 0 ? 0 : Math.max(0, Math.min(100, ((rssi + 100) / 70) * 100));
  const color = pct > 60 ? '#00ff7f' : pct > 30 ? '#ffaa00' : '#ff0044';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16 }}>
      {[4, 8, 12, 16].map((h, i) => (
        <div key={i} style={{
          width: 4, height: h, borderRadius: 1,
          background: pct > (i + 1) * 22 ? color : 'rgba(255,255,255,0.08)',
          boxShadow: pct > (i + 1) * 22 ? `0 0 4px ${color}` : 'none',
        }} />
      ))}
      <span style={{ fontSize: 8, color, marginLeft: 4 }}>{rssi}dBm</span>
    </div>
  );
}

// Animated network topology
function TopoCanvas({ interfaces }: { interfaces: NetworkInterface[] }) {
  const ref  = useRef<HTMLCanvasElement>(null);
  const fr   = useRef(0);
  const tick = useRef(0);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const W = cv.width = cv.offsetWidth || 400;
    const H = cv.height = 160;
    const cx = W / 2, cy = H / 2;
    const ifaces = interfaces.filter(i => i.kind !== 'loopback').slice(0, 6);

    // Particles
    const packets: { x: number; y: number; tx: number; ty: number; p: number; c: string }[] = [];

    const draw = () => {
      tick.current += 1;
      const t = tick.current * 0.02;
      ctx.clearRect(0, 0, W, H);

      // BG
      ctx.fillStyle = 'rgba(4,4,12,0.0)';
      ctx.fillRect(0, 0, W, H);

      ifaces.forEach((iface, i) => {
        const angle = (i / ifaces.length) * Math.PI * 2 - Math.PI / 2;
        const r = Math.min(W, H) * 0.36;
        const nx = cx + Math.cos(angle) * r;
        const ny = cy + Math.sin(angle) * r;
        const active = iface.rx_bps > 1000 || iface.tx_bps > 1000;

        // Connection line
        const grad = ctx.createLinearGradient(cx, cy, nx, ny);
        grad.addColorStop(0, `rgba(0,229,255,${active ? 0.3 : 0.08})`);
        grad.addColorStop(1, `rgba(255,0,68,${active ? 0.15 : 0.04})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = active ? 1.2 : 0.6;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke();

        // Node
        ctx.beginPath();
        ctx.arc(nx, ny, active ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${active ? '0,229,255' : '100,100,150'},${active ? 0.9 : 0.3})`;
        ctx.fill();
        if (active) {
          ctx.shadowColor = '#00e5ff';
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Label
        ctx.fillStyle = active ? 'rgba(200,220,255,0.9)' : 'rgba(100,100,150,0.5)';
        ctx.font = `600 9px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(iface.name, nx, ny + 18);

        // Spawn packets
        if (active && Math.random() < 0.15) {
          packets.push({ x: cx, y: cy, tx: nx, ty: ny, p: 0, c: iface.rx_bps > iface.tx_bps ? '#00e5ff' : '#ff0044' });
        }
      });

      // Center hub
      const pulse = 0.85 + Math.sin(t * 3) * 0.08;
      ctx.beginPath();
      ctx.arc(cx, cy, 16 * pulse, 0, Math.PI * 2);
      const hubGrad = ctx.createRadialGradient(cx-4, cy-4, 0, cx, cy, 16);
      hubGrad.addColorStop(0, 'rgba(255,0,68,0.9)');
      hubGrad.addColorStop(1, 'rgba(180,0,40,0.5)');
      ctx.fillStyle = hubGrad;
      ctx.shadowColor = 'rgba(255,0,68,0.6)';
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const pk = packets[i];
        pk.p += 0.04;
        if (pk.p > 1) { packets.splice(i, 1); continue; }
        const x = pk.x + (pk.tx - pk.x) * pk.p;
        const y = pk.y + (pk.ty - pk.y) * pk.p;
        const alpha = Math.sin(pk.p * Math.PI);
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = pk.c.replace(')', `,${alpha})`).replace('rgb', 'rgba');
        ctx.shadowColor = pk.c;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      fr.current = requestAnimationFrame(draw);
    };

    fr.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(fr.current);
  }, [interfaces.length]);

  return (
    <canvas ref={ref}
      style={{ width: '100%', height: 160, display: 'block', borderRadius: 6 }} />
  );
}

export function NetworkTab() {
  const snap = useTelemetry();
  const rxH  = useHistory('network.total_rx_bps', 120);
  const txH  = useHistory('network.total_tx_bps', 120);
  if (!snap) return null;
  const { network } = snap;
  const active = network.interfaces.filter(i => i.kind !== 'loopback');

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Hero throughput */}
      <div className="panel" style={{ padding: '12px 14px' }}>
        <div className="sh">NETWORK THROUGHPUT</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
          {[
            { label: 'DOWNLOAD ↓', bps: network.total_rx_bps, data: rxH, color: '#00e5ff' },
            { label: 'UPLOAD ↑',   bps: network.total_tx_bps, data: txH, color: '#ff0044' },
          ].map(ch => (
            <div key={ch.label}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: ch.color, lineHeight: 1 }}>
                  {fmtBps(ch.bps)}
                </span>
                <span style={{ fontSize: 8.5, color: 'var(--text-3)' }}>{ch.label}</span>
              </div>
              <SparkLine data={ch.data} height={50} color={ch.color} showGrid
                max={Math.max(...ch.data, 1) * 1.3} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 8.5, color: 'var(--text-3)' }}>
          <span>TCP: {network.tcp_connections}</span>
          <span>UDP: {network.udp_connections}</span>
        </div>
      </div>

      {/* Topology */}
      {active.length > 0 && (
        <div className="panel" style={{ padding: '12px 14px', overflow: 'hidden' }}>
          <div className="sh">TOPOLOGY</div>
          <TopoCanvas interfaces={active} />
        </div>
      )}

      {/* Interface cards */}
      {active.map((iface, i) => (
        <motion.div key={iface.name}
          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="panel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span className={`badge ${iface.rx_bps > 1000 ? 'b-cyan' : 'b-ghost'}`}>{iface.name}</span>
                <span style={{ fontSize: 8.5, color: 'var(--text-3)' }}>{iface.kind.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 8.5, color: 'var(--text-3)' }}>
                {iface.ip4 && <span>{iface.ip4} &nbsp;</span>}
                {iface.ssid && <span>· {iface.ssid}</span>}
              </div>
            </div>
            {typeof iface.signal_rssi === 'number' && <SignalBar rssi={iface.signal_rssi} />}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {[
              ['↓ RX', fmtBps(iface.rx_bps), '#00e5ff'],
              ['↑ TX', fmtBps(iface.tx_bps), '#ff0044'],
              ['TOTAL ↓', fmtBytes(iface.rx_total_bytes), '#00ff7f'],
              ['ERRORS', `${iface.rx_errors + iface.tx_errors}`, iface.rx_errors + iface.tx_errors > 0 ? '#ff8800' : 'var(--text-3)'],
            ].map(([k, v, c]) => (
              <div key={k as string} style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 5, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 7.5, color: 'var(--text-3)', marginBottom: 2 }}>{k as string}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: c as string }}>{v as string}</div>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
