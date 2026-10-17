"""Exercise production badge_state.c with real cJSON and host NVS fault injection."""
import copy
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from contract import STATS, validate
from test_contract import ROOT, fixture


class FirmwareStateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        candidates = [Path(os.environ["CJSON_DIR"])] if os.environ.get("CJSON_DIR") else []
        candidates += [ROOT / ".tools/idf-tools/cjson-pinned", ROOT / ".tools/esp-idf/components/json/cJSON", ROOT / ".tools/esp-idf/components/json/cJSON/cJSON"]
        cls.cjson = next((path for path in candidates if (path / "cJSON.c").is_file() and (path / "cJSON.h").is_file()), None)
        if not cls.cjson:
            raise unittest.SkipTest("actual cJSON source unavailable: set CJSON_DIR; production state logic NOT tested")
        compiler = shutil.which("cc")
        if not compiler:
            raise unittest.SkipTest("host C compiler unavailable: production state logic NOT tested")
        cls.temp = tempfile.TemporaryDirectory(prefix="catforest-state-")
        cls.executable = Path(cls.temp.name) / "badge_state"
        harness = Path(__file__).parent / "host"
        build = subprocess.run([compiler, "-std=c11", "-Wall", "-Wextra", "-I", str(harness / "include"), "-I", str(ROOT / "firmware/main"), "-I", str(cls.cjson), str(harness / "state_harness.c"), str(ROOT / "firmware/main/badge_wire.c"), str(cls.cjson / "cJSON.c"), "-lm", "-o", str(cls.executable)], capture_output=True, text=True)
        if build.returncode:
            raise AssertionError("Production state harness could not compile:\n" + build.stderr)

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "temp"):
            cls.temp.cleanup()

    def setUp(self):
        self.storage = tempfile.TemporaryDirectory(prefix="catforest-nvs-")
        self.path = Path(self.storage.name) / "state.bin"
        self.snapshot = fixture("snapshot.json")

    def tearDown(self):
        self.storage.cleanup()

    def execute(self, commands):
        text = "".join((json.dumps(command, ensure_ascii=False) if isinstance(command, dict) else command) + "\n" for command in commands)
        run = subprocess.run([str(self.executable), str(self.path)], input=text, capture_output=True, text=True, check=True)
        rows = []
        for line in run.stdout.splitlines():
            label, _, body = line.partition(" ")
            rows.append((label, json.loads(body) if label in {"VIEW", "STATUS", "EVENT"} else body))
        return rows

    @staticmethod
    def values(rows, label):
        return [body for kind, body in rows if kind == label]

    def assert_view_matches(self, view, snapshot):
        for key in ("petId", "revision", "updatedAtMs", "coins", *STATS):
            self.assertEqual(view[key], snapshot[key], key)

    def test_snapshot_persists_across_process_restart(self):
        rows = self.execute([self.snapshot, "!view"])
        self.assert_view_matches(self.values(rows, "VIEW")[-1], self.snapshot)
        status = self.values(rows, "STATUS")[-1]
        self.assertEqual(status["status"], "synced")
        validate(status)
        self.assert_view_matches(self.values(self.execute(["!view"]), "VIEW")[-1], self.snapshot)

    def test_stale_mismatch_and_equal_revision_conflict_do_not_overwrite(self):
        mutations = [({"revision": self.snapshot["revision"] - 1, "food": 10}, "stale"), ({"petId": "00000000-0000-4000-8000-000000000000"}, "pet_mismatch"), ({"food": 10}, "revision_conflict"), ({"updatedAtMs": self.snapshot["updatedAtMs"] + 1}, "revision_conflict")]
        self.execute([self.snapshot])
        for change, expected in mutations:
            with self.subTest(change=change):
                rows = self.execute([dict(self.snapshot, **change), "!view"])
                self.assertEqual(self.values(rows, "STATUS")[-1]["status"], expected)
                self.assert_view_matches(self.values(rows, "VIEW")[-1], self.snapshot)
        rows = self.execute([self.snapshot, "!view"])
        self.assertEqual(self.values(rows, "STATUS")[-1]["status"], "synced")
        self.assert_view_matches(self.values(rows, "VIEW")[-1], self.snapshot)

    def test_invalid_fields_reject_without_mutation(self):
        self.execute([self.snapshot])
        for key in (*STATS, "revision", "coins", "updatedAtMs"):
            values = [-1, True, 0.5, "1", None]
            if key in STATS:
                values += [101]
            for value in values:
                with self.subTest(key=key, value=value):
                    rows = self.execute([dict(self.snapshot, **{key: value}), "!view"])
                    self.assertEqual(self.values(rows, "STATUS")[-1]["status"], "error")
                    self.assert_view_matches(self.values(rows, "VIEW")[-1], self.snapshot)

    def test_invalid_json_version_and_kind_recover(self):
        rows = self.execute(["{bad}", dict(self.snapshot, protocolVersion=2), dict(self.snapshot, kind="factory_reset"), self.snapshot, "!view"])
        statuses = self.values(rows, "STATUS")
        self.assertEqual([row["status"] for row in statuses], ["error", "error", "error", "synced"])
        for row in statuses:
            validate(row)
        self.assert_view_matches(self.values(rows, "VIEW")[-1], self.snapshot)

    def test_invalid_utf8_cannot_bind_then_stream_recovers(self):
        invalid = json.dumps(dict(self.snapshot, note="placeholder")).encode().replace(b"placeholder", b"\xff")
        valid = json.dumps(self.snapshot).encode()
        run = subprocess.run([str(self.executable), str(self.path)], input=invalid + b"\n" + valid + b"\n!view\n", capture_output=True, check=True)
        rows = [json.loads(line[7:]) for line in run.stdout.decode().splitlines() if line.startswith("STATUS ")]
        self.assertEqual([row["status"] for row in rows], ["error", "synced"])

    def test_embedded_nul_in_pet_id_is_not_truncated_to_a_valid_uuid(self):
        rows = self.execute([dict(self.snapshot, petId=self.snapshot["petId"] + "\x00suffix"), "!view"])
        self.assertEqual(self.values(rows, "STATUS")[-1]["status"], "error")
        self.assertEqual(self.values(rows, "VIEW")[-1]["petId"], "")

    def test_snapshot_does_not_truncate_wide_integer_fields(self):
        snapshot = dict(self.snapshot, coins=2**40, revision=2**40, updatedAtMs=2**45)
        rows = self.execute([snapshot, "!view"])
        self.assertEqual(self.values(rows, "STATUS")[-1]["status"], "synced")
        self.assert_view_matches(self.values(rows, "VIEW")[-1], snapshot)

    def test_event_is_durable_and_sequence_never_repeats(self):
        rows = self.execute([self.snapshot, "!pet", "!next", "!view"])
        event = self.values(rows, "EVENT")[-1]
        validate(event)
        self.assertEqual(event["petId"], self.snapshot["petId"])
        self.assertEqual(self.values(rows, "VIEW")[-1]["pending"], 1)
        restarted = self.execute(["!next"])
        self.assertEqual(self.values(restarted, "EVENT")[-1], event)
        ack = {"protocolVersion": 1, "kind": "ack", "eventId": event["eventId"], "status": "applied", "revision": self.snapshot["revision"] + 1}
        rows = self.execute([ack, "!pet", "!next", "!view"])
        self.assertNotEqual(self.values(rows, "EVENT")[-1]["eventId"], event["eventId"])
        self.assertEqual(self.values(rows, "VIEW")[-1]["pending"], 1)
        self.assertEqual(self.values(rows, "EVENT")[-1]["timestampMs"], 0, "clock unknown after cold boot")

    def test_failed_snapshot_commit_never_reports_synced(self):
        self.execute([self.snapshot])
        rows = self.execute(["!fail_commit", dict(self.snapshot, revision=self.snapshot["revision"] + 1, food=20), "!view"])
        self.assertEqual(self.values(rows, "STATUS")[-1]["status"], "error")
        self.assert_view_matches(self.values(rows, "VIEW")[-1], self.snapshot)
        self.assert_view_matches(self.values(self.execute(["!view"]), "VIEW")[-1], self.snapshot)

    def test_failed_event_commit_cannot_accept_touch(self):
        rows = self.execute([self.snapshot, "!fail_commit", "!pet", "!view"])
        self.assertNotEqual(self.values(rows, "PET")[-1], "0")
        self.assertEqual(self.values(rows, "VIEW")[-1]["pending"], 0)
        self.assertEqual(self.values(self.execute(["!view"]), "VIEW")[-1]["pending"], 0)

    def test_ack_removal_is_durable_and_unknown_ack_is_ignored(self):
        event = self.values(self.execute([self.snapshot, "!pet", "!next"]), "EVENT")[-1]
        ack = {"protocolVersion": 1, "kind": "ack", "eventId": event["eventId"], "status": "rejected", "revision": self.snapshot["revision"]}
        for commands in [["!fail_commit", dict(ack, status="applied")], [dict(ack, status="applied", eventId="unknown-event")]]:
            rows = self.execute(commands + ["!view", "!next"])
            self.assertEqual(self.values(rows, "VIEW")[-1]["pending"], 1)
            self.assertEqual(self.values(rows, "EVENT")[-1], event)
        self.execute([dict(ack, status="duplicate")])
        rows = self.execute(["!view", "!next"])
        self.assertEqual(self.values(rows, "VIEW")[-1]["pending"], 0)
        self.assertTrue(any(kind == "EMPTY" for kind, _ in rows))

    def test_rejected_ack_preserves_and_quarantines_event_durably(self):
        event = self.values(self.execute([self.snapshot, "!pet", "!next"]), "EVENT")[-1]
        ack = {"protocolVersion": 1, "kind": "ack", "eventId": event["eventId"], "status": "rejected", "revision": self.snapshot["revision"]}
        self.execute([ack])
        rows = self.execute(["!view", "!next"])
        self.assertEqual(self.values(rows, "VIEW")[-1]["pending"], 1)
        self.assertEqual(self.values(rows, "VIEW")[-1]["blocked"], 1)
        self.assertTrue(any(kind == "EMPTY" for kind, _ in rows), "quarantined event must not be resent in a hot loop")

    def test_full_queue_rejects_new_touch_without_dropping_oldest(self):
        rows = self.execute([self.snapshot] + ["!pet"] * 201 + ["!view", "!next"])
        accepted = self.values(rows, "PET")
        self.assertEqual(accepted[:200], ["0"] * 200)
        self.assertNotEqual(accepted[200], "0")
        self.assertEqual(self.values(rows, "VIEW")[-1]["pending"], 200)
        first = self.values(rows, "EVENT")[-1]
        self.assertTrue(first["eventId"].endswith("-1"))
        self.assertEqual(self.values(self.execute(["!next"]), "EVENT")[-1], first)

    def test_corrupt_count_preserves_nvs_but_keeps_error_view_safe(self):
        self.execute([self.snapshot, "!pet", "!corrupt_count"])
        corrupt_blob = self.path.read_bytes()
        rows = self.execute(["!view", "!pet", "!next"])
        self.assertNotEqual(self.values(rows, "BOOT")[-1], "0")
        view = self.values(rows, "VIEW")[-1]
        self.assertTrue(view["storageError"])
        self.assertEqual(view["pending"], 0)
        self.assertEqual(view["petId"], "")
        self.assertNotEqual(self.values(rows, "PET")[-1], "0")
        self.assertTrue(any(kind == "EMPTY" for kind, _ in rows))
        self.assertEqual(self.path.read_bytes(), corrupt_blob, "invalid NVS must be preserved for recovery")

    def test_explicit_quarantine_retry_preserves_event_identity(self):
        event = self.values(self.execute([self.snapshot, "!pet", "!next"]), "EVENT")[-1]
        ack = {"protocolVersion": 1, "kind": "ack", "eventId": event["eventId"], "status": "rejected", "revision": self.snapshot["revision"]}
        self.execute([ack])
        rows = self.execute(["!retry_blocked", "!view", "!next"])
        self.assertEqual(self.values(rows, "RETRY")[-1], "0")
        self.assertEqual(self.values(rows, "VIEW")[-1]["pending"], 1)
        self.assertEqual(self.values(rows, "VIEW")[-1]["blocked"], 0)
        self.assertEqual(self.values(rows, "EVENT")[-1], event)
        self.assertEqual(self.values(self.execute(["!next"]), "EVENT")[-1], event)


if __name__ == "__main__":
    unittest.main()
