"""Production PetStore with a fault adapter matching AtomicFile's silent finish error.

No Android device/API execution. AOSP AtomicFile.finishWrite logs failed sync or
rename instead of throwing; this adapter specifically injects that return path.
Only an existing local JDK/compiler is used, with build files in a temp directory.
"""
from pathlib import Path
import json
import os
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class SilentFinishTests(unittest.TestCase):
    def test_ack_requires_successful_persistence_even_if_finish_returns_normally(self):
        java_paths = sorted((ROOT / ".tools/java").glob("**/bin/java"))
        compiler_lib = ROOT / ".tools/gradle-8.9/lib"
        json_jar = ROOT / ".tools/downloads/json-20240303.jar"
        if not java_paths or not json_jar.is_file() or not compiler_lib.is_dir():
            self.skipTest("existing project JDK/Kotlin compiler/JSON jar unavailable")
        java = str(java_paths[0])
        cp = os.pathsep.join([str(json_jar), *map(str, compiler_lib.glob("kotlin-stdlib*.jar"))])
        with tempfile.TemporaryDirectory(prefix="catforest-finish-review-") as temporary:
            folder = Path(temporary)
            host = ROOT / "tests/protocol/host/android"
            (folder / "Context.kt").write_text((host / "Context.kt").read_text())
            atomic = (host / "AtomicFile.kt").read_text()
            if "silentFinishFailure" not in atomic:
                atomic = atomic.replace("fun finishWrite(output: FileOutputStream?) {", """fun finishWrite(output: FileOutputStream?) {
        if (silentFinishFailure) {
            silentFinishFailure = false
            output?.close()
            return // platform API can log rename failure and return without throwing
        }""")
                atomic = atomic.replace("companion object {", "companion object { var silentFinishFailure = false;")
            (folder / "AtomicFile.kt").write_text(atomic)
            (folder / "Probe.kt").write_text('''
import android.content.Context
import android.util.AtomicFile
import com.catforest.app.PetStore
import org.json.JSONObject
import java.io.File
fun main(args: Array<String>) {
    val context = Context(File(args.single()).also { it.mkdirs() })
    val store = PetStore(context)
    val before = store.state()
    AtomicFile.silentFinishFailure = true
    val event = JSONObject().put("protocolVersion", 1).put("kind", "event")
        .put("petId", before.getString("petId")).put("deviceId", "review-badge")
        .put("eventId", "review-badge-1").put("type", "pet").put("timestampMs", 0L)
    var ack = "none"
    var error = "none"
    try { ack = store.badgeEvent(event).getString("status") }
    catch (failure: Exception) { error = failure.javaClass.simpleName }
    val memory = store.state()
    val restarted = PetStore(context).state()
    println(JSONObject().put("ack", ack).put("error", error)
        .put("beforeRevision", before.getLong("revision"))
        .put("memoryRevision", memory.getLong("revision"))
        .put("restartedRevision", restarted.getLong("revision")))
}
''')
            classes = folder / "classes"
            command = [java, "-cp", str(compiler_lib / "*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler",
                       "-no-stdlib", "-no-reflect", "-classpath", cp, "-d", str(classes),
                       *map(str, folder.glob("*.kt")),
                       str(ROOT / "app/android/app/src/main/java/com/catforest/app/PetStore.kt"),
                       str(ROOT / "app/android/app/src/main/java/com/catforest/app/AppearanceCatalog.kt")]
            local_rules = ROOT / "app/android/app/src/main/java/com/catforest/app/LocalLifeRules.kt"
            if local_rules.is_file():
                command.append(str(local_rules))
            built = subprocess.run(command, capture_output=True, text=True, timeout=90)
            self.assertEqual(built.returncode, 0, built.stdout + built.stderr)
            run = subprocess.run([java, "-cp", os.pathsep.join([str(classes), cp]), "ProbeKt", str(folder / "save")],
                                 capture_output=True, text=True, timeout=20, check=True)
            observed = json.loads(run.stdout.strip())
            print("SILENT_FINISH_OBSERVATION", json.dumps(observed, sort_keys=True), flush=True)
            self.assertEqual(observed["restartedRevision"], observed["beforeRevision"])
            self.assertNotEqual(observed["ack"], "applied", "An ACK must not remove a badge event whose app save never committed")
            self.assertEqual(observed["memoryRevision"], observed["beforeRevision"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
