"""LSTM + Attention thermal forecaster."""
import numpy as np

try:
    import torch
    import torch.nn as nn
    DEVICE = torch.device("mps") if torch.backends.mps.is_available() else torch.device("cpu")
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

class _LSTMForecaster(nn.Module if HAS_TORCH else object):
    def __init__(self, input_dim=3, hidden=32, heads=2, output=3):
        if HAS_TORCH:
            super().__init__()
            self.lstm = nn.LSTM(input_dim, hidden, batch_first=True)
            self.attn = nn.MultiheadAttention(hidden, heads, batch_first=True)
            self.out  = nn.Linear(hidden, output)
    def forward(self, x):
        h, _ = self.lstm(x)
        a, _ = self.attn(h, h, h)
        return torch.sigmoid(self.out(a[:, -1, :]))

class ThermalForecaster:
    def __init__(self):
        self._model = _LSTMForecaster() if HAS_TORCH else None
        self._trained = False
        self._buf: list[list[float]] = []
        if self._model and HAS_TORCH:
            self._model.to(DEVICE)

    def _train(self):
        if not HAS_TORCH or len(self._buf) < 40:
            return
        # Self-supervised: predict next steps from current window
        data = np.array(self._buf[-200:], dtype=np.float32)
        # Normalize
        self._mu = data.mean(0); self._std = data.std(0) + 1e-5
        data = (data - self._mu) / self._std
        X = torch.tensor(data, dtype=torch.float32).to(DEVICE)
        opt = torch.optim.Adam(self._model.parameters(), lr=2e-3)
        self._model.train()
        for _ in range(15):
            if len(data) < 12: break
            idx = np.random.randint(0, len(data) - 10)
            x   = X[idx:idx+10].unsqueeze(0)
            tgt = torch.tensor(np.clip((data[idx+10, 0:3]) / 1.2, 0, 1), dtype=torch.float32).to(DEVICE).unsqueeze(0)
            opt.zero_grad()
            loss = nn.functional.mse_loss(self._model(x), tgt)
            loss.backward()
            opt.step()
        self._model.eval()
        self._trained = True

    def predict(self, history: list[dict]) -> dict:
        # Extract (cpu_temp, gpu_temp, usage) tuples
        pts = []
        for h in history[-30:]:
            cpu_t = h.get("thermal", {}).get("cpu_die_temp", 50.0)
            gpu_t = h.get("thermal", {}).get("gpu_temp", 40.0)
            usage = h.get("cpu", {}).get("total_usage_pct", 0.0)
            pts.append([cpu_t, gpu_t, usage])
        self._buf.extend(pts)
        if len(self._buf) % 20 == 0:
            self._train()

        if not self._trained or not HAS_TORCH or len(pts) < 5:
            # Simple linear extrapolation fallback
            if len(pts) >= 3:
                recent = [p[0] for p in pts[-5:]]
                trend = (recent[-1] - recent[0]) / max(len(recent) - 1, 1)
                cur = recent[-1]
                risk_30  = float(np.clip((cur + trend * 1 - 85) / 25, 0, 1))
                risk_60  = float(np.clip((cur + trend * 2 - 85) / 25, 0, 1))
                risk_300 = float(np.clip((cur + trend * 10 - 85) / 25, 0, 1))
                return {"risk_30s": risk_30, "risk_60s": risk_60, "risk_300s": risk_300}
            return {"risk_30s": 0.0, "risk_60s": 0.0, "risk_300s": 0.0}

        data = np.array(pts[-10:], dtype=np.float32)
        norm = (data - self._mu) / self._std
        with torch.no_grad():
            x = torch.tensor(norm, dtype=torch.float32).to(DEVICE).unsqueeze(0)
            preds = self._model(x).squeeze(0).cpu().numpy()
        return {
            "risk_30s":  float(np.clip(preds[0], 0, 1)),
            "risk_60s":  float(np.clip(preds[1], 0, 1)),
            "risk_300s": float(np.clip(preds[2], 0, 1)),
        }
