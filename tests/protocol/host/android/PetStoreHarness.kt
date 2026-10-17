import android.content.Context
import android.util.AtomicFile
import com.catforest.app.PetStore
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/** Calls public methods on the actual production PetStore. */
fun main(args: Array<String>) {
    val directory = File(args.single()).also { it.mkdirs() }
    val context = Context(directory)
    var store = PetStore(context)
    generateSequence(::readLine).forEach { line ->
        val result = JSONObject()
        try {
            val command = JSONObject(line)
            when (command.getString("op")) {
                "state" -> result.put("state", store.state()).put("blocked", store.blocked)
                "snapshot" -> result.put("snapshot", store.snapshot())
                "event" -> result.put("ack", store.badgeEvent(command.getJSONObject("event")))
                "care" -> result.put("message", store.care(command.getString("action")))
                "tick" -> store.tick(command.getDouble("seconds"))
                "export" -> result.put("backup", store.export())
                "restore" -> result.put("message", store.restore(command.getString("backup")))
                "restart" -> { store = PetStore(context); result.put("blocked", store.blocked) }
                "fail_next_write" -> AtomicFile.failNextWrite = true
                "silent_finish_failure" -> AtomicFile.silentFinishFailure = true
                "fail_read_after_finish" -> AtomicFile.failReadAfterFinish = true
                "retry_read" -> store.retryRead()
                "corrupt" -> File(directory, "pet-state.json").writeText("corrupted test fixture")
                "prepare_mood" -> {
                    val envelope = JSONObject(store.export())
                    val data = JSONObject(envelope.getString("payload"))
                    data.getJSONObject("stats").put("mood", command.getInt("mood"))
                    val payload = data.toString()
                    val hash = MessageDigest.getInstance("SHA-256").digest(payload.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
                    envelope.put("payload", payload).put("sha256", hash)
                    store.restore(envelope.toString())
                }
                else -> error("unknown test operation")
            }
            result.put("ok", true)
        } catch (error: Exception) {
            result.put("ok", false).put("error", error.message ?: error.javaClass.name).put("errorType", error.javaClass.simpleName)
        }
        println(result.toString())
    }
}
