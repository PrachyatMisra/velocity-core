"""Anomaly detection: IsolationForest + Autoencoder ensemble."""
import numpy as np
from typing import Any

try:
    from sklearn.ensemble import IsolationForest
    HAS_SKL = True
except ImportError:
    HAS_SKL = False

try:
    import torch
    import torch.nn as nn
    DEVICE = torch.device("mps") if torch.backends.mps.is_available() else torch.device("cpu")
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    DEVICE = None

FEATURE_KEYS = [
    "cpu.total_usage_pct", "cpu.all_core_avg_mhz",
    "memory.usage_pct", "memory.pressure_level",
    "gpu.usage_pct", "thermal.cpu_die_temp",
    "thermal.gpu_temp", "network.total_rx_bps",
]

def extract_features(snap: dict) -> np.ndarray:
    vals = []
    for key in FEATURE_KEYS:
        parts = key.split(".")
        v = snap
        for p in parts:
            v = v.get(p, 0.0) if isinstance(v, dict) else 0.0
        vals.append(float(v) if v is not None else 0.0)
    return np.array(vals, dtype=np.float32)

class Autoencoder(nn.Module if HAS_TORCH else object):
    def __init__(self, dim: int = 8):
        if HAS_TORCH:
            super().__init__()
            self.enc = nn.Sequential(nn.Linear(dim, 4), nn.ReLU(), nn.Linear(4, 2))
            self.dec = nn.Sequential(nn.Linear(2, 4), nn.ReLU(), nn.Linear(4, dim))
    def forward(self, x):
        return self.dec(self.enc(x))

class AnomalyDetector:
    def __init__(self):
        self._buf: list[np.ndarray] = []
        self._iforest = None
        self._ae = Autoencoder() if HAS_TORCH else None
        self._ae_trained = False
        if self._ae and HAS_TORCH:
            self._ae.to(DEVICE)

    def _update_iforest(self):
        if not HAS_SKL or len(self._buf) < 50:
            return
        X = np.stack(self._buf[-300:])
        self._iforest = IsolationForest(contamination=0.05, random_state=42, n_jobs=-1)
        self._iforest.fit(X)

    def _train_ae(self):
        if not HAS_TORCH or len(self._buf) < 30:
            return
        X = torch.tensor(np.stack(self._buf[-200:]), dtype=torch.float32).to(DEVICE)
        # Normalize
        self._mu = X.mean(0)
        self._std = X.std(0).clamp(min=1e-5)
        X = (X - self._mu) / self._std
        opt = torch.optim.Adam(self._ae.parameters(), lr=1e-3)
        self._ae.train()
        for _ in range(20):
            opt.zero_grad()
            loss = nn.functional.mse_loss(self._ae(X), X)
            loss.backward()
            opt.step()
        self._ae.eval()
        self._ae_trained = True

    def score(self, snap: dict) -> dict:
        feat = extract_features(snap)
        self._buf.append(feat)

        if len(self._buf) % 50 == 0:
            self._update_iforest()
        if len(self._buf) % 30 == 0 and len(self._buf) >= 30:
            self._train_ae()

        if len(self._buf) < 20:
            return {"score": 0.0, "components": {"zscore": 0.0, "iforest": 0.0, "ae": 0.0}}

        # Z-score component
        history = np.stack(self._buf[-60:])
        mu = history.mean(0)
        std = history.std(0) + 1e-5
        z = np.abs((feat - mu) / std).max()
        zscore = float(np.tanh(z / 3.0))

        # IsolationForest component
        iforest_score = 0.0
        if self._iforest is not None:
            raw = self._iforest.score_samples(feat.reshape(1, -1))[0]
            iforest_score = float(np.clip((-raw - 0.1) / 0.4, 0.0, 1.0))

        # Autoencoder component
        ae_score = 0.0
        if self._ae_trained and HAS_TORCH:
            with torch.no_grad():
                x = torch.tensor(feat, dtype=torch.float32).to(DEVICE)
                x = (x - self._mu) / self._std
                recon = self._ae(x.unsqueeze(0)).squeeze(0)
                mse = nn.functional.mse_loss(recon, x).item()
                ae_score = float(np.tanh(mse * 2))

        combined = 0.4 * zscore + 0.35 * iforest_score + 0.25 * ae_score
        return {
            "score": float(np.clip(combined, 0.0, 1.0)),
            "components": {"zscore": zscore, "iforest": iforest_score, "ae": ae_score},
        }
