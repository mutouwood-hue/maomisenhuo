"""Numerical/validation tests only. Synthetic fixtures do NOT prove scene accuracy."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
import wave
import numpy as np
import environment_model as model


def complete_manifest():
    clips = []
    for split in ("TRAIN", "VALIDATION", "TEST"):
        for label in model.LABELS:
            number = len(clips) + 1
            clips.append(dict(id=f"test-{number}", path=f"fixture-{number}.wav", groupId=f"group-{number}", recordingId=f"recording-{number}", speakerGroupId=f"speakers-{number}", locationGroupId=f"location-{number}", sourceUrl="https://example.invalid/test-only", license="CC0-1.0", licenseUrl="https://creativecommons.org/publicdomain/zero/1.0/", attribution="numerical test fixture", authorizationRef="test-only-not-real-data", label=label, split=split, sha256=f"{number:064x}", labeler="test", captureDomain="NUMERICAL_FIXTURE_ONLY", isUseAuthorized=True, isPrivacyUseAuthorized=True))
    outlier = copy.deepcopy(clips[0])
    outlier.update(id="ood-test", path="ood.wav", groupId="ood", recordingId="ood-recording", speakerGroupId="ood-speakers", locationGroupId="ood-location", split="OOD_TEST", label="UNKNOWN", sha256=f"{99:064x}")
    clips.append(outlier)
    return dict(schema=model.SCHEMA, isRealLabeledAudio=True, clips=clips)


class EnvironmentModelTests(unittest.TestCase):
    def test_silent_features_finite_and_exact(self):
        output = model.frame_features(np.zeros((320, 2), dtype=np.int16))
        self.assertEqual(output.shape, (12,))
        self.assertTrue(np.isfinite(output).all())
        np.testing.assert_allclose(output[6:], np.log(1e-12))
        self.assertEqual(output[1], 0)
        self.assertEqual(output[2], 0)
        self.assertEqual(output[4], 0)

    def test_channel_mean_truncates_toward_zero(self):
        pcm = np.zeros((320, 2), dtype=np.int16)
        pcm[:, 0] = -1
        output = model.frame_features(pcm)
        self.assertEqual(output[3], 0)

    def test_full_scale_clipping_is_not_silence(self):
        pcm = np.full((320, 2), -32768, dtype=np.int16)
        output = model.frame_features(pcm)
        self.assertEqual(output[5], 1)
        self.assertAlmostEqual(output[3], 1)

    def test_window_aggregation_shape_and_variance(self):
        frame = model.frame_features(np.zeros((320, 2), dtype=np.int16))
        features = model.window_features(np.tile(frame, (50, 1)))
        np.testing.assert_allclose(features[:12], frame)
        np.testing.assert_allclose(features[12:], 0, atol=1e-6)
        with self.assertRaises(ValueError):
            model.window_features(np.zeros((49, 12)))

    def test_reject_partial_frame_and_wrong_dtype(self):
        for pcm in (np.zeros((319, 2), dtype=np.int16), np.zeros((320, 2), dtype=float)):
            with self.assertRaises(ValueError):
                model.frame_features(pcm)

    def test_manifest_requires_all_classes_and_no_group_leakage(self):
        manifest = complete_manifest()
        self.assertEqual(len(model.validate_manifest(manifest)), 13)
        manifest["clips"][4]["groupId"] = manifest["clips"][0]["groupId"]
        with self.assertRaisesRegex(ValueError, "leakage"):
            model.validate_manifest(manifest)
        manifest = complete_manifest()
        manifest["clips"].pop(11)
        with self.assertRaisesRegex(ValueError, "four classes"):
            model.validate_manifest(manifest)

    def test_multi_axis_provenance_and_ood_holdout(self):
        for key in ("recordingId", "speakerGroupId", "locationGroupId"):
            manifest = complete_manifest()
            manifest["clips"][4][key] = manifest["clips"][0][key]
            with self.assertRaisesRegex(ValueError, key + " leakage"):
                model.validate_manifest(manifest)
        manifest = complete_manifest()
        manifest["clips"].pop()
        with self.assertRaisesRegex(ValueError, "OOD_TEST"):
            model.validate_manifest(manifest)
        for key in ("licenseUrl", "attribution", "authorizationRef"):
            manifest = complete_manifest()
            del manifest["clips"][0][key]
            with self.assertRaisesRegex(ValueError, key):
                model.validate_manifest(manifest)

    def test_manifest_rejects_noncommercial_and_synthetic(self):
        manifest = complete_manifest()
        manifest["clips"][0]["license"] = "CC-BY-NC-4.0"
        with self.assertRaisesRegex(ValueError, "license"):
            model.validate_manifest(manifest)
        manifest = complete_manifest()
        manifest["isRealLabeledAudio"] = False
        with self.assertRaisesRegex(ValueError, "real"):
            model.validate_manifest(manifest)

    def test_duplicate_content_and_missing_authorization_rejected(self):
        manifest = complete_manifest()
        manifest["clips"][1]["sha256"] = manifest["clips"][0]["sha256"]
        with self.assertRaisesRegex(ValueError, "duplicate"):
            model.validate_manifest(manifest)
        manifest = complete_manifest()
        manifest["clips"][0]["isUseAuthorized"] = False
        with self.assertRaises(ValueError):
            model.validate_manifest(manifest)

    def test_wav_local_read_exact_format_and_drop_partial(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "numerical-only.wav"
            with wave.open(str(path), "wb") as writer:
                writer.setnchannels(2); writer.setsampwidth(2); writer.setframerate(16000)
                writer.writeframes(np.zeros((16319, 2), dtype="<i2").tobytes())
            self.assertEqual(model.read_windows(path).shape, (1, 24))
            with wave.open(str(path), "wb") as writer:
                writer.setnchannels(1); writer.setsampwidth(2); writer.setframerate(16000)
                writer.writeframes(np.zeros(16000, dtype="<i2").tobytes())
            with self.assertRaises(ValueError):
                model.read_windows(path)

    def test_optimization_and_export_numerical_only(self):
        rng = np.random.default_rng(15)
        x = np.repeat(np.eye(4, 24) * 4, 20, axis=0) + rng.normal(0, 0.1, (80, 24))
        y = np.repeat(np.arange(4), 20)
        trained = model.fit(x, y, epochs=300)
        guessed, confidence = model.predict(trained, x, 0.2, 100)
        self.assertTrue(np.all(guessed == y))  # Mathematical optimizer, NOT audio accuracy.
        rejected, _ = model.predict(trained, x + 1e6, 0.2, 10)
        self.assertTrue(np.all(rejected == -1))
        exported = {key: value.tolist() for key, value in trained.items()}
        exported.update(minConfidence=0.7, maxZ=10)
        header = model.c_header(exported)
        self.assertIn("NOT production approved", header)
        self.assertIn("bj_env_weights[96]", header)
        self.assertNotIn("nan", header)
        self.assertAlmostEqual(model.metrics(y, rejected)["rejectionRate"], 1)

    def test_local_dataset_integrity_and_group_components(self):
        import hashlib
        manifest = complete_manifest()
        # Only local numerical test assets; never run CLI or publish weights as real.
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            for number, clip in enumerate(manifest["clips"]):
                pcm = np.full((16000, 2), number + 1, dtype="<i2")
                audio = folder / clip["path"]
                with wave.open(str(audio), "wb") as writer:
                    writer.setnchannels(2); writer.setsampwidth(2); writer.setframerate(16000)
                    writer.writeframes(pcm.tobytes())
                clip["sha256"] = hashlib.sha256(audio.read_bytes()).hexdigest()
            manifest["clips"][1]["speakerGroupId"] = manifest["clips"][0]["speakerGroupId"]
            path = folder / "manifest.json"
            path.write_text(json.dumps(manifest), encoding="utf-8")
            datasets, _ = model.load_dataset(path)
            self.assertEqual(datasets["TRAIN"][2][0], datasets["TRAIN"][2][1])
            self.assertEqual(datasets["OOD_TEST"][1][0], -1)
            manifest["clips"][0]["sha256"] = "a" * 64
            path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "integrity"):
                model.load_dataset(path)

    def test_privacy_authorization_is_independent(self):
        manifest = complete_manifest()
        manifest["clips"][0]["isPrivacyUseAuthorized"] = False
        with self.assertRaisesRegex(ValueError, "privacy"):
            model.validate_manifest(manifest)

    def test_group_cross_validation_never_splits_same_source(self):
        x = np.tile(np.eye(4, 24), (6, 1))
        y = np.tile(np.arange(4), 6)
        groups = np.repeat([f"source-{i}" for i in range(6)], 4)
        reports = model.group_cross_validation(x, y, groups, 3, epochs=20)
        self.assertEqual(len(reports), 3)
        self.assertEqual(sum(report["windowCount"] for report in reports), 24)


if __name__ == "__main__":
    unittest.main()
