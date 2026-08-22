import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../../stores/telemetryStore';
import type { DiagnosticAlert } from '../../types/telemetry';

export function AlertToast() {
  const alerts = useStore(s => s.snapshot?.alerts ?? []);
  const [shown, setShown] = useState<string[]>([]);
  const [visible, setVisible] = useState<DiagnosticAlert | null>(null);

  useEffect(() => {
    const latest = alerts[alerts.length - 1];
    if (!latest || shown.includes(latest.id)) return;
    setShown(s => [...s.slice(-20), latest.id]);
    setVisible(latest);
    const t = setTimeout(() => setVisible(null), 6000);
    return () => clearTimeout(t);
  }, [alerts]);

  if (!visible) return null;
  const clr = visible.severity === 'emergency' ? '#ff0044'
    : visible.severity === 'critical' ? '#ff3355'
    : visible.severity === 'warn' ? '#ff8800' : '#00e5ff';

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 18, zIndex: 99999, width: 310 }}>
      <AnimatePresence>
        {visible && (
          <motion.div
            key={visible.id}
            initial={{ x: 340, opacity: 0, scale: 0.96 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 340, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
            style={{
              background: 'rgba(6,6,14,0.95)',
              border: `1px solid ${clr}50`,
              borderRadius: 10, overflow: 'hidden',
              boxShadow: `0 0 28px ${clr}22, 0 8px 32px rgba(0,0,0,0.6)`,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 13px', borderBottom: `1px solid ${clr}20`,
              background: `${clr}08`,
            }}>
              <motion.div
                animate={{ scale: [1, 0.5, 1], opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                style={{ width: 7, height: 7, borderRadius: '50%', background: clr, flexShrink: 0,
                  boxShadow: `0 0 8px ${clr}` }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: clr, flex: 1 }}>{visible.title}</span>
              <button onClick={() => setVisible(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-3)',
                  cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>
                ×
              </button>
            </div>
            <div style={{ padding: '9px 13px' }}>
              <p style={{ fontSize: 10, color: 'var(--text-2)', lineHeight: 1.55 }}>{visible.message}</p>
              <div style={{ fontSize: 8.5, color: 'var(--text-4)', marginTop: 6 }}>
                {new Date(visible.timestamp_ms).toLocaleTimeString()}
              </div>
            </div>
            <motion.div
              style={{ height: 2, background: clr, transformOrigin: 'left' }}
              initial={{ scaleX: 1 }} animate={{ scaleX: 0 }}
              transition={{ duration: 6, ease: 'linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
