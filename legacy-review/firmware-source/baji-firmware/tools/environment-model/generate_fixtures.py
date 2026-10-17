"""Generate synthetic numerical oracle only; never training/accuracy evidence."""
import json
from pathlib import Path
import numpy as np
from environment_model import frame_features, window_features


def frames():
    index = np.arange(320)
    yield "silence", np.zeros((320, 2), dtype=np.int16)
    yield "constant_negative", np.full((320, 2), -32768, dtype=np.int16)
    yield "alternating", np.tile(np.where(index % 2, -8192, 8192)[:, None], (1, 2)).astype(np.int16)
    yield "ramp", np.stack([index * 100 - 16000, 16000 - index * 80], axis=1).astype(np.int16)
    # Fixed integer pattern so C can reproduce without trig or random generator.
    yield "modular_pattern", np.stack([(index * 997) % 32000 - 16000, (index * 431) % 28000 - 14000], axis=1).astype(np.int16)


if __name__ == "__main__":
    output = Path(__file__).with_name("feature-fixtures.json")
    if output.exists():
        raise ValueError("fixture exists; review before replacing")
    payload = {"scope": "SYNTHETIC_NUMERICAL_ORACLE_NOT_SCENE_ACCURACY", "float32Tolerance": 0.0005, "frames": []}
    for name, pcm in frames():
        features = frame_features(pcm)
        payload["frames"].append({"name": name, "frameFeatures": features.tolist(), "repeatedWindowFeatures": window_features(np.tile(features, (50, 1))).tolist()})
    output.write_text(json.dumps(payload, indent=2, allow_nan=False), encoding="utf-8")
