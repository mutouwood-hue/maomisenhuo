"""Offline environment model tool. No audio network transport or bundled weights."""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import wave
import numpy as np

SCHEMA = "baji-environment-linear-v1"
LABELS = ["QUIET", "CONVERSATION", "NOISY", "MUSIC"]
FREQUENCIES = [250, 500, 1000, 2000, 4000, 6000]
FRAME_SAMPLES = 320
WINDOW_FRAMES = 50
FEATURE_COUNT = 24
ALLOWED_LICENSES = {"CC0-1.0", "CC-BY-4.0", "CC-BY-3.0"}
EPSILON = 1e-12


def frame_features(pcm: np.ndarray) -> np.ndarray:
    """PCM16 320x2; integer mean channels before normalization; no PCM retained."""
    pcm = np.asarray(pcm)
    if pcm.shape != (FRAME_SAMPLES, 2) or pcm.dtype != np.int16:
        raise ValueError("expected 320x2 PCM16")
    stereo = pcm.astype(np.float64) / 32768.0
    # C must truncate channel sum toward zero (not arithmetic signed shift).
    mono = np.trunc(pcm.astype(np.int32).sum(axis=1) / 2).astype(np.float64) / 32768.0
    power = float(np.mean(mono * mono))
    rms = math.sqrt(power)
    signs = mono >= 0
    zero_crossing = np.count_nonzero(signs[1:] != signs[:-1]) / 319.0
    channel_power = np.mean(stereo * stereo, axis=0)
    output = [math.log(max(rms, 1e-6)), zero_crossing,
              min(float(np.max(np.abs(mono))) / max(rms, 1e-6), 20.0),
              abs(float(np.mean(mono))),
              math.log(max(math.sqrt(float(channel_power[0])), 1e-6)) - math.log(max(math.sqrt(float(channel_power[1])), 1e-6)),
              float(np.mean(np.abs(pcm.astype(np.int32)) >= 32760))]
    for frequency in FREQUENCIES:
        coefficient = 2.0 * math.cos(2.0 * math.pi * frequency / 16000.0)
        previous = previous2 = 0.0
        for sample in mono:
            current = float(sample) + coefficient * previous - previous2
            previous2, previous = previous, current
        spectral_power = max(previous * previous + previous2 * previous2 - coefficient * previous * previous2, 0.0) / (FRAME_SAMPLES * FRAME_SAMPLES)
        output.append(math.log(max(spectral_power, EPSILON)))
    return np.asarray(output, dtype=np.float64)


def window_features(frames: np.ndarray) -> np.ndarray:
    if frames.shape != (WINDOW_FRAMES, 12) or not np.isfinite(frames).all():
        raise ValueError("expected 50 finite feature frames")
    # Welford accumulation matches bounded-memory C provider and avoids cancellation.
    mean = np.zeros(12)
    m2 = np.zeros(12)
    for count, frame in enumerate(frames, 1):
        delta = frame - mean
        mean += delta / count
        m2 += delta * (frame - mean)
    return np.concatenate([mean, np.sqrt(np.maximum(m2 / WINDOW_FRAMES, 0))])


def read_windows(path: Path) -> np.ndarray:
    # Only explicit local files. No resampling/copy of raw PCM to output.
    with wave.open(str(path), "rb") as reader:
        if (reader.getframerate(), reader.getnchannels(), reader.getsampwidth(), reader.getcomptype()) != (16000, 2, 2, "NONE"):
            raise ValueError("dataset must be 16kHz stereo uncompressed PCM16 WAV")
        if reader.getnframes() < 16000 or reader.getnframes() > 16000 * 600:
            raise ValueError("WAV duration must be 1..600 seconds")
        result, buffer = [], []
        while True:
            raw = reader.readframes(FRAME_SAMPLES)
            if len(raw) != FRAME_SAMPLES * 4:
                break  # Drop final partial window; never zero-pad quiet examples.
            pcm = np.frombuffer(raw, dtype="<i2").reshape(FRAME_SAMPLES, 2).astype(np.int16)
            buffer.append(frame_features(pcm))
            if len(buffer) == WINDOW_FRAMES:
                result.append(window_features(np.asarray(buffer)))
                buffer.clear()
    if not result:
        raise ValueError("no complete window")
    return np.asarray(result)


def validate_manifest(manifest: dict) -> list[dict]:
    if manifest.get("schema") != SCHEMA or manifest.get("isRealLabeledAudio") is not True:
        raise ValueError("real human-labeled dataset declaration required")
    clips = manifest.get("clips")
    if not isinstance(clips, list) or not clips:
        raise ValueError("clips required")
    groups, ids, hashes = {}, set(), set()
    split_labels = {name: set() for name in ("TRAIN", "VALIDATION", "TEST", "OOD_TEST")}
    provenance = {key: {} for key in ("recordingId", "speakerGroupId", "locationGroupId")}
    for clip in clips:
        if not isinstance(clip, dict):
            raise ValueError("invalid clip")
        for key in ("id", "path", "groupId", "sourceUrl", "license", "licenseUrl", "attribution", "authorizationRef", "recordingId", "speakerGroupId", "locationGroupId", "label", "split", "sha256", "labeler", "captureDomain"):
            if not isinstance(clip.get(key), str) or not clip[key].strip():
                raise ValueError(f"missing {key}")
        if clip["license"] not in ALLOWED_LICENSES or clip.get("isUseAuthorized") is not True or clip.get("isPrivacyUseAuthorized") is not True:
            raise ValueError("unapproved/noncommercial license or use/privacy authorization")
        if clip["id"] in ids or clip["sha256"] in hashes:
            raise ValueError("duplicate clip id/content")
        if len(clip["sha256"]) != 64 or any(char not in "0123456789abcdef" for char in clip["sha256"]):
            raise ValueError("invalid SHA256")
        ids.add(clip["id"]); hashes.add(clip["sha256"])
        valid_label = clip["label"] == "UNKNOWN" if clip["split"] == "OOD_TEST" else clip["label"] in LABELS
        if not valid_label or clip["split"] not in split_labels:
            raise ValueError("invalid label/split")
        for key, assignments in provenance.items():
            if assignments.setdefault(clip[key], clip["split"]) != clip["split"]:
                raise ValueError(f"{key} leakage across splits")
        old = groups.setdefault(clip["groupId"], clip["split"])
        if old != clip["split"]:
            raise ValueError("source group leakage across splits")
        split_labels[clip["split"]].add(clip["label"])
    if any(split_labels[name] != set(LABELS) for name in ("TRAIN", "VALIDATION", "TEST")):
        raise ValueError("all four classes required in each split")
    if split_labels["OOD_TEST"] != {"UNKNOWN"}:
        raise ValueError("independent UNKNOWN OOD_TEST holdout required")
    return clips


def load_dataset(path: Path):
    manifest = json.loads(path.read_text(encoding="utf-8-sig"))
    clips = validate_manifest(manifest)
    data = {name: [[], [], []] for name in ("TRAIN", "VALIDATION", "TEST", "OOD_TEST")}
    parents = list(range(len(clips)))
    def root(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index
    seen = {}
    for index, clip in enumerate(clips):
        for key in ("groupId", "recordingId", "speakerGroupId", "locationGroupId"):
            token = (key, clip[key])
            if token in seen:
                parents[root(index)] = root(seen[token])
            else:
                seen[token] = index
    for index, clip in enumerate(clips):
        audio = (path.parent / clip["path"]).resolve()
        if hashlib.sha256(audio.read_bytes()).hexdigest() != clip["sha256"]:
            raise ValueError("audio integrity mismatch")
        features = read_windows(audio)
        x, y, groups = data[clip["split"]]
        label_index = -1 if clip["label"] == "UNKNOWN" else LABELS.index(clip["label"])
        x.extend(features); y.extend([label_index] * len(features)); groups.extend([str(root(index))] * len(features))
    return {name: (np.asarray(x), np.asarray(y), np.asarray(groups)) for name, (x, y, groups) in data.items()}, manifest


def softmax(logits):
    shifted = logits - logits.max(axis=1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=1, keepdims=True)


def fit(x, y, epochs=1000, learning_rate=0.03, l2=0.001):
    if x.ndim != 2 or x.shape[1] != FEATURE_COUNT or not np.isfinite(x).all() or set(y) != set(range(4)):
        raise ValueError("finite 24 features and all four classes required")
    mean = x.mean(axis=0)
    scale = np.maximum(x.std(axis=0), 1e-6)
    z = (x - mean) / scale
    weights, bias = np.zeros((4, FEATURE_COUNT)), np.zeros(4)
    targets = np.eye(4)[y]
    # Per-class weighting prevents long recordings from dominating by class.
    importance = np.asarray([len(y) / (4 * np.count_nonzero(y == label)) for label in y])
    for _ in range(epochs):
        residual = (softmax(z @ weights.T + bias) - targets) * importance[:, None] / len(y)
        weights -= learning_rate * (residual.T @ z + l2 * weights)
        bias -= learning_rate * residual.sum(axis=0)
    return {"mean": mean, "scale": scale, "weights": weights, "bias": bias}


def predict(model, x, min_confidence, max_z):
    z = (x - model["mean"]) / model["scale"]
    probabilities = softmax(z @ model["weights"].T + model["bias"])
    best = probabilities.argmax(axis=1)
    confidence = probabilities.max(axis=1)
    rejected = (confidence < min_confidence) | (np.max(np.abs(z), axis=1) > max_z)
    return np.where(rejected, -1, best), confidence


def metrics(actual, predicted):
    matrix = np.zeros((4, 5), dtype=int)  # UNKNOWN is rejection column, never claimed correct.
    for truth, guessed in zip(actual, predicted):
        matrix[truth, guessed if guessed >= 0 else 4] += 1
    recall = np.diag(matrix[:, :4]) / np.maximum(matrix.sum(axis=1), 1)
    precision = np.diag(matrix[:, :4]) / np.maximum(matrix[:, :4].sum(axis=0), 1)
    f1 = 2 * precision * recall / np.maximum(precision + recall, EPSILON)
    return {"confusionMatrix": matrix.tolist(), "columns": LABELS + ["UNKNOWN"],
            "macroF1": float(f1.mean()), "recall": recall.tolist(),
            "rejectionRate": float(np.mean(predicted < 0)), "windowCount": len(actual)}


def group_cross_validation(x, y, groups, folds, **fit_kwargs):
    unique = np.unique(groups)
    if folds < 2 or len(unique) < folds:
        raise ValueError("at least two nonempty grouped folds required")
    reports = []
    for held_out in np.array_split(unique, folds):
        mask = np.isin(groups, held_out)
        model = fit(x[~mask], y[~mask], **fit_kwargs)
        guessed, _ = predict(model, x[mask], 0.0, float("inf"))
        reports.append(metrics(y[mask], guessed))
    return reports


def c_float(value: float) -> str:
    """九位有效数字可往返float32；整数值补小数以形成有效C浮点常量。"""
    text = f"{float(np.float32(value)):.9g}"
    if '.' not in text and 'e' not in text:
        text += '.0'
    return text + 'f'


def c_header(model: dict) -> str:
    lines = ["/* Experiment weights; NOT production approved. Generated locally. */", "#pragma once", "#define BJ_ENV_FEATURE_COUNT 24", "#define BJ_ENV_CLASS_COUNT 4"]
    for key in ("mean", "scale", "weights", "bias"):
        values = np.asarray(model[key]).ravel()
        formatted = []
        for value in values:
            text = f"{float(value):.9g}"
            if "." not in text and "e" not in text:
                text += ".0"
            formatted.append(text + "f")
        lines.append(f"static const float bj_env_{key}[{len(values)}] = {{{', '.join(formatted)}}};")
    lines += [f"#define BJ_ENV_MIN_CONFIDENCE {c_float(model['minConfidence'])}", f"#define BJ_ENV_MAX_Z {c_float(model['maxZ'])}"]
    return "\n".join(lines) + "\n"


def firmware_header(model: dict, model_sha256: str = "") -> str:
    """生成静态寿命结构，供固件关闭采样时显式加载；不自动启用。"""
    lines = ["/* EXPERIMENTAL: not production approved; no scene accuracy implied. */",
             "#pragma once", '#include "baji_env_model.h"',
             "#define BJ_ENV_EXPERIMENTAL_MODEL 1",
             f'#define BJ_ENV_MODEL_SHA256 "{model_sha256}"',
             f"#define BJ_ENV_MODEL_VERSION {model['version']}u",
             "static const bj_env_weights_t bj_env_exported_weights = {"]
    for key in ("mean", "scale", "weights", "bias"):
        values = np.asarray(model[key], dtype=np.float32).ravel()
        formatted = []
        for value in values:
            text = f"{float(value):.9g}"
            if "." not in text and "e" not in text:
                text += ".0"
            formatted.append(text + "f")
        lines.append(f"    .{key} = {{{', '.join(formatted)}}},")
    lines.extend([f"    .min_confidence = {c_float(model['minConfidence'])},",
                  f"    .max_z = {c_float(model['maxZ'])},",
                  f"    .version = {model['version']}u", "};"])
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--min-confidence", required=True, type=float)
    parser.add_argument("--max-z", required=True, type=float)
    parser.add_argument("--epochs", type=int, default=1000)
    parser.add_argument("--cv-folds", type=int, default=0)
    args = parser.parse_args()
    if not 0 < args.min_confidence <= 1 or not math.isfinite(args.max_z) or args.max_z <= 0 or not 1 <= args.epochs <= 100000:
        parser.error("invalid experiment thresholds/epochs")
    if args.output.exists():
        parser.error('output exists; choose fresh experiment directory')
    data, manifest = load_dataset(args.manifest)
    x, y, groups = data["TRAIN"]
    model = {key: value.astype(np.float32).astype(np.float64) for key, value in fit(x, y, epochs=args.epochs).items()}
    if any(not np.isfinite(value).all() for value in model.values()) or np.any(model['scale'] <= 0):
        raise ValueError('model is not deployable float32')
    args.min_confidence = float(np.float32(args.min_confidence))
    args.max_z = float(np.float32(args.max_z))
    if not 0 < args.min_confidence <= 1 or not 0 < args.max_z < float('inf'):
        raise ValueError('thresholds are not deployable float32')
    report = {"isProductionApproved": False, "scope": "LOCAL_LABELED_EXPERIMENT", "precision": "FLOAT32_WEIGHTS_FLOAT64_DSP", "splits": {}}
    for split, (features, labels, _) in data.items():
        guessed, _ = predict(model, features, args.min_confidence, args.max_z)
        if split == "OOD_TEST":
            report["splits"][split] = {"windowCount": len(labels), "rejectionRate": float(np.mean(guessed < 0)), "falseAcceptanceRate": float(np.mean(guessed >= 0))}
        else:
            report["splits"][split] = metrics(labels, guessed)
    if args.cv_folds:
        report["trainingGroupCrossValidation"] = group_cross_validation(x, y, groups, args.cv_folds, epochs=args.epochs)
    exported = {key: value.tolist() for key, value in model.items()}
    exported.update(schema=SCHEMA, version=1, labels=LABELS, minConfidence=args.min_confidence, maxZ=args.max_z,
                    isProductionApproved=False, datasetManifestSha256=hashlib.sha256(args.manifest.read_bytes()).hexdigest(),
                    licenses=sorted({clip["license"] for clip in manifest["clips"]}),
                    trainingProvenance={key: sorted({clip[key] for clip in manifest['clips'] if clip['split'] == 'TRAIN'})
                                        for key in ('groupId', 'recordingId', 'speakerGroupId', 'locationGroupId', 'sha256')})
    if args.output.exists():
        raise ValueError("output exists; choose fresh experiment directory")
    args.output.mkdir(parents=True)
    (args.output / "model.json").write_text(json.dumps(exported, indent=2, allow_nan=False), encoding="utf-8")
    (args.output / "metrics.json").write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    (args.output / "baji_env_weights.h").write_text(c_header(exported), encoding="utf-8")
    (args.output / "baji_env_model_data.h").write_text(firmware_header(exported, hashlib.sha256((args.output / 'model.json').read_bytes()).hexdigest()), encoding="utf-8")
    hashes = {item.name: hashlib.sha256(item.read_bytes()).hexdigest() for item in args.output.iterdir()}
    (args.output / 'artifact-sha256.json').write_text(json.dumps(hashes, indent=2), encoding='utf-8')
    print("Local experimental training completed; hardware and scene validation remain required.")


if __name__ == "__main__":
    main()
