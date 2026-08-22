"""
VELOCITY CORE APEX — AI Sidecar v3.0
JSON-RPC 2.0 over stdin/stdout. Zero network I/O during runtime.
Methods: ping, analyze_anomaly, forecast_thermal, fingerprint_processes,
         get_baseline, ipc_analysis
"""
import sys, json, threading, time, os
sys.path.insert(0, os.path.dirname(__file__))

from anomaly import AnomalyDetector
from thermal_forecast import ThermalForecaster
from fingerprint import ProcessFingerprinter
from benchmark_scraper import get_baseline_for_chip

# ── Global model instances ────────────────────────────────────────────────────
_lock     = threading.Lock()
_anomaly  = AnomalyDetector()
_thermal  = ThermalForecaster()
_finger   = ProcessFingerprinter()

def handle(req: dict) -> dict:
    method = req.get("method", "")
    params = req.get("params", {})
    rid    = req.get("id", None)

    try:
        with _lock:
            if method == "ping":
                result = {"pong": True, "version": "3.0", "models": ["anomaly","thermal","fingerprint"]}

            elif method == "analyze_anomaly":
                result = _anomaly.score(params.get("snapshot", {}))

            elif method == "forecast_thermal":
                result = _thermal.predict(params.get("history", []))

            elif method == "fingerprint_processes":
                result = _finger.classify_all(params.get("processes", []))

            elif method == "get_baseline":
                result = get_baseline_for_chip(params.get("chip", None))

            elif method == "ipc_analysis":
                # Analyse IPC from telemetry snapshot
                snap = params.get("snapshot", {})
                cpu  = snap.get("cpu", {})
                freq = cpu.get("all_core_avg_mhz", 3000)
                base = cpu.get("base_freq_mhz", 3000) or 3000
                usage= cpu.get("total_usage_pct", 0)
                temp = snap.get("thermal", {}).get("cpu_die_temp", 50)
                boost_ratio = freq / base if base > 0 else 1.0
                headroom = max(0, 1.0 - max(0, temp - 40) / 55.0) * 100
                result = {
                    "boost_ratio": round(boost_ratio, 3),
                    "thermal_headroom_pct": round(headroom, 1),
                    "estimated_ipc": round(boost_ratio * (1 + usage / 200), 3),
                    "throttle_risk": headroom < 20,
                }

            else:
                return {"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": f"Unknown method: {method}"}}

        return {"jsonrpc": "2.0", "id": rid, "result": result}

    except Exception as e:
        return {"jsonrpc": "2.0", "id": rid, "error": {"code": -32000, "message": str(e)}}

def heartbeat():
    while True:
        time.sleep(30)
        try:
            msg = json.dumps({"jsonrpc": "2.0", "method": "heartbeat", "params": {"ts": time.time()}})
            sys.stdout.write(msg + "\n")
            sys.stdout.flush()
        except Exception:
            break

def main():
    threading.Thread(target=heartbeat, daemon=True).start()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req  = json.loads(line)
            resp = handle(req)
        except json.JSONDecodeError as e:
            resp = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": f"Parse error: {e}"}}
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    main()
