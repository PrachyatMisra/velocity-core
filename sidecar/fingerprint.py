"""Process behavior fingerprinting."""
import re
from typing import Any

RULES = [
    (re.compile(r"xmrig|minerd|monero|nicehash|minergate|ethminer|cgminer|bfgminer"), "cryptominer", 1.0),
    (re.compile(r"slack|discord|teams|notion|figma|linear|zulip|electron"), "electron", 0.9),
    (re.compile(r"python|torch|tensorflow|jupyter|llama|ollama|transformers"), "ml_workload", 0.8),
    (re.compile(r"clang|swiftc|rustc|xcodebuild|ninja|make|ld|link"), "compiler", 0.9),
    (re.compile(r"ffmpeg|compressor|davinci|premiere|resolve|handbrake"), "media", 0.85),
    (re.compile(r"code|cursor|nova|sublime|vim|emacs"), "editor", 0.7),
    (re.compile(r"kernel_task|launchd|mds|coreaudiod|windowserver|loginwindow|corespotlight"), "system", 1.0),
]

class ProcessFingerprinter:
    def classify(self, proc: dict) -> dict:
        name = proc.get("name", "").lower()
        cmd  = proc.get("cmd", name).lower()
        text = f"{name} {cmd}"

        for pattern, kind, confidence in RULES:
            if pattern.search(text):
                # Extra check for cryptominer: sustained high CPU with no known good signature
                if kind == "cryptominer":
                    cpu = float(proc.get("cpu_pct", 0))
                    if cpu < 20.0 and not pattern.search(text[:20]):
                        continue
                return {"kind": kind, "confidence": confidence, "method": "rule"}

        # Behavioral heuristics
        cpu = float(proc.get("cpu_pct", 0.0))
        mem_mb = float(proc.get("memory_bytes", 0)) / (1024 * 1024)

        if cpu > 80.0 and mem_mb < 100:
            return {"kind": "cryptominer", "confidence": 0.5, "method": "behavioral", "note": "sustained-cpu"}
        if mem_mb > 500:
            return {"kind": "electron", "confidence": 0.4, "method": "behavioral", "note": "high-mem"}
        if cpu > 50.0 and mem_mb > 200:
            return {"kind": "ml_workload", "confidence": 0.4, "method": "behavioral"}

        return {"kind": "normal", "confidence": 0.9, "method": "default"}

    def classify_all(self, procs: list[dict]) -> list[dict]:
        results = []
        for p in procs:
            fp = self.classify(p)
            results.append({**p, "kind": fp["kind"], "fingerprint": fp})
        return results
