"""严格加载实验模型及独立评估；不采集、不下载、不输出原始音频。"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import numpy as np
import environment_model as env

MODEL_VERSION = 1
ARRAY_SHAPES = {"mean": (24,), "scale": (24,), "weights": (4, 24), "bias": (4,)}
PROVENANCE_KEYS = ("groupId", "recordingId", "speakerGroupId", "locationGroupId", "sha256")

class ModelArtifactError(ValueError):
    """模型格式或完整性不符合部署约定。"""

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

def load_model(path: Path, expected_sha256: str) -> dict:
    """调用方须从可信发布记录提供hash；同目录hash本身不是签名。"""
    if len(expected_sha256) != 64 or sha256_file(path) != expected_sha256:
        raise ModelArtifactError("model SHA256 mismatch")
    artifact = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(artifact, dict) or artifact.get("schema") != env.SCHEMA or artifact.get("labels") != env.LABELS:
        raise ModelArtifactError("model schema/label order mismatch")
    if type(artifact.get("version")) is not int or artifact["version"] != MODEL_VERSION:
        raise ModelArtifactError("unsupported model version")
    if artifact.get("isProductionApproved") is not False:
        raise ModelArtifactError("experimental tool cannot approve production models")
    if not isinstance(artifact.get("licenses"), list) or not artifact["licenses"] or any(not isinstance(item, str) or item not in env.ALLOWED_LICENSES for item in artifact["licenses"]):
        raise ModelArtifactError("unapproved model data license")
    for key, shape in ARRAY_SHAPES.items():
        array = np.asarray(artifact.get(key), dtype=np.float64)
        if array.shape != shape or not np.isfinite(array).all():
            raise ModelArtifactError(f"invalid {key}")
        # 使用实际C float32权重再评估，避免仅双精度结果冒充设备模型。
        with np.errstate(over="ignore", invalid="ignore"):
            array = array.astype(np.float32).astype(np.float64)
        if not np.isfinite(array).all() or (key == "scale" and np.any(array <= 0)):
            raise ModelArtifactError(f"{key} is not deployable float32")
        artifact[key] = array
    for key in ("minConfidence", "maxZ"):
        value = artifact.get(key)
        if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value):
            raise ModelArtifactError(f"invalid {key}")
        with np.errstate(over="ignore"):
            artifact[key] = float(np.float32(value))
    if not 0 < artifact["minConfidence"] <= 1 or not 0 < artifact["maxZ"] < float("inf"):
        raise ModelArtifactError("invalid rejection thresholds")
    provenance = artifact.get("trainingProvenance")
    if not isinstance(provenance, dict) or any(not isinstance(provenance.get(key), list) or not provenance[key] or any(not isinstance(item, str) or not item for item in provenance[key]) for key in PROVENANCE_KEYS):
        raise ModelArtifactError("training provenance required for independent evaluation")
    return artifact

def evaluate(model_path: Path, expected_sha256: str, manifest_path: Path) -> dict:
    """只测validation/test/OOD；训练来源交集立即拒绝，阈值不调参。"""
    artifact = load_model(model_path, expected_sha256)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    clips = env.validate_manifest(manifest)
    heldout = [clip for clip in clips if clip["split"] != "TRAIN"]
    for clip in heldout:
        for key in PROVENANCE_KEYS:
            if clip[key] in artifact["trainingProvenance"][key]:
                raise ModelArtifactError(f"training/{clip['split']} {key} leakage")
    report = {"scope": "REAL_LABELED_OFFLINE_NOT_DEVICE_ACCEPTANCE", "isProductionApproved": False,
              "modelSha256": expected_sha256, "manifestSha256": sha256_file(manifest_path),
              "precision": "FLOAT32_WEIGHTS_FLOAT64_DSP", "splits": {}}
    for split in ("VALIDATION", "TEST", "OOD_TEST"):
        truth, predictions, recordings = [], [], {}
        for clip in heldout:
            if clip["split"] != split:
                continue
            audio = (manifest_path.parent / clip["path"]).resolve()
            if sha256_file(audio) != clip["sha256"]:
                raise ModelArtifactError("audio integrity mismatch")
            features = env.read_windows(audio)
            guessed, _ = env.predict(artifact, features, artifact["minConfidence"], artifact["maxZ"])
            actual = np.full(len(features), -1 if split == "OOD_TEST" else env.LABELS.index(clip["label"]), dtype=int)
            truth.extend(actual); predictions.extend(guessed)
            bucket = recordings.setdefault(clip["recordingId"], [[], []])
            bucket[0].extend(actual); bucket[1].extend(guessed)
        actual = np.asarray(truth); guessed = np.asarray(predictions)
        if split == "OOD_TEST":
            result = {"windowCount": len(actual), "falseAcceptanceRate": float(np.mean(guessed >= 0)), "rejectionRate": float(np.mean(guessed < 0))}
        else:
            result = env.metrics(actual, guessed)
            result["recordingBalancedAccuracy"] = float(np.mean([np.mean(np.asarray(values[0]) == np.asarray(values[1])) for values in recordings.values()]))
        result["recordingCount"] = len(recordings)
        report["splits"][split] = result
    return report

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--model-sha256", required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("evaluation output exists; use a fresh file")
    report = evaluate(args.model, args.model_sha256, args.manifest)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")

if __name__ == "__main__":
    main()
