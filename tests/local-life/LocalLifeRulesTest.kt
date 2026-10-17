import com.catforest.app.LocalLifeRules as Rules
import org.json.JSONObject
import org.json.JSONArray

private fun fresh(): JSONObject = JSONObject().put("petId", "permanent-pet-uuid").put("name", "小橘")
    .put("coins", 30).put("xp", 0).put("outfit", "none").put("revision", 77)
    .put("stats", JSONObject().put("food", 70).put("energy", 80).put("mood", 60).put("clean", 80).put("health", 100))
    .also { Rules.initialize(it); Rules.validate(it) }
private fun begin(n: JSONObject, mode: String = "explore", token: String = "trip-1") {
    check(Rules.beginOutdoor(n, mode, "garden", token, 1000L).ok)
}
private fun visitAll(n: JSONObject, mode: String = "explore", token: String = "trip-1") {
    Rules.nodes(mode).forEach { check(Rules.collectOutdoor(n, token, it.getString("id")).ok) }
}
private fun unchanged(n: JSONObject, action: () -> Rules.Result) {
    val before = n.toString(); check(!action().ok); check(n.toString() == before) { "Rejected operation changed candidate" }
}
fun main() {
    var passed = 0
    fun test(name: String, run: () -> Unit) { run(); passed++; println("PASS $name") }
    test("old-save-migration-does-not-grant-items-or-reset-id") {
        val n = fresh(); check(n.getJSONObject("inventory").toMap().values.all { it == 0 })
        check(n.getString("petId") == "permanent-pet-uuid" && n.getInt("revision") == 77)
        val before = n.toString(); Rules.initialize(n); check(before == n.toString())
    }
    test("partial-corrupt-inventory-is-not-silently-repaired") {
        val n = fresh().put("inventory", JSONObject().put("fish", 3)); Rules.initialize(n)
        check(!n.getJSONObject("inventory").has("flower")); unchanged(n) { Rules.sell(n, "fish") }
    }
    test("strict-integer-and-unknown-item-rejection") {
        for (v in listOf<Any>(true, "2", 2.5, -1, 100001)) {
            val n = fresh(); n.getJSONObject("inventory").put("fish", v); unchanged(n) { Rules.sell(n, "fish") }
        }
        val n = fresh(); unchanged(n) { Rules.sell(n, "gold") }; unchanged(n) { Rules.sell(n, "fish", 0) }
        n.getJSONObject("inventory").put("fish", 1.0); check(Rules.sell(n, "fish").ok)
    }
    test("sale-exact-prices-insufficient-stock-and-coin-limit") {
        for ((id, price) in listOf("fish" to 3, "flower" to 2, "shell" to 4, "star" to 7)) {
            val n = fresh(); n.getJSONObject("inventory").put(id, 2)
            check(Rules.sell(n, id, 2).ok); check(n.getInt("coins") == 30 + price * 2)
            unchanged(n) { Rules.sell(n, id) }
        }
        val n = fresh().put("coins", 999999); n.getJSONObject("inventory").put("star", 1)
        unchanged(n) { Rules.sell(n, "star") }
    }
    test("walk-requires-ordered-unique-original-nodes-and-token") {
        val n = fresh(); begin(n, "walk")
        unchanged(n) { Rules.collectOutdoor(n, "wrong", "walk-1") }
        unchanged(n) { Rules.collectOutdoor(n, "trip-1", "walk-2") }
        check(Rules.collectOutdoor(n, "trip-1", "walk-1").ok)
        unchanged(n) { Rules.collectOutdoor(n, "trip-1", "walk-1") }
        unchanged(n) { Rules.collectOutdoor(n, "trip-1", "walk-9") }
        unchanged(n) { Rules.settleOutdoor(n, "trip-1", 12000) }
    }
    test("failed-settlement-does-not-consume-session-or-reward") {
        val n = fresh(); begin(n); visitAll(n)
        unchanged(n) { Rules.settleOutdoor(n, "trip-1", 14999) }
        check(n.getInt("coins") == 30 && n.getInt("xp") == 0)
        check(Rules.settleOutdoor(n, "trip-1", 15000).ok)
        check(n.getInt("coins") == 35 && n.getInt("xp") == 8)
        unchanged(n) { Rules.settleOutdoor(n, "trip-1", 15000) }
    }
    test("explore-original-yield-exact-rewards-and-orders-claim-once") {
        val n = fresh()
        for (i in 1..2) {
            begin(n, token = "trip-$i"); visitAll(n, token = "trip-$i")
            check(Rules.settleOutdoor(n, "trip-$i", 15000).ok)
        }
        val inv = n.getJSONObject("inventory")
        check(inv.getInt("flower") == 4 && inv.getInt("fish") == 2 && inv.getInt("shell") == 2 && inv.getInt("star") == 2)
        check(n.getInt("coins") == 50 && n.getInt("xp") == 16)
        check(n.getJSONObject("world").getJSONArray("claimedOrders").toList() == listOf("flower_bundle"))
    }
    test("fish-and-walk-original-commissions-are-not-repeatable") {
        val n = fresh()
        for (mode in listOf("walk", "fish", "walk", "fish")) {
            begin(n, mode); visitAll(n, mode); check(Rules.settleOutdoor(n, "trip-1", 15000).ok)
        }
        check(n.getInt("coins") == 66 && n.getInt("xp") == 28)
        check(n.getJSONObject("inventory").getInt("fish") == 8)
        check(n.getJSONObject("world").getJSONArray("claimedOrders").length() == 2)
    }
    test("cancel-discards-pending-harvest-without-changing-care-state") {
        val n = fresh(); val coins = n.getInt("coins"); val stats = n.getJSONObject("stats").toString()
        begin(n); visitAll(n); check(Rules.chooseOutdoor(n, "trip-1", "rain", "coins").ok)
        check(Rules.cancelOutdoor(n, "trip-1").ok)
        check(n.getInt("coins") == coins && n.getInt("xp") == 0 && n.getJSONObject("stats").toString() == stats)
        check(n.isNull("healthIssue") && n.getJSONObject("inventory").getInt("flower") == 0)
        unchanged(n) { Rules.settleOutdoor(n, "trip-1", 15000) }
    }
    test("disk-transaction-clone-retry-and-persisted-session-are-safe") {
        val stored = fresh(); begin(stored); visitAll(stored)
        val failedWriteCandidate = JSONObject(stored.toString())
        check(Rules.settleOutdoor(failedWriteCandidate, "trip-1", 15000).ok)
        check(stored.getInt("coins") == 30 && !stored.isNull("pendingOutdoor"))
        val restored = JSONObject(stored.toString()); Rules.validate(restored)
        check(Rules.settleOutdoor(restored, "trip-1", 15000).ok && restored.getInt("coins") == 35)
    }
    test("rain-illness-original-effects-and-clinic-complete-recovery") {
        val n = fresh(); begin(n); visitAll(n)
        check(Rules.chooseOutdoor(n, "trip-1", "rain", "coins").ok)
        unchanged(n) { Rules.chooseOutdoor(n, "trip-1", "butterfly", "safe") }
        check(Rules.settleOutdoor(n, "trip-1", 15000).ok)
        check(n.getString("healthIssue") == "sniffles" && n.getJSONObject("stats").getDouble("health") == 82.0)
        unchanged(n) { Rules.beginOutdoor(n, "walk", "park", "trip-2", 0) }
        check(Rules.beginClinic(n, "clinic-1", 2000).ok)
        unchanged(n) { Rules.finishClinic(n, "clinic-1", 2, 1500) }
        unchanged(n) { Rules.finishClinic(n, "clinic-1", 3, 1499) }
        check(Rules.finishClinic(n, "clinic-1", 3, 1500).ok)
        check(n.isNull("healthIssue") && n.getJSONObject("stats").getDouble("health") == 100.0)
        check(n.getInt("coins") == 27 && n.getInt("xp") == 11)
        unchanged(n) { Rules.finishClinic(n, "clinic-1", 3, 1500) }
    }
    test("raincoat-protects-at-choice-time-and-health-check-price-is-four") {
        val n = fresh().put("outfit", "raincoat"); begin(n); visitAll(n)
        check(Rules.chooseOutdoor(n, "trip-1", "rain", "coins").ok); n.put("outfit", "none")
        check(Rules.settleOutdoor(n, "trip-1", 15000).ok)
        check(n.isNull("healthIssue") && n.getJSONObject("stats").getDouble("health") == 98.0)
        check(Rules.beginClinic(n, "clinic-2", 3000).ok)
        check(n.getJSONObject("pendingClinic").getInt("cost") == 4)
        check(Rules.cancelClinic(n, "clinic-2").ok && n.getInt("coins") == 35)
    }
    test("clinic-availability-and-insufficient-money-preserve-candidate") {
        val n = fresh().put("coins", 3); unchanged(n) { Rules.beginClinic(n, "clinic", 0) }
        n.put("coins", 30); begin(n); unchanged(n) { Rules.beginClinic(n, "clinic", 0) }
        check(Rules.cancelOutdoor(n, "trip-1").ok); check(Rules.beginClinic(n, "clinic", 0).ok)
        unchanged(n) { Rules.beginOutdoor(n, "walk", "garden", "new", 0) }
        n.put("coins", 0); unchanged(n) { Rules.finishClinic(n, "clinic", 3, 1500) }
    }
    test("original-growth-boundaries-and-trait-tie-order") {
        check(listOf(0, 59, 60, 159, 160).map(Rules::stage) == listOf("kitten", "kitten", "young", "young", "adult"))
        check(Rules.trait(JSONObject()) == "温柔")
        check(Rules.trait(JSONObject().put("feed", 2).put("bath", 2)) == "小吃货")
        check(Rules.trait(JSONObject().put("feed", 2).put("play", 3)) == "接鱼高手")
    }
    test("rain-presentation-fields-migrate-only-absent-whole-fields") {
        val n = fresh(); n.remove("wet"); n.remove("observedOutdoorEvents"); Rules.initialize(n); Rules.validate(n)
        check(n.get("wet") == false && n.getJSONArray("observedOutdoorEvents").length() == 0)
        for (v in listOf<Any>("false", 0, JSONObject.NULL)) {
            val bad = fresh().put("wet", v); Rules.initialize(bad)
            unchanged(bad) { Rules.beginOutdoor(bad, "walk", "garden", "t", 0) }
        }
        for (v in listOf<Any>("bad", JSONObject.NULL, JSONArray().put("a").put("a"), JSONArray().put(1), JSONArray().put(""))) {
            val bad = fresh().put("observedOutdoorEvents", v); Rules.initialize(bad)
            unchanged(bad) { Rules.beginOutdoor(bad, "walk", "garden", "t", 0) }
        }
    }
    test("observation-validates-source-story-and-current-session") {
        check(Rules.outdoorEventForToken("t") == "rain")
        check(Rules.outdoorEventForToken("r") == "butterfly")
        check(Rules.outdoorEventForToken("s") == "lost-pouch")
        check(Rules.outdoorEventForToken("😀") == "lost-pouch") // JS spread takes one high-surrogate charCode.
        val n = fresh(); begin(n, token = "t")
        unchanged(n) { Rules.observeOutdoorEvent(n, "wrong", "rain") }
        unchanged(n) { Rules.observeOutdoorEvent(n, "t", "butterfly") }
        unchanged(n) { Rules.observeOutdoorEvent(n, "t", "typhoon") }
        check(!n.getBoolean("wet"))
    }
    test("rain-observation-is-persistent-idempotent-presentation-only") {
        val n = fresh(); begin(n, token = "t")
        val stats = n.getJSONObject("stats").toString(); val inventory = n.getJSONObject("inventory").toString()
        val first = Rules.observeOutdoorEvent(n, "t", "rain")
        check(first.ok && first.payload.getBoolean("newlyObserved") && n.getBoolean("wet"))
        check(n.getInt("coins") == 30 && n.getInt("xp") == 0 && n.getInt("revision") == 77)
        check(n.getJSONObject("stats").toString() == stats && n.getJSONObject("inventory").toString() == inventory)
        val restored = JSONObject(n.toString()); Rules.validate(restored); val before = restored.toString()
        val again = Rules.observeOutdoorEvent(restored, "t", "rain")
        check(again.ok && !again.payload.getBoolean("newlyObserved") && before == restored.toString())
        check(Rules.cancelOutdoor(restored, "t").ok && restored.getBoolean("wet"))
        check(restored.getJSONArray("observedOutdoorEvents").length() == 1)
        unchanged(restored) { Rules.observeOutdoorEvent(restored, "t", "rain") }
    }
    test("real-wipe-choice-clears-wet-once-without-prepaying-care-effects") {
        val n = fresh(); begin(n, token = "t"); check(Rules.observeOutdoorEvent(n, "t", "rain").ok)
        val stats = n.getJSONObject("stats").toString()
        val attempt = JSONObject(n.toString()); check(Rules.chooseOutdoor(attempt, "t", "rain", "care").ok)
        check(n.getBoolean("wet")) // Failed outer persistence would discard attempt, retaining true authority.
        check(Rules.chooseOutdoor(n, "t", "rain", "care").ok && !n.getBoolean("wet"))
        check(n.getJSONObject("stats").toString() == stats && n.getInt("coins") == 30 && n.getInt("xp") == 0)
        val replay = Rules.observeOutdoorEvent(n, "t", "rain")
        check(replay.ok && !replay.payload.getBoolean("newlyObserved") && !n.getBoolean("wet"))
        unchanged(n) { Rules.chooseOutdoor(n, "t", "rain", "care") }
        check(Rules.cancelOutdoor(n, "t").ok && !n.getBoolean("wet"))
        check(n.getInt("coins") == 30 && n.getInt("xp") == 0 && n.getJSONObject("stats").toString() == stats)
    }
    test("outdoor-observation-ledger-is-bounded-unique-and-nonrain-does-not-wet") {
        val n = fresh(); begin(n, token = "r"); check(Rules.observeOutdoorEvent(n, "r", "butterfly").ok)
        check(!n.getBoolean("wet")); check(Rules.cancelOutdoor(n, "r").ok)
        for (i in 1..129) {
            val token = "bounded-$i"; begin(n, token = token)
            check(Rules.observeOutdoorEvent(n, token, Rules.outdoorEventForToken(token)).ok)
            check(Rules.cancelOutdoor(n, token).ok)
        }
        Rules.validate(n); val ids = n.getJSONArray("observedOutdoorEvents").toList()
        check(ids.size == 128 && ids.toSet().size == 128)
        val corrupt = fresh().put("observedOutdoorEvents", JSONArray((1..129).map { "id-$it" }))
        unchanged(corrupt) { Rules.beginOutdoor(corrupt, "walk", "garden", "t", 0) }
    }
    test("all-nine-choice-messages-distinguish-saved-choice-from-deferred-effects") {
        for ((event, token) in listOf("butterfly" to "r", "lost-pouch" to "s", "rain" to "t")) for (choice in listOf("safe", "care", "coins")) {
            val n = fresh(); begin(n, token = token); check(Rules.observeOutdoorEvent(n, token, event).ok)
            val stats = n.getJSONObject("stats").toString(); val inventory = n.getJSONObject("inventory").toString()
            val result = Rules.chooseOutdoor(n, token, event, choice)
            check(result.ok && result.message.contains("选择已保存") && result.message.contains("完成活动后结算"))
            check(n.getInt("coins") == 30 && n.getInt("xp") == 0 && n.getJSONObject("stats").toString() == stats && n.getJSONObject("inventory").toString() == inventory)
            if (event == "rain" && choice == "safe") check(n.getBoolean("wet") && !result.message.contains("没有淋湿"))
            if (event == "rain" && choice == "coins") check(n.isNull("healthIssue") && !result.message.contains("打喷嚏") && !result.message.contains("去诊所"))
            if (event == "lost-pouch" && choice == "coins") check(!result.message.contains("收到了 4 枚"))
        }
    }
    println("RESULT $passed passed, 0 failed")
}
