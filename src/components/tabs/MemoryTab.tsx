import { motion } from "framer-motion";
import {
  useTelemetry,
  useHistory,
  fmtBytes,
  pressureColor,
} from "../../hooks/useTelemetry";
import { NeonGauge } from "../ui/NeonGauge";
import { SparkLine } from "../ui/SparkLine";

const PRESSURE_LABELS = ["NOMINAL", "MODERATE", "HIGH", "CRITICAL"];

export function MemoryTab() {
  const snap = useTelemetry();
  const memH = useHistory("memory.usage_pct", 120);
  const swpH = useHistory("memory.swap_used_bytes", 120);
  if (!snap) return null;
  const { memory } = snap;
  const plvl = memory.pressure_level;
  const plabel = PRESSURE_LABELS[plvl] ?? "UNKNOWN";
  const pcolor = pressureColor(plvl);

  const segments = [
    { label: "Wired", bytes: memory.wired_bytes, color: "#ff0044" },
    { label: "Active", bytes: memory.active_bytes, color: "#ff8800" },
    { label: "Inactive", bytes: memory.inactive_bytes, color: "#9966ff" },
    { label: "Compress", bytes: memory.compressed_bytes, color: "#00e5ff" },
    {
      label: "Free",
      bytes: memory.free_bytes,
      color: "rgba(255,255,255,0.06)",
    },
  ];

  return (
    <div
      style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
    >
      {/* Hero */}
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <NeonGauge
            value={memory.usage_pct}
            label="USED"
            size={114}
            color={pressureColor(plvl)}
            sublabel={fmtBytes(memory.used_bytes)}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div
                className={`badge ${plvl === 0 ? "b-green" : plvl === 1 ? "b-amber" : "b-red"}`}
                style={{ fontSize: 9, padding: "3px 8px" }}
              >
                {plabel} PRESSURE
              </div>
              <span style={{ fontSize: 9, color: "var(--text-3)" }}>
                {fmtBytes(memory.total_bytes)} total
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 8,
              }}
            >
              {[
                ["WIRED", fmtBytes(memory.wired_bytes), "#ff0044"],
                ["ACTIVE", fmtBytes(memory.active_bytes), "#ff8800"],
                ["INACTIVE", fmtBytes(memory.inactive_bytes), "#9966ff"],
                ["COMPRESS", fmtBytes(memory.compressed_bytes), "#00e5ff"],
                [
                  "SWAP USED",
                  fmtBytes(memory.swap_used_bytes),
                  memory.swap_used_bytes > 0 ? "#ff0044" : "#00ff7f",
                ],
                [
                  "BANDWIDTH",
                  `${memory.bandwidth_gbs.toFixed(0)} GB/s`,
                  "#00e5ff",
                ],
              ].map(([k, v, c]) => (
                <div
                  key={k as string}
                  style={{
                    padding: "6px 8px",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.042)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 7,
                      color: "var(--text-3)",
                      letterSpacing: "0.10em",
                    }}
                  >
                    {k as string}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: c as string,
                      marginTop: 2,
                    }}
                  >
                    {v as string}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stacked memory map */}
      <div className="panel" style={{ padding: "12px 14px" }}>
        <div className="sh">MEMORY MAP</div>
        <div
          style={{
            height: 18,
            borderRadius: 4,
            overflow: "hidden",
            display: "flex",
            marginBottom: 10,
          }}
        >
          {segments
            .filter((s) => s.bytes > 0)
            .map((s, i) => (
              <motion.div
                key={i}
                animate={{ width: `${(s.bytes / memory.total_bytes) * 100}%` }}
                transition={{ duration: 0.5 }}
                style={{
                  height: "100%",
                  background: s.color,
                  boxShadow:
                    s.color !== "rgba(255,255,255,0.06)"
                      ? `inset 0 1px 0 rgba(255,255,255,0.15)`
                      : "none",
                }}
                title={`${s.label}: ${fmtBytes(s.bytes)}`}
              />
            ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {segments.map((s, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: s.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 8.5, color: "var(--text-2)" }}>
                {s.label} {fmtBytes(s.bytes)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="panel" style={{ padding: "10px 12px" }}>
          <div className="sh">MEMORY PRESSURE — 2min</div>
          <SparkLine data={memH} height={55} color={pcolor} showGrid />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 5,
            }}
          >
            <span style={{ fontSize: 8.5, color: pcolor }}>
              {memory.usage_pct.toFixed(1)}%
            </span>
            <span style={{ fontSize: 8.5, color: "var(--text-3)" }}>
              {fmtBytes(memory.used_bytes)} / {fmtBytes(memory.total_bytes)}
            </span>
          </div>
        </div>
        <div className="panel" style={{ padding: "10px 12px" }}>
          <div className="sh">SWAP — 2min</div>
          <SparkLine data={swpH} height={55} color="#ff8800" showGrid />
          <div style={{ marginTop: 5, display: "flex", gap: 12 }}>
            <span style={{ fontSize: 8.5, color: "#ff8800" }}>
              Used {fmtBytes(memory.swap_used_bytes)}
            </span>
            <span style={{ fontSize: 8.5, color: "var(--text-3)" }}>
              Total {fmtBytes(memory.swap_total_bytes)}
            </span>
          </div>
        </div>
      </div>

      {/* Page events */}
      <div className="panel" style={{ padding: "11px 14px" }}>
        <div className="sh">PAGE EVENTS</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 8,
          }}
        >
          {[
            [
              "FAULTS",
              memory.page_faults.toLocaleString(),
              memory.page_faults > 100000 ? "#ff0044" : "#00e5ff",
            ],
            ["PAGE IN", memory.page_ins.toLocaleString(), "#ff8800"],
            [
              "PAGE OUT",
              memory.page_outs.toLocaleString(),
              memory.page_outs > 0 ? "#ff0044" : "#00ff7f",
            ],
            ["ZERO FILL", memory.zero_fill_pages.toLocaleString(), "#9966ff"],
          ].map(([k, v, c]) => (
            <div
              key={k as string}
              style={{
                padding: "8px 10px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: 7.5,
                  color: "var(--text-3)",
                  letterSpacing: "0.10em",
                }}
              >
                {k as string}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: c as string,
                  marginTop: 2,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {v as string}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
