import { motion } from "framer-motion";
import {
  useTelemetry,
  useHistory,
  fmtFreq,
  fmtPower,
  fmtTemp,
  tempColor,
  usageColor,
} from "../../hooks/useTelemetry";
import { SparkLine } from "../ui/SparkLine";
import { NeonGauge } from "../ui/NeonGauge";
import type { CoreStat } from "../../types/telemetry";

function CoreDetail({ core }: { core: CoreStat }) {
  const clr = tempColor(core.temp_c);
  const uc = usageColor(core.usage_pct);
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="panel"
      style={{ padding: "10px 12px" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              fontWeight: 700,
              background: `${uc}15`,
              border: `1px solid ${uc}35`,
              color: uc,
            }}
          >
            {core.kind === "performance" ? "P" : "E"}
            {core.id}
          </div>
          <div>
            <div
              style={{ fontSize: 9, fontWeight: 700, color: "var(--text-1)" }}
            >
              Core {core.id}
            </div>
            <div style={{ fontSize: 7.5, color: "var(--text-3)" }}>
              {core.kind}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{ fontSize: 16, fontWeight: 800, color: uc, lineHeight: 1 }}
          >
            {core.usage_pct.toFixed(0)}%
          </div>
        </div>
      </div>
      <div
        style={{
          height: 3,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 2,
          marginBottom: 8,
        }}
      >
        <motion.div
          animate={{ width: `${core.usage_pct}%` }}
          style={{
            height: "100%",
            background: uc,
            borderRadius: 2,
            boxShadow: `0 0 6px ${uc}`,
          }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        {[
          ["FREQ", fmtFreq(core.freq_mhz), "#00e5ff"],
          ["TEMP", fmtTemp(core.temp_c), clr],
        ].map(([k, v, c]) => (
          <div key={k}>
            <div
              style={{
                fontSize: 7,
                color: "var(--text-3)",
                letterSpacing: "0.12em",
              }}
            >
              {k}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: c as string }}>
              {v}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function CpuTab() {
  const snap = useTelemetry();
  const cpuH = useHistory("cpu.total_usage_pct", 120);
  const tmpH = useHistory("thermal.cpu_die_temp", 120);
  const usrH = useHistory("cpu.user_pct", 120);
  const sysH = useHistory("cpu.system_pct", 120);

  if (!snap) return null;
  const { cpu, thermal } = snap;
  const perf = cpu.cores.filter((c) => c.kind === "performance");
  const eff = cpu.cores.filter((c) => c.kind !== "performance");

  return (
    <div
      style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
    >
      {/* Hero metrics */}
      <div className="panel" style={{ padding: 16 }}>
        <div className="sh">{cpu.chip_name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <NeonGauge
            value={cpu.total_usage_pct}
            label="TOTAL"
            size={114}
            color={usageColor(cpu.total_usage_pct)}
            sublabel={fmtFreq(cpu.all_core_avg_mhz)}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 10,
                marginBottom: 14,
              }}
            >
              {[
                ["USER", cpu.user_pct, "#ff0044"],
                ["SYSTEM", cpu.system_pct, "#ff8800"],
                ["IDLE", cpu.idle_pct, "#00ff7f"],
              ].map(([k, v, c]) => (
                <div key={k as string}>
                  <div
                    style={{
                      fontSize: 7.5,
                      color: "var(--text-3)",
                      letterSpacing: "0.12em",
                      marginBottom: 3,
                    }}
                  >
                    {k as string}
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: c as string,
                    }}
                  >
                    {(v as number).toFixed(1)}%
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      height: 2,
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: 1,
                    }}
                  >
                    <motion.div
                      animate={{ width: `${v as number}%` }}
                      style={{
                        height: "100%",
                        background: c as string,
                        borderRadius: 1,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 8,
              }}
            >
              {[
                ["P-CORES", `${cpu.perf_core_count}`, "#ff0044"],
                ["E-CORES", `${cpu.eff_core_count}`, "#ff8800"],
                ["PACKAGE", fmtPower(cpu.package_power_mw), "#00e5ff"],
                [
                  "TEMP",
                  fmtTemp(thermal.cpu_die_temp),
                  tempColor(thermal.cpu_die_temp),
                ],
              ].map(([k, v, c]) => (
                <div
                  key={k as string}
                  style={{
                    padding: "6px 8px",
                    background: "rgba(255,255,255,0.025)",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.045)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 7,
                      color: "var(--text-3)",
                      letterSpacing: "0.11em",
                    }}
                  >
                    {k as string}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
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

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="panel" style={{ padding: "10px 12px" }}>
          <div className="sh">CPU UTILIZATION — 2min</div>
          <div style={{ position: "relative", height: 60 }}>
            <SparkLine data={cpuH} height={60} color="#ff0044" showGrid />
            <div style={{ position: "absolute", inset: 0, opacity: 0.6 }}>
              <SparkLine
                data={usrH}
                height={60}
                color="#ff6600"
                fillOpacity={0.05}
                showDot={false}
              />
            </div>
            <div style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
              <SparkLine
                data={sysH}
                height={60}
                color="#ffaa00"
                fillOpacity={0.03}
                showDot={false}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 5 }}>
            {[
              ["Total", cpu.total_usage_pct, "#ff0044"],
              ["User", cpu.user_pct, "#ff6600"],
              ["Sys", cpu.system_pct, "#ffaa00"],
            ].map(([k, v, c]) => (
              <div
                key={k as string}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <div
                  style={{
                    width: 8,
                    height: 2,
                    background: c as string,
                    borderRadius: 1,
                  }}
                />
                <span style={{ fontSize: 8.5, color: "var(--text-3)" }}>
                  {k as string} {(v as number).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel" style={{ padding: "10px 12px" }}>
          <div className="sh">CPU TEMPERATURE — 2min</div>
          <SparkLine
            data={tmpH}
            height={60}
            color="#ff8800"
            max={110}
            showGrid
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 5,
              gap: 12,
            }}
          >
            <span
              style={{ fontSize: 8.5, color: tempColor(thermal.cpu_die_temp) }}
            >
              Now {fmtTemp(thermal.cpu_die_temp)}
            </span>
            <span style={{ fontSize: 8.5, color: "var(--text-3)" }}>
              Max {fmtTemp(Math.max(...tmpH, 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Load averages */}
      <div className="panel" style={{ padding: "10px 14px" }}>
        <div className="sh">LOAD AVERAGES</div>
        <div style={{ display: "flex", gap: 20 }}>
          {[
            ["1 min", cpu.load_avg_1],
            ["5 min", cpu.load_avg_5],
            ["15 min", cpu.load_avg_15],
          ].map(([k, v]) => {
            const pct = Math.min(
              ((v as number) / (cpu.perf_core_count + cpu.eff_core_count)) *
                100,
              100,
            );
            const c = pct > 90 ? "#ff0044" : pct > 70 ? "#ff8800" : "#00e5ff";
            return (
              <div key={k as string} style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 5,
                  }}
                >
                  <span style={{ fontSize: 8.5, color: "var(--text-3)" }}>
                    {k as string}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: c }}>
                    {(v as number).toFixed(2)}
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    animate={{ width: `${pct}%` }}
                    style={{
                      height: "100%",
                      background: c,
                      borderRadius: 2,
                      boxShadow: `0 0 4px ${c}`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* P-Core grid */}
      {perf.length > 0 && (
        <div>
          <div className="sh" style={{ padding: "0 2px" }}>
            PERFORMANCE CORES — {perf.length}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 8,
            }}
          >
            {perf.map((c) => (
              <CoreDetail key={c.id} core={c} />
            ))}
          </div>
        </div>
      )}

      {/* E-Core grid */}
      {eff.length > 0 && (
        <div>
          <div className="sh" style={{ padding: "0 2px" }}>
            EFFICIENCY CORES — {eff.length}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 8,
            }}
          >
            {eff.map((c) => (
              <CoreDetail key={c.id} core={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
