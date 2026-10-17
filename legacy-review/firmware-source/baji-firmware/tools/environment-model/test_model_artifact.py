"""制品数值/安全回归；全部临时fixture，不是声学场景准确率。"""
from __future__ import annotations
import copy
import json
from pathlib import Path
import tempfile
import unittest
import numpy as np
import environment_model as env
import model_artifact as artifact
from test_environment_model import complete_manifest


def numerical_artifact() -> dict:
    manifest = complete_manifest()
    return dict(schema=env.SCHEMA, version=1, labels=env.LABELS, isProductionApproved=False,
                mean=[0.0] * 24, scale=[1.0] * 24, weights=np.zeros((4, 24)).tolist(), bias=[0.0] * 4,
                minConfidence=0.7, maxZ=8.0, licenses=['CC0-1.0'],
                trainingProvenance={key: [clip[key] for clip in manifest['clips'] if clip['split'] == 'TRAIN'] for key in artifact.PROVENANCE_KEYS})


class ArtifactTests(unittest.TestCase):
    def load_fixture(self, value: dict) -> dict:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'numeric-model.json'
            path.write_text(json.dumps(value), encoding='utf-8')
            return artifact.load_model(path, artifact.sha256_file(path))

    def test_load_float32_and_native_header(self) -> None:
        value = numerical_artifact()
        loaded = self.load_fixture(value)
        self.assertEqual(loaded['weights'].shape, (4, 24))
        header = env.firmware_header(value, 'a' * 64)
        self.assertIn('bj_env_weights_t bj_env_exported_weights', header)
        self.assertIn('BJ_ENV_MODEL_VERSION 1u', header)
        self.assertIn('BJ_ENV_EXPERIMENTAL_MODEL 1', header)
        self.assertIn('"' + 'a' * 64 + '"', header)
        value['minConfidence'] = 1
        self.assertIn('.min_confidence = 1.0f', env.firmware_header(value))
        value['maxZ'] = 1e-12
        self.assertNotIn('.max_z = 0.', env.firmware_header(value))

    def test_tamper_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'numeric-model.json'
            path.write_text(json.dumps(numerical_artifact()), encoding='utf-8')
            digest = artifact.sha256_file(path)
            path.write_text(path.read_text() + ' ', encoding='utf-8')
            with self.assertRaisesRegex(artifact.ModelArtifactError, 'SHA256'):
                artifact.load_model(path, digest)

    def test_schema_version_labels_and_approval_rejected(self) -> None:
        for key, invalid in (('version', True), ('version', 2), ('labels', list(reversed(env.LABELS))), ('isProductionApproved', True), ('licenses', ['CC-BY-NC-4.0']), ('trainingProvenance', {})):
            value = numerical_artifact(); value[key] = invalid
            with self.assertRaises(artifact.ModelArtifactError):
                self.load_fixture(value)

    def test_invalid_shapes_scales_and_float32_overflow(self) -> None:
        for key, invalid in (('mean', [0.0]), ('weights', [0.0] * 96), ('scale', [0.0] * 24), ('scale', [1e-99] * 24), ('bias', [1e99] * 4), ('maxZ', 1e99), ('minConfidence', True)):
            value = numerical_artifact(); value[key] = invalid
            with self.assertRaises(artifact.ModelArtifactError):
                self.load_fixture(value)

    def test_evaluation_counts_numeric_windows_not_scene_accuracy(self) -> None:
        import wave
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            manifest = complete_manifest()
            for number, clip in enumerate(manifest['clips']):
                audio = folder / clip['path']
                with wave.open(str(audio), 'wb') as writer:
                    writer.setnchannels(2); writer.setsampwidth(2); writer.setframerate(16000)
                    writer.writeframes(np.full((16000, 2), number + 1, dtype='<i2').tobytes())
                clip['sha256'] = artifact.sha256_file(audio)
            value = numerical_artifact()
            value['trainingProvenance'] = {key: [clip[key] for clip in manifest['clips'] if clip['split'] == 'TRAIN'] for key in artifact.PROVENANCE_KEYS}
            model_path = folder / 'numeric-model.json'; manifest_path = folder / 'manifest.json'
            model_path.write_text(json.dumps(value), encoding='utf-8')
            manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
            report = artifact.evaluate(model_path, artifact.sha256_file(model_path), manifest_path)
            self.assertEqual(report['splits']['TEST']['windowCount'], 4)
            self.assertEqual(report['splits']['TEST']['recordingCount'], 4)
            self.assertEqual(report['splits']['OOD_TEST']['windowCount'], 1)
            self.assertFalse(report['isProductionApproved'])

    def test_training_export_and_evaluation_cli_roundtrip_numeric_only(self) -> None:
        import sys
        import wave
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory); manifest = complete_manifest()
            for number, clip in enumerate(manifest['clips']):
                audio = folder / clip['path']
                with wave.open(str(audio), 'wb') as writer:
                    writer.setnchannels(2); writer.setsampwidth(2); writer.setframerate(16000)
                    writer.writeframes(np.full((16000, 2), number + 1, dtype='<i2').tobytes())
                clip['sha256'] = artifact.sha256_file(audio)
            manifest_path = folder / 'numeric-manifest.json'
            manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
            output = folder / 'numeric-experiment'
            with patch.object(sys, 'argv', ['environment_model.py', str(manifest_path), str(output), '--min-confidence', '0.75', '--max-z', '8', '--epochs', '2']):
                env.main()
            hashes = json.loads((output / 'artifact-sha256.json').read_text())
            for name, digest in hashes.items():
                self.assertEqual(artifact.sha256_file(output / name), digest)
            model_path = output / 'model.json'; digest = hashes['model.json']
            loaded = artifact.load_model(model_path, digest)
            self.assertFalse(loaded['isProductionApproved'])
            self.assertIn(digest, (output / 'baji_env_model_data.h').read_text())
            evaluation_path = folder / 'numeric-evaluation.json'
            with patch.object(sys, 'argv', ['model_artifact.py', str(model_path), str(manifest_path), str(evaluation_path), '--model-sha256', digest]):
                artifact.main()
            evaluation = json.loads(evaluation_path.read_text())
            self.assertEqual(evaluation['splits']['TEST']['windowCount'], 4)
            self.assertEqual(evaluation['modelSha256'], digest)
            self.assertEqual(len(evaluation['splits']['TEST']['confusionMatrix']), 4)
            with patch.object(sys, 'argv', ['model_artifact.py', str(model_path), str(manifest_path), str(evaluation_path), '--model-sha256', digest]):
                with self.assertRaises(SystemExit):
                    artifact.main()

    def test_independent_evaluation_rejects_training_source_before_pcm(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            model_path = folder / 'numeric-model.json'; manifest_path = folder / 'manifest.json'
            value = numerical_artifact(); manifest = complete_manifest()
            # 输入manifest内部仍隔离，但已有模型的来源交集必须独立拒绝。
            value['trainingProvenance']['recordingId'].append(manifest['clips'][4]['recordingId'])
            model_path.write_text(json.dumps(value), encoding='utf-8')
            manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
            with self.assertRaisesRegex(artifact.ModelArtifactError, 'recordingId leakage'):
                artifact.evaluate(model_path, artifact.sha256_file(model_path), manifest_path)

if __name__ == '__main__':
    unittest.main()
