package android.util

import java.io.File
import java.io.FileOutputStream
import java.io.FileInputStream
import java.io.IOException

/** Fault-controllable host atomic storage adapter. Android AtomicFile still needs
 * platform verification. It preserves the pre-transaction file on write failure. */
class AtomicFile(val baseFile: File) {
    private val staging get() = File(baseFile.path + ".new")
    fun openRead(): FileInputStream {
        if (failNextRead) { failNextRead = false; throw IOException("injected post-finish read error") }
        if (staging.exists() && baseFile.exists()) staging.delete()
        return FileInputStream(baseFile)
    }
    fun readFully(): ByteArray = openRead().use { it.readBytes() }
    fun startWrite(): FileOutputStream {
        if (failNextWrite) { failNextWrite = false; throw IOException("injected host storage error") }
        baseFile.parentFile?.mkdirs()
        return FileOutputStream(staging)
    }
    fun finishWrite(output: FileOutputStream?) {
        // Android's platform AtomicFile can log a failed rename and return normally.
        // Reproduce that API behavior without falsely throwing an IOException.
        if (silentFinishFailure) { silentFinishFailure = false; output?.close(); return }
        output?.fd?.sync()
        output?.close()
        if (!staging.renameTo(baseFile)) throw IOException("host atomic rename failed")
        if (failReadAfterFinish) { failReadAfterFinish = false; failNextRead = true }
    }
    fun failWrite(output: FileOutputStream?) {
        runCatching { output?.close() }
        staging.delete()
    }
    companion object {
        var failNextWrite = false
        var silentFinishFailure = false
        var failReadAfterFinish = false
        private var failNextRead = false
    }
}
