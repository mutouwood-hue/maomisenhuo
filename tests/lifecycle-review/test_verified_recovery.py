"""Production state fault recovery. Host files only; no Android/ESP build/device."""
from pathlib import Path
import json
import os
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class VerifiedRecoveryTests(unittest.TestCase):
    def test_post_commit_backup_failure_and_cold_corruption_preserve_event_once(self):
        java_paths = sorted((ROOT / ".tools/java").glob("**/bin/java"))
        compiler_lib = ROOT / ".tools/gradle-8.9/lib"
        json_jar = ROOT / ".tools/downloads/json-20240303.jar"
        if not java_paths or not json_jar.is_file() or not compiler_lib.is_dir():
            self.skipTest("existing project JDK/Kotlin compiler/JSON jar unavailable")
        java = str(java_paths[0])
        cp = os.pathsep.join([str(json_jar), *map(str, compiler_lib.glob("kotlin-stdlib*.jar"))])
        with tempfile.TemporaryDirectory(prefix="catforest-backup-review-") as temporary:
            folder = Path(temporary)
            host = ROOT / "tests/protocol/host/android"
            (folder / "Context.kt").write_text((host / "Context.kt").read_text())
            atomic = (host / "AtomicFile.kt").read_text()
            marker = 'if (!staging.renameTo(baseFile)) throw IOException("host atomic rename failed")'
            self.assertIn(marker, atomic)
            atomic = atomic.replace(marker, marker + "\n        obstructRecoveryAfterFinish?.let { it.mkdirs(); obstructRecoveryAfterFinish = null }")
            atomic = atomic.replace("companion object {", "companion object { var obstructRecoveryAfterFinish: File? = null;")
            (folder / "AtomicFile.kt").write_text(atomic)
            (folder / "RecoveryProbe.kt").write_text('''
import android.content.Context
import android.util.AtomicFile
import com.catforest.app.PetStore
import org.json.JSONObject
import java.io.File
fun main(args: Array<String>) {
    val directory = File(args.single()).also { it.mkdirs() }
    val context = Context(directory)
    val store = PetStore(context)
    val before = store.state()
    val event = JSONObject().put("protocolVersion",1).put("kind","event")
        .put("petId",before.getString("petId")).put("deviceId","recovery-badge")
        .put("eventId","recovery-badge-1").put("type","pet").put("timestampMs",0L)
    // Primary rename succeeds, but the subsequent last-verified backup cannot open its temp file.
    val obstruction = File(directory,"recovery/last-verified-save.tmp")
    AtomicFile.obstructRecoveryAfterFinish = obstruction
    var ack = "none"; var error = "none"
    try { ack = store.badgeEvent(event).getString("status") }
    catch (failure: Exception) { error = failure.javaClass.simpleName }
    val blockedAfterCommit = store.blocked
    val memoryAfterCommit = store.state()
    var recheckWhileBlocked = "success"
    try { store.retryRead() } catch (failure: Exception) { recheckWhileBlocked = failure.javaClass.simpleName }
    val memoryAfterFailedRecheck = store.state()
    check(obstruction.isDirectory && obstruction.delete())
    store.retryRead()
    val reloaded = store.state()
    val duplicateAfterReload = store.badgeEvent(event).getString("status")
    File(directory,"pet-state.json").writeText("corrupt primary after acknowledged state")
    val cold = PetStore(context)
    val coldBlocked = cold.blocked
    cold.restoreLocalRecovery()
    val recovered = cold.state()
    val duplicateAfterRecovery = cold.badgeEvent(event).getString("status")
    println(JSONObject().put("ackAfterCommit",ack).put("errorAfterCommit",error)
        .put("blockedAfterCommit",blockedAfterCommit).put("failedRecheck",recheckWhileBlocked)
        .put("beforeRevision",before.getLong("revision"))
        .put("memoryRevisionAfterCommit",memoryAfterCommit.getLong("revision"))
        .put("memoryRevisionAfterFailedRecheck",memoryAfterFailedRecheck.getLong("revision"))
        .put("reloadedRevision",reloaded.getLong("revision"))
        .put("coldBlocked",coldBlocked).put("recoveredRevision",recovered.getLong("revision"))
        .put("samePet",recovered.getString("petId")==before.getString("petId"))
        .put("beforeMood",before.getJSONObject("stats").getDouble("mood"))
        .put("reloadedMood",reloaded.getJSONObject("stats").getDouble("mood"))
        .put("recoveredMood",recovered.getJSONObject("stats").getDouble("mood"))
        .put("duplicateAfterReload",duplicateAfterReload).put("duplicateAfterRecovery",duplicateAfterRecovery))
}
''')
            production = ROOT / "app/android/app/src/main/java/com/catforest/app"
            sources = [production / name for name in ("PetStore.kt", "AppearanceCatalog.kt", "LocalLifeRules.kt") if (production / name).is_file()]
            classes = folder / "classes"
            build = subprocess.run([java, "-cp", str(compiler_lib / "*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler",
                                    "-no-stdlib", "-no-reflect", "-classpath", cp, "-d", str(classes),
                                    *map(str, folder.glob("*.kt")), *map(str, sources)], capture_output=True, text=True, timeout=90)
            self.assertEqual(build.returncode, 0, build.stdout + build.stderr)
            run = subprocess.run([java, "-cp", os.pathsep.join([str(classes), cp]), "RecoveryProbeKt", str(folder / "save")],
                                 capture_output=True, text=True, timeout=20, check=True)
            result = json.loads(run.stdout.strip())
            print("VERIFIED_RECOVERY_OBSERVATION", json.dumps(result, sort_keys=True), flush=True)
            self.assertEqual(result["ackAfterCommit"], "none")
            self.assertEqual(result["errorAfterCommit"], "StorageFailure")
            self.assertTrue(result["blockedAfterCommit"])
            self.assertEqual(result["failedRecheck"], "StorageFailure")
            self.assertEqual(result["memoryRevisionAfterCommit"], result["beforeRevision"])
            self.assertEqual(result["memoryRevisionAfterFailedRecheck"], result["beforeRevision"])
            self.assertEqual(result["reloadedRevision"], result["beforeRevision"] + 1)
            self.assertEqual(result["reloadedMood"], result["beforeMood"] + 9)
            self.assertTrue(result["coldBlocked"])
            self.assertTrue(result["samePet"])
            self.assertGreater(result["recoveredRevision"], result["reloadedRevision"])
            self.assertEqual(result["recoveredMood"], result["reloadedMood"])
            self.assertEqual(result["duplicateAfterReload"], "duplicate")
            self.assertEqual(result["duplicateAfterRecovery"], "duplicate")


if __name__ == "__main__":
    unittest.main(verbosity=2)
