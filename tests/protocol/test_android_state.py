"""Host-execute production Kotlin PetStore when compiler and JVM org.json exist.

Set KOTLINC or KOTLIN_COMPILER_CLASSPATH, JSON_JAR, and JAVA_HOME if needed.
Only Context.filesDir and AtomicFile are substituted. No Android SDK is installed.
"""
import copy
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from test_contract import ROOT, fixture


class AndroidStateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        json_candidates = [Path(os.environ["JSON_JAR"])] if os.environ.get("JSON_JAR") else []
        json_candidates += list((ROOT / ".tools").glob("**/json-*.jar"))
        cls.json_jar = next((path for path in json_candidates if path.is_file()), None)
        if not cls.json_jar:
            raise unittest.SkipTest("JVM org.json unavailable: set JSON_JAR; production Android PetStore NOT tested")
        java = str(Path(os.environ["JAVA_HOME"]) / "bin/java") if os.environ.get("JAVA_HOME") else shutil.which("java")
        kotlinc = os.environ.get("KOTLINC") or shutil.which("kotlinc")
        compiler_cp = os.environ.get("KOTLIN_COMPILER_CLASSPATH")
        kotlin_lib = None
        if compiler_cp:
            kotlin_lib = Path(compiler_cp.split(os.pathsep)[0].rstrip("*"))
        if not kotlinc and not compiler_cp:
            gradle_compilers = list((ROOT / ".tools").glob("**/lib/kotlin-compiler-embeddable-*.jar"))
            if gradle_compilers:
                kotlin_lib = gradle_compilers[0].parent
                compiler_cp = str(kotlin_lib / "*")
        if not java or (not kotlinc and not compiler_cp):
            raise unittest.SkipTest("existing Java/Kotlin compiler unavailable; production Android PetStore NOT tested")
        if kotlinc and not kotlin_lib:
            kotlin_lib = Path(kotlinc).resolve().parent.parent / "lib"
        stdlibs = list(kotlin_lib.glob("kotlin-stdlib*.jar")) if kotlin_lib else []
        if not stdlibs:
            raise unittest.SkipTest("Kotlin stdlib unavailable; set compiler classpath to existing compiler lib directory")
        cls.temp = tempfile.TemporaryDirectory(prefix="catforest-kotlin-")
        output = Path(cls.temp.name) / "classes"
        host = Path(__file__).parent / "host/android"
        classpath = os.pathsep.join(map(str, [cls.json_jar, *stdlibs]))
        compiler = [kotlinc] if kotlinc else [java, "-cp", compiler_cp, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler"]
        production = ROOT / "app/android/app/src/main/java/com/catforest/app"
        arguments = ["-no-stdlib", "-no-reflect", "-classpath", classpath, "-d", str(output), *map(str, host.glob("*.kt")), str(production / "PetStore.kt")]
        for dependency in ("AppearanceCatalog.kt", "LocalLifeRules.kt"):
            if (production / dependency).is_file():
                arguments.append(str(production / dependency))
        build = subprocess.run(compiler + arguments, capture_output=True, text=True, timeout=120)
        if build.returncode:
            raise AssertionError("Production PetStore harness could not compile:\n" + build.stdout + build.stderr)
        cls.command = [java, "-cp", os.pathsep.join([str(output), classpath]), "PetStoreHarnessKt"]

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "temp"):
            cls.temp.cleanup()

    def setUp(self):
        self.storage = tempfile.TemporaryDirectory(prefix="catforest-android-state-")

    def tearDown(self):
        self.storage.cleanup()

    def execute(self, commands):
        run = subprocess.run(self.command + [self.storage.name], input="".join(json.dumps(command, ensure_ascii=False) + "\n" for command in commands), capture_output=True, text=True, check=True)
        return [json.loads(line) for line in run.stdout.splitlines() if line.strip()]

    def event(self, pet):
        return dict(fixture("pet-event.json"), petId=pet)

    def test_actual_store_persists_pet_and_care(self):
        original = self.execute([{"op": "state"}])[0]["state"]
        after = self.execute([{"op": "care", "action": "pet"}, {"op": "state"}])[-1]["state"]
        self.assertEqual(after["petId"], original["petId"])
        self.assertEqual(after["revision"], original["revision"] + 1)
        self.assertEqual(after["stats"]["mood"], original["stats"]["mood"] + 9)
        self.assertEqual(self.execute([{"op": "state"}])[0]["state"], after)

    def test_actual_event_dedup_survives_process_restart(self):
        original = self.execute([{"op": "state"}])[0]["state"]
        event = self.event(original["petId"])
        rows = self.execute([{"op": "event", "event": event}, {"op": "state"}])
        self.assertEqual(rows[0]["ack"]["status"], "applied")
        after = rows[1]["state"]
        rows = self.execute([{"op": "event", "event": event}, {"op": "state"}])
        self.assertEqual(rows[0]["ack"]["status"], "duplicate")
        self.assertEqual(rows[1]["state"], after)

    def test_actual_pet_event_clamps_near_cap(self):
        for mood in [97, 98, 99, 100]:
            with self.subTest(mood=mood):
                self.execute([{"op": "prepare_mood", "mood": mood}])
                before = self.execute([{"op": "state"}])[0]["state"]
                event = dict(self.event(before["petId"]), eventId=f"cap-{mood}")
                rows = self.execute([{"op": "event", "event": event}, {"op": "state"}])
                self.assertEqual(rows[0]["ack"]["status"], "applied")
                self.assertEqual(rows[1]["state"]["stats"]["mood"], 100)
                self.assertEqual(rows[1]["state"]["revision"], before["revision"] + 1)

    def test_actual_store_rejects_coerced_numbers_and_mismatch(self):
        before = self.execute([{"op": "state"}])[0]["state"]
        event = self.event(before["petId"])
        for change in [{"protocolVersion": True}, {"protocolVersion": 1.5}, {"protocolVersion": "1"}, {"timestampMs": True}, {"timestampMs": 1.5}, {"timestampMs": "1"}, {"timestampMs": -1}, {"petId": "other-pet"}, {"type": "feed"}]:
            with self.subTest(change=change):
                rows = self.execute([{"op": "event", "event": dict(event, **change)}, {"op": "state"}])
                self.assertEqual(rows[0]["ack"]["status"], "rejected")
                self.assertEqual(rows[1]["state"], before)

    def test_actual_store_failed_commit_does_not_ack_or_mutate(self):
        before = self.execute([{"op": "state"}])[0]["state"]
        event = self.event(before["petId"])
        rows = self.execute([{"op": "fail_next_write"}, {"op": "event", "event": event}, {"op": "state"}])
        self.assertFalse(rows[1]["ok"])
        self.assertNotIn("ack", rows[1], "transient disk failure must leave the badge event unacknowledged for retry")
        self.assertEqual(rows[1]["errorType"], "StorageFailure")
        self.assertEqual(rows[2]["state"], before)
        rows = self.execute([{"op": "event", "event": event}])
        self.assertEqual(rows[0]["ack"]["status"], "applied")

    def test_actual_backup_restore_preserves_dedup_and_advances_revision(self):
        before = self.execute([{"op": "state"}, {"op": "export"}])
        event = self.event(before[0]["state"]["petId"])
        after = self.execute([{"op": "event", "event": event}, {"op": "state"}])[-1]["state"]
        rows = self.execute([{"op": "restore", "backup": before[1]["backup"]}, {"op": "state"}, {"op": "event", "event": event}])
        self.assertTrue(rows[0]["ok"])
        self.assertGreater(rows[1]["state"]["revision"], after["revision"])
        self.assertEqual(rows[1]["state"]["petId"], after["petId"])
        self.assertEqual(rows[2]["ack"]["status"], "duplicate")

    def test_actual_silent_finish_failure_does_not_ack_and_retries_old_disk_state(self):
        before = self.execute([{"op": "state"}])[0]["state"]
        event = self.event(before["petId"])
        rows = self.execute([{"op": "silent_finish_failure"}, {"op": "event", "event": event},
                             {"op": "state"}, {"op": "retry_read"}, {"op": "state"},
                             {"op": "event", "event": event}, {"op": "state"}])
        self.assertFalse(rows[1]["ok"])
        self.assertNotIn("ack", rows[1])
        self.assertEqual(rows[1]["errorType"], "StorageFailure")
        self.assertTrue(rows[2]["blocked"])
        self.assertEqual(rows[2]["state"], before)
        self.assertTrue(rows[3]["ok"])
        self.assertFalse(rows[4]["blocked"])
        self.assertEqual(rows[4]["state"], before)
        self.assertEqual(rows[5]["ack"]["status"], "applied")
        self.assertEqual(rows[6]["state"]["revision"], before["revision"] + 1)
        self.assertEqual(rows[6]["state"]["stats"]["mood"], before["stats"]["mood"] + 9)

    def test_actual_committed_but_unreadable_finish_reloads_dedup_before_ack(self):
        before = self.execute([{"op": "state"}])[0]["state"]
        event = self.event(before["petId"])
        rows = self.execute([{"op": "fail_read_after_finish"}, {"op": "event", "event": event},
                             {"op": "state"}, {"op": "retry_read"}, {"op": "state"},
                             {"op": "event", "event": event}, {"op": "state"}])
        self.assertFalse(rows[1]["ok"])
        self.assertNotIn("ack", rows[1])
        self.assertTrue(rows[2]["blocked"])
        self.assertEqual(rows[2]["state"], before)
        self.assertTrue(rows[3]["ok"])
        self.assertFalse(rows[4]["blocked"])
        self.assertEqual(rows[4]["state"]["revision"], before["revision"] + 1)
        self.assertEqual(rows[4]["state"]["stats"]["mood"], before["stats"]["mood"] + 9)
        self.assertEqual(rows[5]["ack"]["status"], "duplicate")
        self.assertEqual(rows[6]["state"], rows[4]["state"])

    def test_actual_corrupt_store_blocks_without_overwriting_and_restores(self):
        original = self.execute([{"op": "state"}, {"op": "export"}])
        rows = self.execute([{"op": "corrupt"}, {"op": "restart"}, {"op": "care", "action": "pet"}, {"op": "export"}])
        self.assertTrue(rows[1]["blocked"])
        self.assertFalse(rows[2]["ok"])
        self.assertFalse(rows[3]["ok"])
        self.assertEqual((Path(self.storage.name) / "pet-state.json").read_text(), "corrupted test fixture")
        restored = self.execute([{"op": "restore", "backup": original[1]["backup"]}, {"op": "state"}])
        self.assertTrue(restored[0]["ok"])
        self.assertEqual(restored[1]["state"]["petId"], original[0]["state"]["petId"])
        self.assertFalse(restored[1]["blocked"])


if __name__ == "__main__":
    unittest.main()
