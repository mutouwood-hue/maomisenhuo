package com.catforest.app

import android.content.Context
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.UUID
import kotlin.math.roundToInt

/** Native state authority for the first Android slice. Prototype source remains read-only. */
class PetStore(context: Context) {
    class StorageFailure(message: String, cause: Throwable? = null) : IllegalStateException(message, cause)
    private val file = AtomicFile(File(context.filesDir, "pet-state.json"))
    private val recoveryDir = File(context.filesDir, "recovery")
    private val lastVerified = File(recoveryDir, "last-verified-save.json")
    private var data: JSONObject
    private var hasVerifiedMemory = false
    var warning: String? = null
        private set
    var blocked = false
        private set

    init {
        data = if (!file.baseFile.exists() && !File(file.baseFile.path + ".bak").exists()) {
            newPet().also { persist(it); hasVerifiedMemory = true }
        } else try {
            val bytes = file.openRead().use { it.readBytes() }
            decode(bytes.toString(Charsets.UTF_8)).also {
                hasVerifiedMemory = true
                try { preserveLastVerified(bytes) } catch (e: Exception) {
                    blocked = true
                    warning = "本机存档已载入，但有效备份尚未确认。请检查空间后点击「重新检查本机存档」。"
                }
            }
        } catch (e: Exception) {
            // Never silently replace a damaged save with a new pet.
            recoveryDir.mkdirs()
            val stamp = System.currentTimeMillis()
            listOf(file.baseFile, File(file.baseFile.path + ".bak")).forEach {
                if (it.exists()) runCatching { it.copyTo(File(recoveryDir, "${stamp}-${it.name}")) }
            }
            blocked = true
            warning = "存档未能读取，原文件已保留。请从备份恢复；当前照料已暂停。"
            newPet()
        }
    }

    @Synchronized fun state(): JSONObject = JSONObject(data.toString())
    @Synchronized fun snapshot(): JSONObject = snapshotOf(data)
    @Synchronized fun hasLocalRecovery(): Boolean = lastVerified.isFile

    /** Recheck actual disk first; never overwrite an uncertain commit from the old RAM state. */
    @Synchronized fun retryRead(): String {
        return try {
            val bytes = file.openRead().use { it.readBytes() }
            val loaded = decode(bytes.toString(Charsets.UTF_8))
            preserveLastVerified(bytes)
            data = loaded
            hasVerifiedMemory = true
            blocked = false
            warning = null
            "本机存档已重新校验并载入，请重新连接吧唧。"
        } catch (e: Exception) {
            blocked = true
            warning = "本机存档仍未能读取。请恢复本机上一份有效存档，或选择你导出的备份。"
            throw StorageFailure(warning!!, e)
        }
    }

    /** Invoked only after explicit user confirmation in the recovery dialog. */
    @Synchronized fun restoreLocalRecovery(): String {
        require(lastVerified.isFile) { "本机还没有可恢复的上一份有效存档，请选择导出的备份。" }
        val text = lastVerified.readText(Charsets.UTF_8)
        decode(text) // reject a damaged recovery file before touching the primary
        recoveryDir.mkdirs()
        if (file.baseFile.exists()) file.baseFile.copyTo(File(recoveryDir, "before-local-recovery-${System.currentTimeMillis()}.json"))
        return restore(text)
    }
    @Synchronized fun export(): String {
        check(!blocked) { "当前存档无法读取，请先恢复备份。" }
        return envelope(data).toString(2)
    }

    @Synchronized fun restore(text: String): String {
        val incoming = decode(text)
        if (hasVerifiedMemory && incoming.getString("petId") == data.getString("petId")) {
            incoming.put("revision", Math.addExact(maxOf(incoming.getLong("revision"), data.getLong("revision")), 1L))
            val merged = linkedMapOf<String, JSONObject>()
            listOf(data.getJSONArray("processedEvents"), incoming.getJSONArray("processedEvents")).forEach { events ->
                for (i in 0 until events.length()) { val row = events.getJSONObject(i); merged[row.getString("key")] = row }
            }
            require(merged.size <= 20000) { "互动去重记录已满，恢复未执行，请保留两份备份。" }
            incoming.put("processedEvents", JSONArray(merged.values.toList()))
        } else {
            incoming.put("revision", Math.addExact(incoming.getLong("revision"), 1L))
        }
        incoming.put("updatedAtMs", System.currentTimeMillis())
        require(incoming.getLong("revision") <= 9_007_199_254_740_990L) { "进度版本已超过安全范围。" }
        // Keep a separate pre-import copy before a user-confirmed replacement.
        recoveryDir.mkdirs()
        if (!blocked) File(recoveryDir, "before-import-${System.currentTimeMillis()}.json").writeText(envelope(data).toString())
        persist(incoming)
        data = incoming
        hasVerifiedMemory = true
        blocked = false
        warning = null
        return "存档已恢复。请重新连接吧唧并同步。"
    }

    @Synchronized fun rename(name: String): String = transaction { next ->
        requireIdleLife(next)
        val n = name.trim()
        require(n.codePointCount(0, n.length) in 2..12 && n.none { it.isISOControl() || it in '\u202a'..'\u202e' || it in '\u2066'..'\u2069' }) {
            "名字需要 2～12 个字符，不能包含控制字符。"
        }
        next.put("name", n)
        addJournal(next, "以后就叫${n}啦。")
        "以后就叫${n}啦。"
    }

    @Synchronized fun care(action: String, score: Int? = null): String = transaction { next ->
        applyCare(next, action, score)
    }

    @Synchronized fun canChooseBreed(id: String): Boolean {
        val breed = AppearanceCatalog.breeds.firstOrNull { it.id == id } ?: return false
        return !breed.rare || data.getString("breed") == id || data.optJSONObject("lineage")?.optString("rare") == id
    }

    @Synchronized fun chooseBreed(id: String): String {
        if (blocked) throw StorageFailure(warning ?: "存档不可用。")
        requireIdleLife(data)
        val breed = AppearanceCatalog.breeds.firstOrNull { it.id == id } ?: error("请选择已有的小猫品种。")
        require(canChooseBreed(id)) { "${breed.name}是联机生蛋的稀有后代，不能直接换上。" }
        if (data.getString("breed") == id) return "${data.getString("name")}已经是${breed.name}啦。"
        return transaction { next ->
            next.put("breed", id)
            addJournal(next, "${next.getString("name")}换上了${breed.name}的毛色。")
            "${next.getString("name")}现在是${breed.name}啦，陪伴和成长都保留。"
        }
    }

    @Synchronized fun buyOutfit(id: String): String = transaction { next -> buyInto(next, id) }

    @Synchronized fun equipOutfit(id: String): String = transaction { next -> equipInto(next, id) }

    /** The original outfit-list click buys an unowned piece then equips it. Commit both atomically. */
    @Synchronized fun buyAndEquipOutfit(id: String): String = transaction { next ->
        if (!arrayContains(next.getJSONArray("wardrobe"), id)) buyInto(next, id)
        equipInto(next, id)
    }

    private fun buyInto(next: JSONObject, id: String): String {
        requireIdleLife(next)
        val outfit = AppearanceCatalog.outfits.firstOrNull { it.id == id } ?: error("没有找到这件服装。")
        val owned = arrayContains(next.getJSONArray("wardrobe"), id)
        require(!outfit.gift || owned) { "${outfit.name}是馈赠限定，商店买不到，只在 Fate 缘分擦肩的大礼物里出现。" }
        require(!owned) { "衣柜里已经有这件服装，不用重复购买。" }
        require(next.getInt("coins") >= outfit.price) { "这件${outfit.name}需要 ${outfit.price} 枚喵币，去户外找些收获吧。" }
        next.put("coins", next.getInt("coins") - outfit.price)
        next.getJSONArray("wardrobe").put(id)
        addJournal(next, "买到了${outfit.name}，可以在衣柜里给猫咪穿上。")
        return "${outfit.name}已经放进衣柜啦！"
    }

    private fun equipInto(next: JSONObject, id: String): String {
        requireIdleLife(next)
        val outfit = AppearanceCatalog.outfits.firstOrNull { it.id == id }
        require(id == "none" || outfit != null) { "没有找到这件服装。" }
        require(arrayContains(next.getJSONArray("wardrobe"), id)) { "先在小商店买下这件服装吧。" }
        next.put("outfit", id)
        return if (id == "none") "换回自然蓬松的毛毛啦。" else "穿上${outfit!!.name}啦！"
    }

    /** Validate a care start without mutating or committing a reward. */
    @Synchronized fun checkCare(action: String) {
        if (blocked) throw StorageFailure(warning ?: "存档不可用。")
        applyCare(JSONObject(data.toString()), action, null)
    }
    @Synchronized fun checkPlay() {
        if (blocked) throw StorageFailure(warning ?: "存档不可用。")
        applyCare(JSONObject(data.toString()), "play", 0)
    }

    /** Returns an ACK only after the state and durable idempotency record are committed. */
    @Synchronized fun badgeEvent(event: JSONObject): JSONObject {
        if (blocked) throw StorageFailure(warning ?: "存档不可用，请先恢复备份。")
        val id = event.optString("eventId")
        fun ack(status: String, reason: String? = null) = JSONObject().put("protocolVersion", 1)
            .put("kind", "ack").put("eventId", id).put("status", status)
            .put("revision", data.getLong("revision")).apply { if (reason != null) put("reason", reason) }
        return try {
            require(!blocked) { "storage_unavailable" }
            require(integer(event, "protocolVersion", 1, 1) == 1L && event.get("kind") == "event") { "invalid_event" }
            require(event.get("eventId") is String && id.codePointCount(0, id.length) in 1..128) { "invalid_event_id" }
            val device = event.getString("deviceId")
            require(event.get("deviceId") is String && device.codePointCount(0, device.length) in 1..64) { "invalid_device_id" }
            require(event.get("petId") is String && event.getString("petId") == data.getString("petId")) { "pet_mismatch" }
            require(event.get("type") == "pet") { "unsupported_event" }
            integer(event, "timestampMs", 0, 9_007_199_254_740_990L)
            val key = JSONArray().put(device).put(id).toString()
            val applied = data.getJSONArray("processedEvents")
            if ((0 until applied.length()).any { applied.getJSONObject(it).getString("key") == key }) return ack("duplicate")
            if (applied.length() >= 20000) throw StorageFailure("互动去重记录已满，请先备份并联系维护者；吧唧事件未确认。")
            transaction { next ->
                val message = applyCare(next, "pet", null, enforceCooldown = false, allowAtCap = true)
                next.getJSONArray("processedEvents").put(JSONObject().put("key", key)
                    .put("deviceTimestampMs", event.getLong("timestampMs")).put("receivedAtMs", System.currentTimeMillis()))
                message
            }
            ack("applied")
        } catch (e: Exception) {
            if (e is StorageFailure) throw e // retain the device's unacknowledged event for retry
            ack("rejected", e.message?.take(160) ?: "invalid_event")
        }
    }

    /** Same-pet stale recovery is a durable revision transaction, never a device reset. */
    @Synchronized fun advancePast(devicePetId: String, deviceRevision: Long) {
        require(devicePetId == data.getString("petId")) { "pet_mismatch" }
        require(deviceRevision in 0..9_007_199_254_740_988L) { "invalid_revision" }
        transaction { next -> next.put("revision", maxOf(data.getLong("revision"), deviceRevision)); "" }
    }

    /** Original prototype foreground decay rates, seconds capped at 30 per call. */
    @Synchronized fun tick(seconds: Double) {
        if (blocked || !seconds.isFinite() || seconds <= 0) return
        val delta = seconds.coerceAtMost(30.0)
        transaction { next ->
            val stats = next.getJSONObject("stats")
            mapOf("food" to .006, "mood" to .004, "clean" to .003, "energy" to .004).forEach { (key, rate) ->
                stats.put(key, (stats.getDouble(key) - rate * delta).coerceIn(0.0, 100.0))
            }
            ""
        }
    }

    @Synchronized fun goals(): List<Goal> = goalDefs.map { goal ->
        goal.copy(progress = when (goal.id) {
            "first_meal" -> data.getJSONObject("counts").optInt("feed")
            "sparkle" -> data.getJSONObject("counts").optInt("bath")
            "explorer" -> data.getJSONObject("counts").optInt("climb")
            "playmate" -> (if (data.getJSONObject("counts").optInt("tease") > 0) 1 else 0) + (if (data.getJSONObject("counts").optInt("play") > 0) 1 else 0)
            else -> data.getInt("xp")
        }, claimed = arrayContains(data.getJSONArray("claimedGoals"), goal.id))
    }

    @Synchronized fun claim(id: String): String = transaction { next ->
        requireIdleLife(next)
        val goal = goals().firstOrNull { it.id == id } ?: error("没有找到这个愿望。")
        require(!goal.claimed) { "这个愿望的印章已经收好啦。" }
        require(goal.progress >= goal.target) { "这个愿望还没有完成。" }
        next.getJSONArray("claimedGoals").put(id)
        next.put("coins", (next.getInt("coins") + goal.coins).coerceAtMost(1_000_000))
        "收集到「${goal.title}」印章，获得 ${goal.coins} 枚喵币。".also { addJournal(next, it) }
    }

    private fun applyCare(next: JSONObject, action: String, score: Int?, enforceCooldown: Boolean = true, allowAtCap: Boolean = false): String {
        if (enforceCooldown) requireIdleLife(next)
        val stats = next.getJSONObject("stats")
        val now = System.currentTimeMillis()
        val last = next.getJSONObject("lastActions").optLong(action)
        val cooldown = if (action == "pet") 2000 else 4000
        require(!enforceCooldown || now < last || now - last >= cooldown) { "让小猫缓一缓，稍等一下再来吧。" }
        var xp = 0; var cost = 0; var reward = 0; var health = 0
        val changes: Map<String, Int>
        val message: String
        when (action) {
            "feed" -> { require(stats.getDouble("food") < 95) { "小猫已经吃饱啦，等肚子饿一点再喂。" }; changes = mapOf("food" to 25, "mood" to 3, "clean" to -2); xp = 8; cost = 3; message = "咔嚓咔嚓，小猫吃掉了小鱼干！" }
            "bath" -> { require(stats.getDouble("clean") < 95) { "小猫已经很干净啦，暂时不用洗澡。" }; changes = mapOf("clean" to 35, "mood" to 4, "energy" to -3); xp = 8; cost = 2; health = 1; message = "泡泡洗香香，变成一只蓬松的小猫啦。" }
            "pet" -> { require(allowAtCap || stats.getDouble("mood") < 98) { "小猫现在心情超好，可以陪它做点别的。" }; changes = mapOf("mood" to 9); xp = 3; message = "呼噜呼噜，小猫蹭了蹭你的手。" }
            "sleep" -> { require(stats.getDouble("energy") < 95) { "小猫精神满满，暂时还不困。" }; changes = mapOf("energy" to 35, "food" to -4); xp = 6; health = 2; message = "小猫打了个盹，醒来又有精神了。" }
            "drink" -> { changes = mapOf("mood" to 3, "energy" to 6); xp = 4; message = "舔一舔清水，小猫喝好了，又有精神啦。" }
            "climb", "tease" -> { require(stats.getDouble("energy") >= 10) { "小猫有点累了，先让它睡个小觉吧。" }; require(next.isNull("healthIssue")) { "小猫有点不舒服，先去诊所检查，再陪它剧烈运动吧。" }; changes = mapOf("energy" to if (action == "climb") -6 else -5, "food" to -3, "mood" to 12); xp = if (action == "climb") 10 else 8; message = if (action == "climb") "登顶成功！小猫在猫爬架上开心地摇了摇尾巴。" else "扑到羽毛啦！小猫还想再陪你玩一会儿。" }
            "play" -> { require(score != null && score in 0..15) { "这局的分数无效，请重新开始。" }; require(stats.getDouble("energy") >= 10) { "小猫有点累了，先让它睡个小觉吧。" }; val ratio = score!! / 15.0; changes = mapOf("mood" to 12 + (ratio * 13).roundToInt(), "energy" to -8, "food" to -5); xp = 10 + (ratio * 10).roundToInt(); reward = 3 + (ratio * 9).roundToInt(); message = "接住了 $score 条小鱼，小猫玩得很开心！" }
            else -> error("小猫还不会这个互动。")
        }
        require(next.getInt("coins") >= cost) { "喵币不够啦，可以陪小猫接鱼或完成愿望。" }
        changes.forEach { (key, change) -> stats.put(key, (stats.getDouble(key) + change).coerceIn(0.0, 100.0)) }
        stats.put("health", (stats.getDouble("health") + health).coerceAtMost(100.0))
        next.put("xp", (next.getInt("xp") + xp).coerceAtMost(10_000_000))
        next.put("coins", (next.getInt("coins") - cost + reward).coerceIn(0, 1_000_000))
        next.getJSONObject("counts").put(action, (next.getJSONObject("counts").optInt(action) + 1).coerceAtMost(1_000_000))
        next.getJSONObject("lastActions").put(action, now)
        if (action == "bath") next.put("wet", false)
        addJournal(next, message)
        return message
    }

    @Synchronized fun hasPendingLife(): Boolean = !data.isNull("pendingOutdoor") || !data.isNull("pendingClinic")
    @Synchronized fun sellInventory(id: String, quantity: Int): JSONObject = lifeAction(true) { LocalLifeRules.sell(it, id, quantity) }
    @Synchronized fun beginOutdoor(mode: String, location: String, token: String, atMs: Long): JSONObject = lifeAction { LocalLifeRules.beginOutdoor(it, mode, location, token, atMs) }
    @Synchronized fun collectOutdoor(token: String, nodeId: String): JSONObject = lifeAction { LocalLifeRules.collectOutdoor(it, token, nodeId) }
    @Synchronized fun observeOutdoorEvent(token: String, event: String): JSONObject = lifeAction(skipIfUnchanged = true) { LocalLifeRules.observeOutdoorEvent(it, token, event) }
    @Synchronized fun chooseOutdoor(token: String, event: String, choice: String): JSONObject = lifeAction { LocalLifeRules.chooseOutdoor(it, token, event, choice) }
    @Synchronized fun settleOutdoor(token: String, elapsedMs: Long): JSONObject = lifeAction(true) { LocalLifeRules.settleOutdoor(it, token, elapsedMs) }
    @Synchronized fun cancelOutdoor(token: String): JSONObject = lifeAction { LocalLifeRules.cancelOutdoor(it, token) }
    @Synchronized fun beginClinic(token: String, atMs: Long): JSONObject = lifeAction { LocalLifeRules.beginClinic(it, token, atMs) }
    @Synchronized fun finishClinic(token: String, steps: Int, elapsedMs: Long): JSONObject = lifeAction(true) { LocalLifeRules.finishClinic(it, token, steps, elapsedMs) }
    @Synchronized fun cancelClinic(token: String): JSONObject = lifeAction { LocalLifeRules.cancelClinic(it, token) }

    private class RuleFailure(message: String) : IllegalArgumentException(message)
    private class UnchangedLife(val response: JSONObject) : RuntimeException()
    private fun lifeAction(record: Boolean = false, skipIfUnchanged: Boolean = false, operation: (JSONObject) -> LocalLifeRules.Result): JSONObject {
        var response = JSONObject()
        return try {
            transaction { next ->
                val result = operation(next)
                if (!result.ok) throw RuleFailure(result.message)
                response = JSONObject(result.payload.toString()).put("ok", true).put("message", result.message)
                if (skipIfUnchanged && next.toString() == data.toString()) throw UnchangedLife(response)
                if (record) {
                    result.payload.optString("storyMessage").takeIf { it.isNotBlank() }?.let { addJournal(next, it) }
                    addJournal(next, result.message)
                }
                result.message
            }
            response
        } catch (e: UnchangedLife) { e.response }
        catch (e: RuleFailure) { JSONObject().put("ok", false).put("message", e.message) }
    }

    private fun requireIdleLife(state: JSONObject) {
        require(state.isNull("pendingOutdoor")) { "小猫正在户外，先完成活动或一起回家吧。" }
        require(state.isNull("pendingClinic")) { "小猫正在看医生，先完成检查或离开诊所吧。" }
    }

    private fun transaction(block: (JSONObject) -> String): String {
        if (blocked) throw StorageFailure(warning ?: "存档不可用。")
        val next = JSONObject(data.toString())
        val message = block(next)
        next.put("revision", Math.addExact(next.getLong("revision"), 1L))
        require(next.getLong("revision") <= 9_007_199_254_740_990L) { "进度版本已超过安全范围。" }
        next.put("updatedAtMs", System.currentTimeMillis())
        persist(next) // failure leaves in-memory state unchanged
        data = next
        hasVerifiedMemory = true
        return message
    }

    private fun persist(next: JSONObject) {
        val encoded = envelope(next).toString().toByteArray(Charsets.UTF_8)
        if (encoded.size > 7 * 1024 * 1024) throw StorageFailure("存档已达到安全容量，当前操作未结算。请先导出备份并联系维护者。")
        var output: FileOutputStream? = null
        var finishStarted = false
        try {
            if (file.baseFile.exists() || File(file.baseFile.path + ".bak").exists()) {
                val prior = file.openRead().use { it.readBytes() }
                try {
                    decode(prior.toString(Charsets.UTF_8))
                    preserveLastVerified(prior)
                } catch (e: Exception) {
                    // A user-confirmed restore may replace damaged primary data; ordinary writes may not.
                    if (!blocked) throw e
                }
            }
            output = file.startWrite()
            output.write(encoded)
            output.flush()
            output.fd.sync() // AtomicFile.finishWrite may log sync errors instead of throwing them.
            finishStarted = true
            file.finishWrite(output)
            output = null
            val committed = file.openRead().use { it.readBytes() }
            check(committed.contentEquals(encoded)) { "存档提交后的读回内容不一致。" }
            decode(committed.toString(Charsets.UTF_8))
            // Last-good includes every state/event we will acknowledge, even after a later primary corruption.
            preserveLastVerified(committed)
        } catch (e: Exception) {
            if (!finishStarted && output != null) runCatching { file.failWrite(output) }
            if (finishStarted) {
                // finish may already have renamed the file. Do not failWrite a closed/committed stream.
                blocked = true
                warning = "存档提交尚未确认，照料已暂停。请点击「重新检查本机存档」；吧唧互动未确认结算。"
                throw StorageFailure(warning!!, e)
            }
            throw StorageFailure("存档写入失败，进度未改变。请检查可用空间后重试。", e)
        }
    }

    private fun preserveLastVerified(bytes: ByteArray) {
        check(recoveryDir.isDirectory || recoveryDir.mkdirs()) { "无法准备本机恢复目录。" }
        val temporary = File(recoveryDir, "last-verified-save.tmp")
        FileOutputStream(temporary).use { stream -> stream.write(bytes); stream.flush(); stream.fd.sync() }
        check(temporary.readBytes().contentEquals(bytes)) { "上一份有效存档备份校验失败。" }
        check(temporary.renameTo(lastVerified)) { "无法保留上一份有效存档。" }
        check(lastVerified.readBytes().contentEquals(bytes)) { "上一份有效存档读回校验失败。" }
    }

    private fun envelope(state: JSONObject): JSONObject {
        val payload = state.toString()
        return JSONObject().put("format", "catforest-save").put("schemaVersion", 1)
            .put("sha256", hash(payload)).put("payload", payload)
    }

    private fun decode(text: String): JSONObject {
        require(text.toByteArray().size <= 8 * 1024 * 1024) { "备份文件过大。" }
        val root = JSONObject(text)
        require(root.getString("format") == "catforest-save" && root.getInt("schemaVersion") == 1) { "不支持的存档格式。" }
        val payload = root.getString("payload")
        require(MessageDigest.isEqual(root.getString("sha256").toByteArray(), hash(payload).toByteArray())) { "存档校验失败。" }
        val state = JSONObject(payload)
        UUID.fromString(state.getString("petId"))
        integer(state, "revision", 0, 9_007_199_254_740_990L)
        integer(state, "updatedAtMs", 0, 9_007_199_254_740_990L)
        integer(state, "createdAtMs", 0, 9_007_199_254_740_990L)
        val name = state.getString("name")
        require(state.get("name") is String && name.codePointCount(0, name.length) in 2..12 && name.none { it.isISOControl() || it in '\u202a'..'\u202e' || it in '\u2066'..'\u2069' })
        val stats = state.getJSONObject("stats")
        listOf("food", "mood", "clean", "energy", "health").forEach { require(stats.get(it) is Number && stats.getDouble(it).isFinite() && stats.getDouble(it) in 0.0..100.0) }
        integer(state, "coins", 0, 1_000_000)
        integer(state, "xp", 0, 10_000_000)
        listOf("feed", "bath", "pet", "play", "sleep", "drink", "climb", "tease").forEach { integer(state.getJSONObject("counts"), it, 0, 1_000_000) }
        val journal = state.getJSONArray("journal")
        require(journal.length() <= 100)
        for (i in 0 until journal.length()) {
            val row = journal.getJSONObject(i)
            integer(row, "at", 0, 9_007_199_254_740_990L)
            require(row.get("message") is String && row.getString("message").length in 1..1000)
        }
        require(state.getJSONArray("processedEvents").length() <= 20000)
        val ids = mutableSetOf<String>()
        val events = state.getJSONArray("processedEvents")
        for (i in 0 until events.length()) {
            val row = events.getJSONObject(i)
            require(row.get("key") is String && row.getString("key").length in 1..1000 && ids.add(row.getString("key")))
            integer(row, "receivedAtMs", 0, 9_007_199_254_740_990L)
            integer(row, "deviceTimestampMs", 0, 9_007_199_254_740_990L)
        }
        val claimed = state.getJSONArray("claimedGoals")
        require(claimed.length() <= goalDefs.size)
        val seenGoals = mutableSetOf<String>()
        for (i in 0 until claimed.length()) require(claimed.get(i) is String && seenGoals.add(claimed.getString(i)) && goalDefs.any { it.id == claimed.getString(i) })
        val lastActions = state.getJSONObject("lastActions")
        lastActions.keys().forEach { integer(lastActions, it, 0, 9_007_199_254_740_990L) }
        validateAppearance(state)
        LocalLifeRules.initialize(state)
        LocalLifeRules.validate(state)
        return state
    }

    private fun validateAppearance(state: JSONObject) {
        val appearanceKeys = listOf("breed", "outfit", "wardrobe")
        if (appearanceKeys.none(state::has)) {
            // Native schema1 backups made before the wardrobe migration represent orange/none.
            state.put("breed", "orange").put("outfit", "none").put("wardrobe", JSONArray().put("none"))
        } else require(appearanceKeys.all(state::has)) { "存档中的外观字段不完整。" }
        require(state.get("breed") is String && AppearanceCatalog.breeds.any { it.id == state.getString("breed") }) { "存档中的小猫品种无效。" }
        require(state.get("outfit") is String) { "存档中的装扮无效。" }
        val owned = state.getJSONArray("wardrobe")
        require(owned.length() in 1..AppearanceCatalog.outfits.size + 1) { "存档中的衣柜无效。" }
        val ids = mutableSetOf<String>()
        for (i in 0 until owned.length()) {
            require(owned.get(i) is String) { "存档中的衣柜无效。" }
            val id = owned.getString(i)
            require(ids.add(id) && (id == "none" || AppearanceCatalog.outfits.any { it.id == id })) { "存档中的衣柜无效。" }
        }
        require("none" in ids && state.getString("outfit") in ids) { "存档中的衣柜或已装备服装无效。" }
    }

    private fun addJournal(state: JSONObject, message: String) {
        val rows = state.getJSONArray("journal")
        rows.put(JSONObject().put("at", System.currentTimeMillis()).put("message", message))
        while (rows.length() > 100) rows.remove(0)
    }

    companion object {
        data class Goal(val id: String, val title: String, val target: Int, val coins: Int, val progress: Int = 0, val claimed: Boolean = false)
        val goalDefs = listOf(Goal("first_meal", "第一顿小鱼干", 1, 5), Goal("sparkle", "香香小猫", 1, 5), Goal("explorer", "高处探险家", 1, 6), Goal("playmate", "最佳玩伴", 2, 8), Goal("grown_up", "陪你长大", 160, 10))
        private fun arrayContains(array: JSONArray, value: String) = (0 until array.length()).any { array.getString(it) == value }
        private fun hash(s: String) = MessageDigest.getInstance("SHA-256").digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
        private fun integer(obj: JSONObject, key: String, min: Long, max: Long): Long {
            val value = obj.get(key)
            require(value is Number && value.toDouble().isFinite() && value.toDouble() % 1.0 == 0.0 && value.toDouble() >= min.toDouble() && value.toDouble() <= max.toDouble()) { "invalid_$key" }
            return value.toLong()
        }
        private fun newPet(): JSONObject {
            val now = System.currentTimeMillis()
            return JSONObject().put("petId", UUID.randomUUID().toString()).put("name", "小橘").put("revision", 0L).put("createdAtMs", now).put("updatedAtMs", now)
                .put("breed", "orange").put("outfit", "none").put("wardrobe", JSONArray().put("none"))
                .put("stats", JSONObject().put("food", 65).put("mood", 72).put("clean", 68).put("energy", 75).put("health", 100))
                .put("coins", 30).put("xp", 0).put("counts", JSONObject().apply { listOf("feed", "bath", "pet", "play", "sleep", "drink", "climb", "tease").forEach { put(it, 0) } })
                .put("lastActions", JSONObject()).put("processedEvents", JSONArray()).put("claimedGoals", JSONArray()).put("journal", JSONArray())
                .also { LocalLifeRules.initialize(it) }
        }
        fun snapshotOf(state: JSONObject): JSONObject = JSONObject().put("kind", "snapshot").put("protocolVersion", 1)
            .put("petId", state.getString("petId")).put("revision", state.getLong("revision"))
            .put("food", state.getJSONObject("stats").getDouble("food").roundToInt()).put("mood", state.getJSONObject("stats").getDouble("mood").roundToInt())
            .put("clean", state.getJSONObject("stats").getDouble("clean").roundToInt()).put("energy", state.getJSONObject("stats").getDouble("energy").roundToInt())
            .put("health", state.getJSONObject("stats").getDouble("health").roundToInt()).put("coins", state.getInt("coins")).put("updatedAtMs", state.getLong("updatedAtMs"))
    }
}
