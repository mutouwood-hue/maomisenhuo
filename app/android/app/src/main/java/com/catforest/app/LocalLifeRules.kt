package com.catforest.app

import org.json.JSONArray
import org.json.JSONObject

/** Original 小橘电子宠物.html rules; caller owns transaction, clock, revision and journal. */
object LocalLifeRules {
    data class Item(val id: String, val name: String, val description: String, val sellPrice: Int)
    data class Activity(val id: String, val name: String, val target: Int, val minSeconds: Int, val xp: Int, val coins: Int, val description: String)
    data class Result(val ok: Boolean, val message: String, val payload: JSONObject = JSONObject())
    val items = listOf(
        Item("fish", "小鱼", "从河岸带回的小收获。", 3),
        Item("flower", "野花", "庭院小路旁的彩色花朵。", 2),
        Item("shell", "贝壳", "河岸砂石里亮闪闪的贝壳。", 4),
        Item("star", "星星石", "藏在草地里的珍贵小石头。", 7)
    )
    val activities = listOf(
        Activity("walk", "牵绳散步", 3, 12, 6, 4, "陪小猫依次走到三个路标。"),
        Activity("explore", "自由探险", 5, 15, 8, 5, "让小猫闻花、找贝壳，收集五件小礼物。"),
        Activity("fish", "河岸钓鱼", 4, 15, 8, 4, "看准时机，带回四条小鱼。")
    )
    private val orderIds = listOf("first_walk", "flower_bundle", "river_fisher")
    private val locations = setOf("garden", "park", "river")
    private val events = setOf("rain", "butterfly", "lost-pouch")
    private val choices = setOf("safe", "care", "coins")
    private val careOrder = listOf("feed", "bath", "pet", "play", "sleep", "climb", "tease", "drink")
    private val traits = listOf("小吃货", "爱干净", "黏人精", "接鱼高手", "爱睡懒觉", "爱爬高", "好奇宝宝", "爱喝水")

    private fun emptyInventory() = JSONObject().apply { items.forEach { put(it.id, 0) } }
    private fun emptyWorld() = JSONObject().put("completed", JSONObject().apply { activities.forEach { put(it.id, 0) } })
        .put("collected", emptyInventory()).put("claimedOrders", JSONArray()).put("choices", 0)
        .put("lastLocation", "garden").put("nextSession", 1)

    /** Only whole fields absent from old saves are migrated; damaged partial objects remain errors. */
    fun initialize(candidate: JSONObject) {
        if (!candidate.has("inventory")) candidate.put("inventory", emptyInventory())
        if (!candidate.has("world")) candidate.put("world", emptyWorld())
        if (!candidate.has("pendingOutdoor")) candidate.put("pendingOutdoor", JSONObject.NULL)
        if (!candidate.has("pendingClinic")) candidate.put("pendingClinic", JSONObject.NULL)
        if (!candidate.has("healthIssue")) candidate.put("healthIssue", JSONObject.NULL)
        // Presentation facts survive cancelling rewards or restarting a transient outdoor view.
        if (!candidate.has("wet")) candidate.put("wet", false)
        if (!candidate.has("observedOutdoorEvents")) candidate.put("observedOutdoorEvents", JSONArray())
    }

    private fun integer(o: JSONObject, key: String, max: Long): Long {
        val v = o.get(key)
        require(v is Number && v.toDouble().isFinite() && v.toDouble() % 1.0 == 0.0) { "${key}需要是整数。" }
        require(v.toDouble() in 0.0..max.toDouble()) { "${key}超出范围。" }
        return v.toLong()
    }
    private fun strings(a: JSONArray): List<String> = (0 until a.length()).map {
        require(a.get(it) is String) { "列表内容无效。" }; a.getString(it)
    }
    private fun finiteStat(stats: JSONObject, id: String): Double {
        val v = stats.get(id)
        require(v is Number && v.toDouble().isFinite() && v.toDouble() in 0.0..100.0) { "小猫状态无效。" }
        return v.toDouble()
    }
    fun validate(candidate: JSONObject) {
        require(listOf("inventory", "world", "pendingOutdoor", "pendingClinic", "healthIssue", "wet", "observedOutdoorEvents").all { candidate.has(it) }) { "本地生活字段缺失。" }
        require(candidate.get("wet") is Boolean) { "湿身状态无效。" }
        val observed = strings(candidate.getJSONArray("observedOutdoorEvents"))
        require(observed.size <= 128 && observed.size == observed.toSet().size && observed.all { it.length in 1..512 && it.none { ch -> ch.isISOControl() } }) { "户外事件记录无效。" }
        items.forEach { integer(candidate.getJSONObject("inventory"), it.id, 100_000) }
        val w = candidate.getJSONObject("world")
        activities.forEach { integer(w.getJSONObject("completed"), it.id, 1_000_000) }
        items.forEach { integer(w.getJSONObject("collected"), it.id, 1_000_000) }
        integer(w, "choices", 1_000_000)
        require(integer(w, "nextSession", 9_007_199_254_740_991L) >= 1) { "户外编号无效。" }
        require(w.get("lastLocation") is String && w.getString("lastLocation") in locations) { "户外地点无效。" }
        val claimed = strings(w.getJSONArray("claimedOrders"))
        require(claimed.size == claimed.toSet().size && claimed.all { it in orderIds }) { "委托记录无效。" }
        require(candidate.isNull("healthIssue") || candidate.get("healthIssue") in setOf("sniffles", "tummy")) { "健康记录无效。" }
        if (!candidate.isNull("pendingOutdoor")) {
            val p = candidate.getJSONObject("pendingOutdoor")
            require(p.has("choice")) { "户外故事记录缺失。" }
            val a = activities.firstOrNull { it.id == p.get("mode") } ?: error("户外活动无效。")
            require(p.get("petId") == candidate.getString("petId")) { "户外猫咪不匹配。" }
            val token = p.get("token")
            require(token is String && token.length in 1..128 && token.none { it.isISOControl() }) { "户外凭据无效。" }
            integer(p, "startedAtMs", 9_007_199_254_740_991L)
            require(p.get("location") is String && p.getString("location") in locations) { "户外地点无效。" }
            val collected = strings(p.getJSONArray("collected"))
            val ids = nodes(a.id).map { it.getString("id") }
            require(collected.size == collected.toSet().size && collected.all { it in ids }) { "户外节点记录无效。" }
            require(a.id != "walk" || collected == ids.take(collected.size)) { "散步路标顺序无效。" }
            if (!p.isNull("choice")) {
                val c = p.getJSONObject("choice")
                require(c.get("event") in events && c.get("choice") in choices && c.get("raincoat") is Boolean) { "户外故事无效。" }
            }
        }
        if (!candidate.isNull("pendingClinic")) {
            val p = candidate.getJSONObject("pendingClinic")
            require(candidate.isNull("pendingOutdoor")) { "小猫不能同时出游和检查。" }
            require(p.get("petId") == candidate.getString("petId")) { "检查猫咪不匹配。" }
            val token = p.get("token")
            require(token is String && token.length in 1..128 && token.none { it.isISOControl() }) { "检查凭据无效。" }
            integer(p, "startedAtMs", 9_007_199_254_740_991L)
            require(p.has("issue") && (p.isNull("issue") || p.get("issue") in setOf("sniffles", "tummy"))) { "检查病况无效。" }
            require(integer(p, "cost", 8) == if (p.isNull("issue")) 4L else 8L) { "检查费用无效。" }
        }
    }

    /** Failures never alter the supplied transaction candidate. No external state is touched. */
    private fun change(candidate: JSONObject, operation: (JSONObject) -> Result): Result = try {
        val next = JSONObject(candidate.toString())
        initialize(next)
        validate(next)
        val result = operation(next)
        if (result.ok) {
            validate(next)
            next.keys().asSequence().toList().forEach { candidate.put(it, next.get(it)) }
        }
        result
    } catch (e: Exception) { Result(false, e.message ?: "本地生活记录无效。") }

    fun sell(candidate: JSONObject, itemId: String, quantity: Int = 1): Result = change(candidate) { n ->
        require(n.isNull("pendingOutdoor")) { "小猫正在户外，先完成活动或一起回家吧。" }
        require(n.isNull("pendingClinic")) { "小猫正在看医生，先完成检查或离开诊所吧。" }
        val item = items.firstOrNull { it.id == itemId } ?: error("没有找到这件背包物品。")
        require(quantity in 1..100_000) { "出售数量需要是有效的正整数。" }
        val inventory = n.getJSONObject("inventory")
        val count = integer(inventory, itemId, 100_000).toInt()
        require(count >= quantity) { "背包里没有这么多物品。" }
        val gain = quantity * item.sellPrice
        val coins = integer(n, "coins", 1_000_000).toInt()
        require(coins + gain <= 1_000_000) { "喵币存放上限快满了，先买些喜欢的东西吧。" }
        inventory.put(itemId, count - quantity); n.put("coins", coins + gain)
        Result(true, "卖出${quantity}份${item.name}，喵币 +${gain}。", JSONObject().put("id", itemId).put("quantity", quantity).put("coinDelta", gain))
    }

    fun nodes(mode: String): List<JSONObject> {
        val ids: List<String?> = when (mode) {
            "walk" -> listOf(null, null, null)
            "fish" -> listOf("fish", "fish", "fish", "fish")
            "explore" -> listOf("flower", "flower", "shell", "star", "fish")
            else -> error("请选择地图上的户外活动。")
        }
        return ids.mapIndexed { i, item -> JSONObject().put("id", "$mode-${i + 1}").put("itemId", item ?: JSONObject.NULL) }
    }
    private fun activityJson(a: Activity) = JSONObject().put("id", a.id).put("name", a.name).put("target", a.target)
        .put("minSeconds", a.minSeconds).put("xp", a.xp).put("coins", a.coins).put("description", a.description)
    private fun session(n: JSONObject, token: String): JSONObject {
        require(!n.isNull("pendingOutdoor")) { "这次户外活动已经结束，重新出门吧。" }
        return n.getJSONObject("pendingOutdoor").also { require(it.getString("token") == token) { "这次户外活动已经结束，重新出门吧。" } }
    }
    private fun collectedItems(p: JSONObject): JSONObject = emptyInventory().also { result ->
        val visited = strings(p.getJSONArray("collected")).toSet()
        nodes(p.getString("mode")).filter { it.getString("id") in visited && !it.isNull("itemId") }.forEach {
            val id = it.getString("itemId"); result.put(id, result.getInt(id) + 1)
        }
    }
    fun beginOutdoor(candidate: JSONObject, mode: String, location: String, token: String, startedAtMs: Long): Result = change(candidate) { n ->
        require(n.isNull("pendingOutdoor")) { "小猫正在户外，先完成活动或一起回家吧。" }
        require(n.isNull("pendingClinic")) { "小猫正在看医生，先完成检查或离开诊所吧。" }
        val a = activities.firstOrNull { it.id == mode } ?: error("请选择地图上的户外活动。")
        require(location in locations) { "请选择地图上的户外活动。" }
        require(n.isNull("healthIssue")) { "小猫有点不舒服，先去诊所看医生吧。" }
        require(finiteStat(n.getJSONObject("stats"), "energy") >= 12) { "小猫累了，睡一觉再出门吧。" }
        n.put("pendingOutdoor", JSONObject().put("token", token).put("petId", n.getString("petId"))
            .put("mode", mode).put("location", location).put("startedAtMs", startedAtMs).put("collected", JSONArray()).put("choice", JSONObject.NULL))
        val w = n.getJSONObject("world"); val seq = w.getLong("nextSession")
        w.put("nextSession", if (seq == 9_007_199_254_740_991L) 1L else seq + 1)
        Result(true, a.description, JSONObject().put("token", token).put("mode", mode).put("location", location)
            .put("activity", activityJson(a)).put("nodes", JSONArray(nodes(mode))))
    }
    fun collectOutdoor(candidate: JSONObject, token: String, nodeId: String): Result = change(candidate) { n ->
        val p = session(n, token); val a = activities.first { it.id == p.getString("mode") }
        val all = nodes(a.id); val node = all.firstOrNull { it.getString("id") == nodeId } ?: error("这不是本次活动的收获。")
        val visited = strings(p.getJSONArray("collected"))
        require(nodeId !in visited) { "这个位置已经探索过了，去找下一个吧。" }
        require(a.id != "walk" || nodeId == all[visited.size].getString("id")) { "沿着牵绳路线，先走到前一个路标吧。" }
        p.getJSONArray("collected").put(nodeId)
        val message = if (node.isNull("itemId")) "到达散步路标啦。" else "找到${items.first { it.id == node.getString("itemId") }.name}啦，完成后带回家。"
        Result(true, message, JSONObject().put("nodeId", nodeId).put("itemId", node.get("itemId"))
            .put("collected", visited.size + 1).put("target", a.target).put("items", collectedItems(p)))
    }
    fun chooseOutdoor(candidate: JSONObject, token: String, event: String, choice: String): Result = change(candidate) { n ->
        val p = session(n, token)
        require(event in events && choice in choices) { "请选择这次小故事里的行动。" }
        require(p.isNull("choice")) { "这次小故事已经做过选择啦。" }
        p.put("choice", JSONObject().put("event", event).put("choice", choice).put("raincoat", n.optString("outfit") == "raincoat"))
        // Native invokes care only at the real wipe completion point; stats remain deferred.
        if (event == "rain" && choice == "care") n.put("wet", false)
        Result(true, storyMessage(p.getJSONObject("choice"), pending = true) + " 选择已保存，数值与收获在完成活动后结算。", JSONObject().put("event", event).put("choice", choice).put("wet", n.getBoolean("wet")))
    }
    /** Same story selector as Mf.G: JS [...token] then charCodeAt(0), including astral chars. */
    fun outdoorEventForToken(token: String): String {
        val sum = token.codePoints().toArray().sumOf { code -> if (code > 0xffff) Character.highSurrogate(code).code else code }
        return listOf("butterfly", "lost-pouch", "rain")[sum % 3]
    }
    /** Presentation-only observation; never grants stats, coins, XP or inventory. */
    fun observeOutdoorEvent(candidate: JSONObject, token: String, event: String): Result = change(candidate) { n ->
        val p = session(n, token)
        require(event in events && event == outdoorEventForToken(token)) { "这不是本次出游的偶遇事件。" }
        val eventId = JSONArray().put(n.getString("petId")).put(token).put(event).toString()
        val observed = strings(n.getJSONArray("observedOutdoorEvents"))
        if (eventId in observed) Result(true, "这次偶遇已经出现过了。", JSONObject().put("eventId", eventId).put("event", event).put("newlyObserved", false).put("wet", n.getBoolean("wet")))
        else {
            require(p.isNull("choice")) { "这次偶遇已经做过选择，不能重新播放。" }
            n.put("observedOutdoorEvents", JSONArray((observed + eventId).takeLast(128)))
            if (event == "rain") n.put("wet", true)
            Result(true, "小猫遇到了${if (event == "rain") "小雨" else if (event == "butterfly") "蝴蝶" else "失物小包"}。", JSONObject()
                .put("eventId", eventId).put("event", event).put("newlyObserved", true).put("wet", n.getBoolean("wet")))
        }
    }
    private fun storyMessage(c: JSONObject, pending: Boolean = false): String = when (c.getString("event")) {
        "rain" -> when (c.getString("choice")) {
            "safe" -> "一起躲到遮蔽处，不再继续淋雨。"
            "care" -> "擦干毛毛，抱着小猫等待雨停。"
            else -> if (c.getBoolean("raincoat")) "雨衣挡住了大部分雨水，小猫踩了踩水洼。"
                else if (pending) "小猫在水洼玩了一会儿，有着凉的风险。"
                else "小猫在水洼玩得很开心，但有点打喷嚏。回家后去诊所检查吧。"
        }
        "lost-pouch" -> when (c.getString("choice")) {
            "care" -> "把小包送回失主手里，小猫收到了一个温柔的夸奖。"
            "coins" -> if (pending) "帮邻居找到小包，4 枚喵币的感谢待活动完成后结算。" else "帮邻居找到小包，收到了 4 枚喵币的感谢。"
            else -> "留在原地等了一会儿，失主回来拿走了小包。"
        }
        else -> when (c.getString("choice")) {
            "care" -> "静静看蝴蝶停在野花上，留下了一段小回忆。"
            "coins" -> "小猫追着蝴蝶绕了一圈，开心地跑了回来。"
            else -> "沿着小路绕过蝴蝶，给它留一点安静。"
        }
    }
    /** elapsedMs MUST come from the native foreground session monotonic clock, never JS/wall time. */
    fun settleOutdoor(candidate: JSONObject, token: String, elapsedMs: Long): Result = change(candidate) { n ->
        val p = session(n, token); val a = activities.first { it.id == p.getString("mode") }
        require(p.getJSONArray("collected").length() == a.target) { "还有小目标没有完成，继续陪小猫走走吧。" }
        require(elapsedMs >= a.minSeconds * 1000L) { "小猫还想看看风景，再陪它一会儿吧。" }
        val inventory = n.getJSONObject("inventory"); val w = n.getJSONObject("world"); val stats = n.getJSONObject("stats")
        val found = collectedItems(p)
        items.forEach { i ->
            inventory.put(i.id, (inventory.getInt(i.id) + found.getInt(i.id)).coerceAtMost(100_000))
            val collected = w.getJSONObject("collected"); collected.put(i.id, (collected.getInt(i.id) + found.getInt(i.id)).coerceAtMost(1_000_000))
        }
        val completed = w.getJSONObject("completed"); completed.put(a.id, (completed.getInt(a.id) + 1).coerceAtMost(1_000_000))
        w.put("lastLocation", p.getString("location"))
        val oldXp = integer(n, "xp", 10_000_000).toInt(); val oldCoins = integer(n, "coins", 1_000_000).toInt()
        n.put("xp", (oldXp + a.xp).coerceAtMost(10_000_000))
        addStat(stats, "energy", if (a.id == "walk") -4.0 else -6.0); addStat(stats, "food", -3.0); addStat(stats, "mood", 9.0)
        var storyCoins = 0
        if (!p.isNull("choice")) {
            val c = p.getJSONObject("choice"); val event = c.getString("event"); val choice = c.getString("choice")
            if (event == "rain") when (choice) {
                "care" -> { addStat(stats, "mood", 4.0); addStat(stats, "health", 3.0) }
                "coins" -> if (c.getBoolean("raincoat")) { addStat(stats, "mood", 6.0); addStat(stats, "clean", -3.0); addStat(stats, "health", -2.0) }
                    else { addStat(stats, "mood", 4.0); addStat(stats, "clean", -8.0); addStat(stats, "health", -18.0); n.put("healthIssue", "sniffles") }
            } else if (event == "lost-pouch") when (choice) { "care" -> addStat(stats, "mood", 6.0); "coins" -> storyCoins = 4 }
            else when (choice) { "care" -> addStat(stats, "mood", 6.0); "coins" -> { addStat(stats, "energy", -4.0); addStat(stats, "mood", 5.0) } }
            w.put("choices", (w.getInt("choices") + 1).coerceAtMost(1_000_000))
        }
        val claimed = w.getJSONArray("claimedOrders"); val done = strings(claimed).toMutableSet(); val newly = JSONArray(); var orderCoins = 0
        val metrics = listOf(completed.getInt("walk"), w.getJSONObject("collected").getInt("flower"), completed.getInt("fish") * 4)
        val targets = listOf(1, 3, 4); val rewards = listOf(8, 10, 12)
        orderIds.forEachIndexed { i, id -> if (id !in done && metrics[i] >= targets[i]) { claimed.put(id); done.add(id); newly.put(id); orderCoins += rewards[i] } }
        n.put("coins", (oldCoins + a.coins + storyCoins + orderCoins).coerceAtMost(1_000_000)); n.put("pendingOutdoor", JSONObject.NULL)
        Result(true, "${a.name}完成！收获已放进背包${if (newly.length() > 0) "，还完成了${newly.length()}份邻里委托" else ""}。", JSONObject()
            .put("xpGain", n.getInt("xp") - oldXp).put("coinDelta", n.getInt("coins") - oldCoins)
            .put("stageChanged", stage(oldXp) != stage(n.getInt("xp"))).put("stage", stage(n.getInt("xp")))
            .put("items", found).put("ordersCompleted", newly).put("healthIssue", n.get("healthIssue"))
            .put("storyMessage", if (p.isNull("choice")) JSONObject.NULL else storyMessage(p.getJSONObject("choice"))))
    }
    private fun addStat(stats: JSONObject, id: String, delta: Double) { stats.put(id, (finiteStat(stats, id) + delta).coerceIn(0.0, 100.0)) }
    fun cancelOutdoor(candidate: JSONObject, token: String): Result = change(candidate) { n ->
        session(n, token); n.put("pendingOutdoor", JSONObject.NULL)
        Result(true, "小猫回家啦，未完成的活动没有扣钱或结算收获。")
    }
    fun beginClinic(candidate: JSONObject, token: String, startedAtMs: Long): Result = change(candidate) { n ->
        require(n.isNull("pendingOutdoor") && n.isNull("pendingClinic")) { "先完成当前活动，再来检查吧。" }
        val issue = n.get("healthIssue"); val cost = if (issue == JSONObject.NULL) 4 else 8
        require(integer(n, "coins", 1_000_000) >= cost) { "这次${if (cost == 4) "体检" else "诊疗"}需要 ${cost} 枚喵币，先出售一些背包收获吧。" }
        n.put("pendingClinic", JSONObject().put("token", token).put("petId", n.getString("petId"))
            .put("startedAtMs", startedAtMs).put("issue", issue).put("cost", cost))
        Result(true, "先量体温，再完成医生的三个检查步骤。检查完成才收费。", JSONObject().put("token", token).put("cost", cost).put("issue", issue).put("requiredSteps", 3))
    }
    /** Native validates the renderer's completed three steps and supplies monotonic elapsed time. */
    fun finishClinic(candidate: JSONObject, token: String, steps: Int, elapsedMs: Long): Result = change(candidate) { n ->
        require(!n.isNull("pendingClinic")) { "这次检查已经结束，请重新挂号。" }
        val p = n.getJSONObject("pendingClinic")
        require(p.getString("token") == token) { "这次检查已经结束，请重新挂号。" }
        require(steps == 3) { "先完成医生的三个检查步骤吧。" }
        require(elapsedMs >= 1500L) { "医生还在检查，再陪小猫一会儿。" }
        val cost = p.getInt("cost"); val coins = integer(n, "coins", 1_000_000).toInt()
        require(coins >= cost) { "喵币不足，这次检查没有扣费。" }
        val oldXp = integer(n, "xp", 10_000_000).toInt(); val hadIssue = !n.isNull("healthIssue")
        n.put("coins", coins - cost).put("xp", (oldXp + 3).coerceAtMost(10_000_000)).put("healthIssue", JSONObject.NULL)
        addStat(n.getJSONObject("stats"), "mood", 3.0); addStat(n.getJSONObject("stats"), "health", if (hadIssue) 30.0 else 8.0)
        n.put("pendingClinic", JSONObject.NULL)
        Result(true, if (hadIssue) "医生开好了药，小猫恢复健康啦。" else "检查结束，小猫很健康，继续一起生活吧。", JSONObject()
            .put("xpGain", n.getInt("xp") - oldXp).put("coinDelta", -cost).put("stageChanged", stage(oldXp) != stage(n.getInt("xp"))).put("stage", stage(n.getInt("xp"))))
    }
    fun cancelClinic(candidate: JSONObject, token: String): Result = change(candidate) { n ->
        require(!n.isNull("pendingClinic") && n.getJSONObject("pendingClinic").getString("token") == token) { "没有需要取消的检查。" }
        n.put("pendingClinic", JSONObject.NULL); Result(true, "检查已取消，没有收取诊疗费用。")
    }
    fun stage(xp: Int): String = if (xp >= 160) "adult" else if (xp >= 60) "young" else "kitten"
    fun trait(counts: JSONObject): String {
        var maximum = 0; var best = "温柔"
        careOrder.forEachIndexed { i, key -> val count = counts.optInt(key, 0); if (count > maximum) { maximum = count; best = traits[i] } }
        return best
    }
}
