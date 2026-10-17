package com.catforest.app

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.*
import android.widget.*
import org.json.JSONObject
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlin.math.roundToInt

class MainActivity : Activity(), BadgeBle.Listener {
    private lateinit var store: PetStore
    private lateinit var ble: BadgeBle
    private lateinit var web: WebView
    private lateinit var titleText: TextView
    private lateinit var detailText: TextView
    private lateinit var statsText: TextView
    private lateinit var hudStateText: TextView
    private lateinit var statusText: TextView
    private lateinit var deviceText: TextView
    private lateinit var saveText: TextView
    private lateinit var cancelCareButton: Button
    private lateinit var recoveryRestoreButton: Button
    private lateinit var pendingLifeButton: Button
    private var devices = emptyList<BadgeBle.Device>()
    private var deviceRows: LinearLayout? = null
    private var dialogStatus: TextView? = null
    private var deviceDialog: AlertDialog? = null
    private var rendererReady = false
    private var active = false
    private var lastTick = 0L
    private var playDialog: AlertDialog? = null
    private var miniWeb: WebView? = null
    private var miniMessage: TextView? = null
    private var miniStartedAt = 0L
    private var miniHasStarted = false
    private var miniGeneration = 0L
    private var pendingCare: String? = null
    private var pendingCareStarted = 0L
    private var lifeDialog: AlertDialog? = null
    private var lifeWeb: WebView? = null
    private var lifeMessage: TextView? = null
    private var lifeKind: String? = null
    private var lifeToken: String? = null
    private var lifePayload: JSONObject? = null
    private var lifeLocation = "garden"
    private var lifeGeneration = 0L
    private var lifeStartedAt = 0L
    private var wipeToken: String? = null
    private var wipeStartedAt = 0L
    private var clinicSteps = 0
    private var clinicComplete = false
    private var clinicFinishButton: Button? = null
    private val clinicToolButtons = mutableListOf<Button>()
    private val feedbackGate = VisualFeedbackGate()
    private val deferredHomeFeedback = DeferredVisualQueue(12)
    private val homeDialogs = mutableSetOf<AlertDialog>()
    private var homeDialogTransitionPending = false
    private var homeDrawerLayer: FrameLayout? = null
    private var homeDrawerPages: Map<String, View> = emptyMap()
    private var sceneAccessibility: Int = View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
    private val handler = Handler(Looper.getMainLooper())
    private val ink = Color.rgb(87, 68, 50)
    private val muted = Color.rgb(143, 124, 103)
    private val cream = Color.rgb(250, 246, 235)
    private val sand = Color.rgb(236, 224, 202)
    private val green = Color.rgb(107, 135, 93)
    private val tick = object : Runnable {
        override fun run() {
            if (!active) return
            val now = android.os.SystemClock.elapsedRealtime()
            if (lastTick > 0 && !store.blocked) runCatching { store.tick((now - lastTick) / 1000.0) }.onFailure { say(it.message ?: "暂时无法保存进度。") }
            lastTick = now
            refresh()
            if (ble.isConnected() && !store.blocked) ble.send(store.snapshot())
            handler.postDelayed(this, 15_000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 30) window.setDecorFitsSystemWindows(false)
        else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        }
        @Suppress("DEPRECATION")
        window.statusBarColor = Color.TRANSPARENT
        @Suppress("DEPRECATION")
        window.navigationBarColor = Color.TRANSPARENT
        try { store = PetStore(this) } catch (e: Exception) {
            val message = TextView(this).apply { text = "暂时无法打开存档\n\n${e.message}\n\n请检查设备存储空间后重新打开。"; setPadding(dp(24), dp(60), dp(24), dp(24)); textSize = 18f }
            setContentView(message)
            return
        }
        ble = BadgeBle(this, this)
        buildUi()
        if (Build.VERSION.SDK_INT >= 33) onBackInvokedDispatcher.registerOnBackInvokedCallback(
            android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT
        ) { if (!dismissHomeInteraction()) finishAfterTransition() }
        refresh()
        store.warning?.let(::say)
    }

    private fun buildUi() {
        val stage = FrameLayout(this).apply { setBackgroundColor(Color.rgb(238, 232, 210)) }
        val rendererMessage = label("正在打开小猫的房间…", 14f).apply { gravity = Gravity.CENTER; setPadding(dp(16), 0, dp(16), 0) }
        stage.addView(rendererMessage, FrameLayout.LayoutParams(-1, -1))
        web = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.mediaPlaybackRequiresUserGesture = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.cacheMode = WebSettings.LOAD_NO_CACHE
            @Suppress("DEPRECATION") settings.allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION") settings.allowUniversalAccessFromFileURLs = false
            addJavascriptInterface(RendererBridge(), "CatNative")
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) { request.deny() }
                override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) { callback?.invoke(origin, false, false) }
            }
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = request?.url?.toString() != RENDERER_URL
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                    val uri = request?.url ?: return null
                    return if (uri.scheme == "file" && uri.path?.startsWith("/android_asset/") == true || uri.scheme in listOf("data", "blob")) null
                    else WebResourceResponse("text/plain", "UTF-8", java.io.ByteArrayInputStream(ByteArray(0)))
                }
                override fun onPageFinished(view: WebView?, url: String?) { if (url == RENDERER_URL) pushRenderer() }
                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    if (request?.isForMainFrame == true) {
                        rendererReady = false; cancelCare(); clearHomeFeedback()
                        rendererMessage.text = "房间暂时无法显示。点这里重试。"
                        rendererMessage.setOnClickListener { rendererMessage.text = "正在重新打开小猫的房间…"; web.visibility = View.VISIBLE; web.loadUrl(RENDERER_URL) }
                        web.visibility = View.GONE
                        say("房间暂未打开，这次互动没有结算。")
                    }
                }
            }
            loadUrl(RENDERER_URL)
        }
        stage.addView(web, FrameLayout.LayoutParams(-1, -1))

        val hud = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(12), dp(12), dp(12), 0) }
        val identity = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(12), dp(2), dp(12), dp(8))
            background = shape(Color.argb(220, 255, 252, 242), 20)
        }
        val identityRow = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        titleText = label("小橘", 18f, true).apply {
            minHeight = dp(44); gravity = Gravity.CENTER_VERTICAL; maxLines = 1; ellipsize = TextUtils.TruncateAt.END
            setOnClickListener { rename() }; contentDescription = "小猫名字，点击修改"
        }
        detailText = label("", 12f).apply { maxLines = 1; ellipsize = TextUtils.TruncateAt.END; gravity = Gravity.END }
        identityRow.addView(titleText, LinearLayout.LayoutParams(0, -2, 1f))
        identityRow.addView(detailText, LinearLayout.LayoutParams(-2, -2))
        identity.addView(identityRow)
        hudStateText = label("", 11f).apply {
            maxLines = 1; ellipsize = TextUtils.TruncateAt.END; setTextColor(muted)
            setOnClickListener { showHomeDrawer("manage") }; contentDescription = "小猫状态，点击查看完整状态与存档"
        }
        identity.addView(hudStateText)
        hud.addView(identity)
        stage.addView(hud, FrameLayout.LayoutParams(-1, -2, Gravity.TOP))

        val notices = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(dp(14), 0, dp(14), dp(12)) }
        statusText = label("点点小猫，陪它待一会儿。", 12f).apply {
            setPadding(dp(12), dp(8), dp(12), dp(8)); setLines(2); ellipsize = TextUtils.TruncateAt.END
            gravity = Gravity.CENTER; background = shape(Color.argb(218, 255, 252, 242), 16)
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        notices.addView(statusText, LinearLayout.LayoutParams(-1, -2))
        cancelCareButton = button("取消这次互动", "取消照料互动，不消耗或结算") { cancelCare("这次互动已取消，没有消耗或奖励。") }.apply { visibility = View.GONE }
        notices.addView(cancelCareButton, LinearLayout.LayoutParams(-2, dp(48)))
        val dock = LinearLayout(this).apply { gravity = Gravity.CENTER; setPadding(0, dp(8), 0, 0) }
        listOf("care" to "照料", "life" to "生活", "manage" to "更多", "view" to "全景").forEach { (page, caption) ->
            dock.addView(button(caption, if (page == "view") "回到小家的全景视角" else "打开${caption}抽屉") {
                if (page == "view") {
                    if (pendingCare == null) web.evaluateJavascript("window.CatRenderer&&window.CatRenderer.resetView()", null)
                    else say("这次互动结束后，再回到全景。")
                } else showHomeDrawer(page)
            }.apply {
                textSize = 13f; setPadding(0, 0, 0, 0); background = shape(Color.argb(224, 255, 252, 242), 18)
            }, LinearLayout.LayoutParams(0, dp(48), 1f).apply { setMargins(dp(3), 0, dp(3), 0) })
        }
        notices.addView(dock, LinearLayout.LayoutParams(-1, -2))
        stage.addView(notices, FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM))

        val drawer = FrameLayout(this).apply {
            visibility = View.GONE; setBackgroundColor(Color.argb(90, 42, 38, 30)); isClickable = true
            setOnClickListener { closeHomeDrawer() }
        }
        homeDrawerLayer = drawer
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; background = shape(Color.rgb(255, 252, 243), 24)
            setPadding(dp(14), dp(10), dp(14), dp(12)); isClickable = true
        }
        val tabs = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        listOf("care" to "照料", "life" to "生活", "manage" to "管理").forEach { (page, caption) ->
            tabs.addView(button(caption, "切换到${caption}抽屉") { showHomeDrawer(page) }, LinearLayout.LayoutParams(0, dp(44), 1f).apply { marginEnd = dp(4) })
        }
        tabs.addView(button("收起", "关闭抽屉，回到小猫的房间") { closeHomeDrawer() }, LinearLayout.LayoutParams(dp(60), dp(44)))
        panel.addView(tabs)
        val drawerScroll = ScrollView(this).apply { isFillViewport = false; clipToPadding = true }
        val pages = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        drawerScroll.addView(pages)
        panel.addView(drawerScroll, LinearLayout.LayoutParams(-1, 0, 1f))
        val carePage = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val lifePage = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val managePage = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        listOf(carePage, lifePage, managePage).forEach { pages.addView(it, LinearLayout.LayoutParams(-1, -2)) }
        homeDrawerPages = mapOf("care" to carePage, "life" to lifePage, "manage" to managePage)

        carePage.addView(label("选一种陪伴，再到房间里完成。", 13f).apply { setPadding(dp(4), dp(12), dp(4), dp(8)) })
        val actions = listOf(Triple("feed", "小鱼干", "3 枚喵币"), Triple("drink", "喝水", "补充精神"), Triple("bath", "泡泡澡", "2 枚喵币"), Triple("pet", "摸摸", "幸福加一"), Triple("climb", "猫爬架", "登高探险"), Triple("tease", "逗猫棒", "追逐羽毛"), Triple("play", "接小鱼", "赚取喵币"), Triple("sleep", "睡觉", "晚安好梦"))
        actions.chunked(4).forEach { rowActions ->
            val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, dp(8), 0, 0) }
            rowActions.forEach { (id, name, hint) ->
                row.addView(button("$name\n$hint", "$name，$hint") { fromHomeDrawer { if (id == "play") play() else act(id) } }.apply { textSize = 12f; setPadding(dp(2), 0, dp(2), 0) }, LinearLayout.LayoutParams(0, dp(64), 1f).apply { setMargins(dp(2), 0, dp(2), 0) })
            }
            carePage.addView(row)
        }

        fun entry(parent: LinearLayout, text: String, description: String, action: () -> Unit) {
            parent.addView(button(text, description) { fromHomeDrawer(action) }, spaced())
        }
        entry(lifePage, "出门走走", "选择真实本地出游活动") { outdoorChoice() }
        entry(lifePage, "衣柜与毛色", "打开手机小屋的服饰衣柜和毛色选择") { wardrobe() }
        entry(lifePage, "小猫诊所", "按原型步骤检查并治疗小猫") { startClinic() }
        entry(lifePage, "小猫背包", "查看出游收获与出售物品") { inventory() }
        entry(lifePage, "小猫愿望", "查看和领取愿望奖励") { goals() }
        entry(lifePage, "生活手记", "查看真实照料记录") { journal() }
        pendingLifeButton = button("收起上次未完成的活动", "取消未结算活动，不消耗或奖励") { fromHomeDrawer { cancelRecoveredLife() } }
        lifePage.addView(pendingLifeButton, spaced())

        statsText = label("", 13f).apply { setPadding(dp(4), dp(12), dp(4), dp(8)); setLineSpacing(dp(4).toFloat(), 1f) }
        managePage.addView(statsText)
        deviceText = label("吧唧尚未连接", 12f).apply { setTextColor(muted); setPadding(dp(4), dp(8), dp(4), dp(8)); accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE }
        managePage.addView(deviceText)
        entry(managePage, "电子吧唧", "连接与管理电子吧唧") { showDevices() }
        saveText = label("", 11f).apply { setTextColor(muted); setPadding(dp(4), dp(4), dp(4), dp(8)) }
        managePage.addView(saveText)
        entry(managePage, "备份存档", "选择位置导出本地存档备份") { exportSave() }
        entry(managePage, "恢复存档", "选择已有备份恢复存档") { importSave() }
        entry(managePage, "重新检查本机存档", "只重新读取并校验本机存档，不覆盖文件") { retryLocalSave() }
        recoveryRestoreButton = button("从本机上一份存档恢复", "确认后恢复本机保留的上一份有效存档") { fromHomeDrawer { restoreLocalSave() } }
        managePage.addView(recoveryRestoreButton, spaced())

        val panelHeight = (resources.displayMetrics.heightPixels / resources.displayMetrics.density * .56f).roundToInt().coerceIn(280, 480)
        drawer.addView(panel, FrameLayout.LayoutParams(-1, dp(panelHeight), Gravity.BOTTOM))
        stage.addView(drawer, FrameLayout.LayoutParams(-1, -1))
        stage.setOnApplyWindowInsetsListener { _, insets ->
            val left: Int; val top: Int; val right: Int; val bottom: Int
            if (Build.VERSION.SDK_INT >= 30) {
                val bars = insets.getInsets(android.view.WindowInsets.Type.systemBars() or android.view.WindowInsets.Type.displayCutout())
                left = bars.left; top = bars.top; right = bars.right; bottom = bars.bottom
            } else {
                @Suppress("DEPRECATION")
                left = insets.systemWindowInsetLeft
                @Suppress("DEPRECATION")
                top = insets.systemWindowInsetTop
                @Suppress("DEPRECATION")
                right = insets.systemWindowInsetRight
                @Suppress("DEPRECATION")
                bottom = insets.systemWindowInsetBottom
            }
            hud.setPadding(left + dp(12), top + dp(8), right + dp(12), 0)
            notices.setPadding(left + dp(14), 0, right + dp(14), bottom + dp(10))
            panel.setPadding(left + dp(14), dp(10), right + dp(14), bottom + dp(12))
            insets // the full-size WebView keeps the complete stage viewport
        }
        setContentView(stage)
        stage.requestApplyInsets()
    }

    private fun showHomeDrawer(page: String) {
        if (pendingCare != null) return say("先陪小猫完成这次互动，或点「取消这次互动」。")
        if (playDialog != null || lifeDialog != null) return
        homeDrawerPages.forEach { (id, view) -> view.visibility = if (id == page) View.VISIBLE else View.GONE }
        if (homeDrawerLayer?.visibility != View.VISIBLE) sceneAccessibility = web.importantForAccessibility
        homeDrawerLayer?.visibility = View.VISIBLE
        web.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        web.evaluateJavascript("window.CatRenderer&&window.CatRenderer.setObscured(true)", null)
        clearHomeFeedback()
    }

    private fun closeHomeDrawer() {
        if (homeDrawerLayer?.visibility != View.VISIBLE) return
        homeDrawerLayer?.visibility = View.GONE
        web.importantForAccessibility = sceneAccessibility
        homeDialogTransitionPending = true
        handler.post {
            homeDialogTransitionPending = false
            if (active && homeDialogs.isEmpty() && playDialog == null && lifeDialog == null) web.evaluateJavascript("window.CatRenderer&&window.CatRenderer.setObscured(false)", null)
            flushDeferredHomeFeedback()
        }
    }

    private fun fromHomeDrawer(action: () -> Unit) { closeHomeDrawer(); handler.post { if (active) action() } }

    private fun dismissHomeInteraction(): Boolean {
        if (homeDrawerLayer?.visibility == View.VISIBLE) { closeHomeDrawer(); return true }
        if (pendingCare != null) { cancelCare("这次互动已取消，没有消耗或奖励。"); return true }
        return false
    }

    @Deprecated("Legacy back dispatch for Android 12 and earlier")
    override fun onBackPressed() { if (!dismissHomeInteraction()) super.onBackPressed() }

    private fun act(action: String) {
        if (!active || homeDrawerLayer?.visibility == View.VISIBLE || homeDialogs.isNotEmpty()) return
        if (lifeDialog != null) return say("小猫正在活动，先完成或回家吧。")
        if (playDialog != null) return say("先陪小猫完成这一局接鱼吧。")
        if (pendingCare != null) return say("小猫正在互动，陪它完成这次再来吧。")
        if (action in setOf("pet", "sleep")) {
            commitCare(action)
            return
        }
        if (!rendererReady) return say("请等小猫的房间打开后，再开始这次互动。")
        runCatching { store.checkCare(action) }.onSuccess {
            pendingCare = action
            pendingCareStarted = android.os.SystemClock.elapsedRealtime()
            cancelCareButton.visibility = View.VISIBLE
            say("小猫准备好啦，来陪它一起完成吧！")
            web.evaluateJavascript("window.CatRenderer&&window.CatRenderer.startInteraction(${JSONObject.quote(action)})", null)
        }.onFailure { say(it.message ?: "这次互动还不能开始。") }
    }

    private fun commitCare(action: String, score: Int? = null) {
        val before = store.state()
        runCatching { store.care(action, score) }.onSuccess {
            say(it); refresh()
            careFeedback(action, "phone", before)
            growthFeedback(before, "phone")
            if (ble.isConnected()) ble.send(store.snapshot())
        }.onFailure { say(it.message ?: "这次照料未完成。"); refresh() }
    }

    private fun cancelCare(message: String? = null) {
        if (pendingCare == null) return
        pendingCare = null
        pendingCareStarted = 0
        if (::cancelCareButton.isInitialized) cancelCareButton.visibility = View.GONE
        if (::web.isInitialized) web.evaluateJavascript("window.CatRenderer&&window.CatRenderer.cancelInteraction()", null)
        message?.let(::say)
    }

    private fun refresh() {
        if (!::titleText.isInitialized) return
        val state = store.state(); val stats = state.getJSONObject("stats"); val xp = state.getInt("xp")
        titleText.text = state.getString("name")
        val stage = when { xp >= 160 -> "成年猫"; xp >= 60 -> "少年猫"; else -> "幼猫" }
        detailText.text = "$stage  ·  ${state.getInt("coins")} 喵币"
        hudStateText.text = when {
            store.blocked -> "存档需要检查 · 点此查看"
            !state.isNull("healthIssue") -> "小猫不太舒服 · 到生活里的诊所看看"
            stats.getDouble("food") < 35 -> "肚子有点饿 · 点食碗一起吃饭"
            stats.getDouble("energy") < 30 -> "困困了 · 点小床休息一下"
            stats.getDouble("clean") < 35 -> "想洗泡泡澡 · 点浴盆陪它洗澡"
            else -> "饱腹 ${stats.getDouble("food").roundToInt()}  ·  心情 ${stats.getDouble("mood").roundToInt()}  ·  精力 ${stats.getDouble("energy").roundToInt()}"
        }
        statsText.text = "饱腹 ${stats.getDouble("food").roundToInt()}  ·  心情 ${stats.getDouble("mood").roundToInt()}  ·  清洁 ${stats.getDouble("clean").roundToInt()}\n精力 ${stats.getDouble("energy").roundToInt()}  ·  健康 ${stats.getDouble("health").roundToInt()}  ·  成长 $xp"
        val saved = SimpleDateFormat("MM-dd HH:mm:ss", Locale.CHINA).format(Date(state.getLong("updatedAtMs")))
        saveText.text = if (store.blocked) store.warning else "已保存在本机  $saved · 进度 ${state.getLong("revision")}"
        recoveryRestoreButton.visibility = if (store.hasLocalRecovery()) View.VISIBLE else View.GONE
        pendingLifeButton.visibility = if (store.hasPendingLife() && lifeDialog == null) View.VISIBLE else View.GONE
        if (!state.isNull("healthIssue")) statsText.append("\n${if (state.getString("healthIssue") == "sniffles") "有点打喷嚏" else "肚子不舒服"} · 去小猫诊所检查一下吧")
        pushRenderer()
        flushDeferredHomeFeedback()
    }

    private fun pushRenderer() {
        if (!::web.isInitialized) return
        val native = store.state()
        val state = store.snapshot().put("name", native.getString("name")).put("xp", native.getInt("xp"))
            .put("breed", native.getString("breed")).put("outfit", native.getString("outfit"))
            .put("stats", native.getJSONObject("stats")).put("healthIssue", native.opt("healthIssue") ?: JSONObject.NULL)
            .put("wet", native.getBoolean("wet")).put("presentation", JSONObject().put("wet", native.getBoolean("wet")))
        state.put("stage", when { state.getInt("xp") >= 160 -> "adult"; state.getInt("xp") >= 60 -> "young"; else -> "kitten" })
        web.evaluateJavascript("if(window.CatRenderer&&window.CatRenderer.applyState){window.CatRenderer.applyState($state);}", null)
    }

    private fun feedbackEvent(kind: String, phase: String, source: String, settled: Boolean, details: JSONObject = JSONObject(), before: JSONObject? = null): JSONObject {
        require(kind in FEEDBACK_KINDS) { "Unsupported visual feedback kind" }
        val state = store.state()
        val discriminator = details.optString("action", details.optString("event"))
        val event = JSONObject(details.toString()).put("version", 1)
            .put("eventId", "${state.getString("petId")}:${state.getLong("revision")}:$kind:$phase:$discriminator")
            .put("petId", state.getString("petId")).put("revision", state.getLong("revision"))
            .put("kind", kind).put("phase", phase).put("source", source).put("committed", true).put("settled", settled)
            .put("stats", state.getJSONObject("stats")).put("healthIssue", state.opt("healthIssue") ?: JSONObject.NULL)
            .put("wet", state.getBoolean("wet")).put("presentation", JSONObject().put("wet", state.getBoolean("wet")))
        before?.let { event.put("beforeStats", it.getJSONObject("stats")) }
        return event
    }

    private fun dispatchHomeFeedback(event: JSONObject) {
        runCatching {
            if (!active || event.opt("committed") != true) return
            val state = store.state()
            val sourceRevision = if (event.has("sourceRevision")) event.getLong("sourceRevision") else event.getLong("revision")
            if (event.getString("petId") != state.getString("petId") || sourceRevision > state.getLong("revision")) return
            deferredHomeFeedback.enqueue(DeferredVisualQueue.Event(event.getString("eventId"), event.getString("petId"), sourceRevision, event.toString()))
            flushDeferredHomeFeedback()
        } // optional animation must never turn a successful transaction into a business error
    }

    private fun homeActuallyVisible(): Boolean {
        if (!active || !rendererReady || !::web.isInitialized || !web.isShown || !web.hasWindowFocus()) return false
        if (pendingCare != null || playDialog != null || lifeDialog != null || homeDialogs.isNotEmpty() || homeDialogTransitionPending || homeDrawerLayer?.visibility == View.VISIBLE) return false
        val visible = Rect()
        return web.getGlobalVisibleRect(visible) && visible.width() > 0 && visible.height() >= minOf(web.height / 3, dp(120)).coerceAtLeast(1)
    }

    private fun flushDeferredHomeFeedback() {
        runCatching {
            if (!::store.isInitialized || !homeActuallyVisible()) return
            val state = store.state()
            val pending = deferredHomeFeedback.drain(state.getString("petId"), state.getLong("revision"))
            pending.forEach { saved ->
                val event = JSONObject(saved.payload)
                    .put("sourceRevision", saved.sourceRevision).put("revision", state.getLong("revision"))
                    .put("stats", state.getJSONObject("stats")).put("healthIssue", state.opt("healthIssue") ?: JSONObject.NULL)
                    .put("wet", state.getBoolean("wet")).put("presentation", JSONObject().put("wet", state.getBoolean("wet")))
                    .put("xp", state.getInt("xp")).put("breed", state.getString("breed")).put("outfit", state.getString("outfit"))
                    .put("stage", LocalLifeRules.stage(state.getInt("xp")))
                // Dedup only at actual dispatch; queuing must not consume a future visible cue.
                if (!feedbackGate.accept(saved.eventId)) return@forEach
                val action = event.optString("action")
                val fallback = if (event.optString("kind") == "care" && action in setOf("pet", "sleep")) "else if(window.CatRenderer&&window.CatRenderer.perform){window.CatRenderer.perform(${JSONObject.quote(action)});}" else ""
                web.evaluateJavascript("if(window.CatRenderer&&window.CatRenderer.feedback){window.CatRenderer.feedback($event);}$fallback", null)
            }
        }
    }

    private fun trackHomeDialog(dialog: AlertDialog, afterDismiss: () -> Unit = {}): AlertDialog {
        homeDialogs.add(dialog)
        if (::web.isInitialized) web.evaluateJavascript("window.CatRenderer&&window.CatRenderer.setObscured(true)", null)
        clearHomeFeedback()
        dialog.setOnDismissListener {
            homeDialogs.remove(dialog)
            afterDismiss()
            homeDialogTransitionPending = true
            // A sell/claim can synchronously dismiss and rebuild its dialog. Observe visibility
            // on the next UI turn so that intermediate gap never dispatches a hidden cue.
            handler.post {
                homeDialogTransitionPending = false
                if (active && homeDialogs.isEmpty() && homeDrawerLayer?.visibility != View.VISIBLE && playDialog == null && lifeDialog == null) web.evaluateJavascript("window.CatRenderer&&window.CatRenderer.setObscured(false)", null)
                flushDeferredHomeFeedback()
            }
        }
        return dialog
    }

    private fun careFeedback(action: String, source: String, before: JSONObject) {
        runCatching { dispatchHomeFeedback(feedbackEvent("care", "committed", source, true, JSONObject().put("action", action), before)) }
    }

    private fun committedFeedback(kind: String, action: String, source: String, before: JSONObject, details: JSONObject = JSONObject()) {
        runCatching {
            val event = feedbackEvent(kind, "committed", source, true, JSONObject(details.toString()).put("action", action), before)
            if (lifeKind == "world" && lifeWeb != null) dispatchWorldFeedback(event) else dispatchHomeFeedback(event)
        }
    }

    private fun growthFeedback(before: JSONObject, source: String) {
        runCatching {
            val oldXp = before.getInt("xp")
            val xp = store.state().getInt("xp")
            if (listOf(60, 160).any { oldXp < it && xp >= it }) {
                committedFeedback("milestone", "grow", source, before,
                    JSONObject().put("fromStage", LocalLifeRules.stage(oldXp)).put("stage", LocalLifeRules.stage(xp)))
            }
        }
    }

    private fun dispatchWorldFeedback(event: JSONObject) {
        runCatching {
            val scene = lifeWeb ?: return
            if (!active || lifeKind != "world" || lifeStartedAt <= 0) return
            if (!feedbackGate.accept(event.getString("eventId"))) return
            scene.evaluateJavascript("if(window.CatWorld&&window.CatWorld.feedback){window.CatWorld.feedback($event);}", null)
        }
    }

    private fun clearHomeFeedback() {
        if (::web.isInitialized) runCatching { web.evaluateJavascript("window.CatRenderer&&window.CatRenderer.clearFeedback&&window.CatRenderer.clearFeedback()", null) }
    }

    private fun clearVisualFeedback() {
        clearHomeFeedback()
        if (lifeKind == "world") runCatching { lifeWeb?.evaluateJavascript("window.CatWorld&&window.CatWorld.clearFeedback&&window.CatWorld.clearFeedback()", null) }
    }
    private fun say(message: String) { if (::statusText.isInitialized) statusText.text = message }

    inner class RendererBridge {
        @JavascriptInterface fun ready() { runOnUiThread { rendererReady = true; pushRenderer(); flushDeferredHomeFeedback() } }
        @JavascriptInterface fun action(action: String) { runOnUiThread { if (action in setOf("pet", "feed", "drink", "bath", "climb", "tease", "sleep")) act(action) } }
        @JavascriptInterface fun reportError(message: String) { runOnUiThread { rendererReady = false; cancelCare(); say("房间显示遇到问题，这次互动没有结算。摸摸、睡觉与存档仍可使用。") } }
        @JavascriptInterface fun rendererError(message: String) { reportError(message) }
        @JavascriptInterface fun careFinished(action: String, completed: Boolean, score: Double) {
            runOnUiThread {
                if (!active || pendingCare != action) return@runOnUiThread
                val elapsed = android.os.SystemClock.elapsedRealtime() - pendingCareStarted
                pendingCare = null; pendingCareStarted = 0; cancelCareButton.visibility = View.GONE
                if (!completed) { say("这次互动已取消，没有消耗或奖励。"); return@runOnUiThread }
                if (!score.isFinite() || score !in 0.0..100.0 || elapsed < 1000) { say("互动未完成，进度没有改变，请再陪小猫一会儿。"); return@runOnUiThread }
                commitCare(action)
            }
        }
        @JavascriptInterface fun progress(action: String, message: String, progress: Double) { runOnUiThread { if (pendingCare == action && progress.isFinite()) say(message.take(200)) } }
    }

    override fun onStatus(message: String, connected: Boolean) { deviceText.text = message; dialogStatus?.text = message }
    override fun onDevices(devices: List<BadgeBle.Device>) { this.devices = devices; updateDeviceRows() }
    override fun onReady() { if (!store.blocked) ble.send(store.snapshot()) }
    override fun onMessage(message: JSONObject) {
        when (message.optString("kind")) {
            "event" -> {
                val before = store.state()
                runCatching { store.badgeEvent(message) }.onSuccess { ack ->
                    ble.send(ack)
                    if (ack.optString("status") == "applied") { refresh(); careFeedback("pet", "badge", before); growthFeedback(before, "badge"); say("吧唧传来一次摸摸，进度已保存。") }
                    else if (ack.optString("status") == "rejected") say("吧唧互动未结算：${ack.optString("reason")}")
                    if (!store.blocked) ble.send(store.snapshot())
                }.onFailure { say("吧唧互动尚未保存，未确认结算。${it.message} 修复后重连可重试。"); refresh() }
            }
            "status" -> {
                val status = message.optString("status")
                if (status == "synced" && message.optString("petId") == store.snapshot().getString("petId")) {
                    val revision = message.optLong("revision", -1)
                    deviceText.text = if (revision == store.snapshot().getLong("revision")) "吧唧已同步 · 进度 $revision" else "吧唧已确认进度 $revision，正在等待最新同步。"
                } else if (status == "stale" && !store.blocked && message.optString("petId") == store.snapshot().getString("petId")) {
                    runCatching { store.advancePast(message.getString("petId"), message.getLong("revision")) }
                        .onSuccess { refresh(); ble.send(store.snapshot()); deviceText.text = "已保留本机状态并更新进度版本，正在重新同步…" }
                        .onFailure { deviceText.text = "无法安全恢复同步：${it.message}" }
                } else if (status in setOf("error", "rejected", "stale", "revision_conflict", "pet_mismatch")) {
                    deviceText.text = "吧唧同步未完成：${message.optString("reason", "请检查设备状态并重连")}" 
                }
            }
        }
    }

    private fun showDevices() {
        if (deviceDialog?.isShowing == true) return
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(18), dp(4), dp(18), dp(10)) }
        content.addView(label("连接你自己的猫咪吧唧。安全配对由系统完成；请输入吧唧屏幕上的配对码。", 13f).apply { setLineSpacing(dp(4).toFloat(), 1f) })
        content.addView(label("衣柜和毛色用于手机小屋；当前吧唧仍显示橘猫，暂不同步服饰或毛色。", 12f).apply { setTextColor(muted); setPadding(0, dp(8), 0, dp(4)) })
        dialogStatus = label(deviceText.text.toString(), 12f).apply { setTextColor(green); setPadding(0, dp(10), 0, dp(8)); accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE }
        content.addView(dialogStatus)
        val controls = LinearLayout(this)
        controls.addView(button("蓝牙权限", "由你选择是否授予附近设备权限") { requestBlePermissions() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        controls.addView(button("搜索", "搜索附近可连接的猫咪吧唧") { ble.scan() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        content.addView(controls)
        deviceRows = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(ScrollView(this).apply { addView(deviceRows) }, LinearLayout.LayoutParams(-1, dp(160)))
        val controls2 = LinearLayout(this)
        controls2.addView(button("重连", "连接上一次由你选择的吧唧") { ble.reconnect() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        controls2.addView(button("断开", "断开当前吧唧") { ble.disconnect() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        content.addView(controls2)
        content.addView(button("输入蓝牙地址", "手动输入你自己的设备蓝牙地址") { manualAddress() })
        val note = if (Build.VERSION.SDK_INT >= 31) "只有点击「蓝牙权限」后才弹出系统授权；应用不申请定位、相机或麦克风。连接仅在本页前台运行，离开应用后断开。" else "此 Android 版本不做附近搜索；请先在系统蓝牙配对，或输入地址。应用不申请定位。"
        content.addView(label(note, 11f).apply { setTextColor(muted); setPadding(0, dp(8), 0, 0) })
        deviceDialog = trackHomeDialog(AlertDialog.Builder(this).setTitle("小猫的吧唧").setView(content).setPositiveButton("回到小猫", null).create()) {
            ble.stopScan(); deviceRows = null; dialogStatus = null; deviceDialog = null
        }.also { it.show() }
        updateDeviceRows()
    }

    private fun updateDeviceRows() {
        val rows = deviceRows ?: return
        rows.removeAllViews()
        if (devices.isEmpty()) rows.addView(label("尚未搜索到设备。请让吧唧靠近并进入可配对状态。", 12f).apply { setPadding(0, dp(12), 0, dp(12)) })
        devices.forEach { device -> rows.addView(button("${device.name}${if (device.bonded) " · 已配对" else ""}\n${device.address}", "连接 ${device.name}") { ble.connect(device.address) }) }
    }

    private fun requestBlePermissions() {
        if (Build.VERSION.SDK_INT < 31) return Toast.makeText(this, "此版本使用已配对设备，不需要附近设备授权。", Toast.LENGTH_LONG).show()
        if (ble.hasPermissions()) return Toast.makeText(this, "附近设备权限已授予，可以搜索。", Toast.LENGTH_SHORT).show()
        requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT), REQUEST_BLE)
    }
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_BLE) Toast.makeText(this, if (ble.hasPermissions()) "权限已授予。请点击搜索或重连。" else "权限未授予，本地照料仍可使用。", Toast.LENGTH_LONG).show()
    }
    private fun manualAddress() {
        val input = EditText(this).apply { hint = "AA:BB:CC:DD:EE:FF"; setSingleLine(); setText(ble.lastAddress() ?: ""); inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS }
        AlertDialog.Builder(this).setTitle("连接指定吧唧").setMessage("仅输入你自己的设备地址，系统仍会要求安全配对。").setView(input).setNegativeButton("取消", null).setPositiveButton("连接") { _, _ -> ble.connect(input.text.toString().trim().uppercase(Locale.ROOT)) }.create().let { trackHomeDialog(it).show() }
    }

    private fun wardrobe() {
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), 0, dp(16), dp(8)) }
        val balance = label("", 14f, true).apply { setPadding(0, dp(8), 0, dp(8)) }
        content.addView(balance)
        content.addView(label("用于手机小屋与接鱼。当前吧唧仍显示橘猫，服饰和毛色暂不同步。", 12f).apply { setTextColor(muted); setPadding(0, 0, 0, dp(8)) })
        val tabs = LinearLayout(this)
        content.addView(tabs)
        val rows = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val listHeight = (resources.displayMetrics.heightPixels / resources.displayMetrics.density * .50f).roundToInt().coerceIn(220, 480)
        content.addView(ScrollView(this).apply { addView(rows) }, LinearLayout.LayoutParams(-1, dp(listHeight)))
        var breedsTab = false
        fun render() {
            val state = store.state()
            balance.text = "${state.getString("name")}的小衣柜 · ${state.getInt("coins")} 枚喵币"
            rows.removeAllViews()
            fun change(action: () -> String) {
                if (pendingCare != null || playDialog != null) { Toast.makeText(this, "小猫正在互动，先完成这次再来换装吧。", Toast.LENGTH_SHORT).show(); return }
                val before = store.state()
                runCatching(action).onSuccess {
                    say(it); refresh(); render()
                    val after = store.state()
                    listOf("outfit", "breed").forEach { key ->
                        if (before.getString(key) != after.getString(key)) committedFeedback("appearance", key, "phone", before,
                            JSONObject().put(key, after.getString(key)))
                    }
                    if (ble.isConnected()) ble.send(store.snapshot())
                }
                    .onFailure { Toast.makeText(this, it.message ?: "这次装扮没有改变。", Toast.LENGTH_LONG).show(); refresh() }
            }
            if (breedsTab) {
                AppearanceCatalog.breeds.forEach { breed ->
                    val item = card()
                    val heading = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
                    heading.addView(View(this).apply { background = shape(Color.parseColor(breed.color), 8) }, LinearLayout.LayoutParams(dp(16), dp(16)).apply { marginEnd = dp(8) })
                    heading.addView(label(breed.name, 15f, true))
                    item.addView(heading)
                    item.addView(label(breed.description, 12f).apply { setTextColor(muted); setPadding(0, dp(5), 0, dp(8)) })
                    val selected = state.getString("breed") == breed.id
                    val available = store.canChooseBreed(breed.id)
                    val caption = when { selected -> "现在的毛色"; !available -> "稀有后代 · 不能直接换上"; else -> "换成这个毛色 · 陪伴与成长保留" }
                    item.addView(button(caption, "${breed.name}，$caption") { change { store.chooseBreed(breed.id) } }.apply { isEnabled = available && !selected && !store.blocked })
                    rows.addView(item, spaced())
                }
            } else {
                val natural = card()
                natural.addView(label("自然蓬松的毛毛", 15f, true))
                natural.addView(button(if (state.getString("outfit") == "none") "现在没有穿服饰" else "换下服饰", "换回自然毛毛") { change { store.equipOutfit("none") } }.apply { isEnabled = state.getString("outfit") != "none" && !store.blocked })
                rows.addView(natural, spaced())
                val owned = state.getJSONArray("wardrobe")
                AppearanceCatalog.outfits.forEach { outfit ->
                    val has = (0 until owned.length()).any { owned.getString(it) == outfit.id }
                    val selected = state.getString("outfit") == outfit.id
                    val item = card()
                    item.addView(label(outfit.name, 15f, true))
                    item.addView(label(outfit.description, 12f).apply { setTextColor(muted); setPadding(0, dp(5), 0, dp(8)) })
                    val caption = when { selected -> "正在穿着"; has -> "衣柜已拥有 · 穿上"; outfit.gift -> "馈赠限定 · 商店买不到"; else -> "${outfit.price} 枚喵币 · 买下并穿上" }
                    item.addView(button(caption, "${outfit.name}，$caption") { change { if (has) store.equipOutfit(outfit.id) else store.buyAndEquipOutfit(outfit.id) } }.apply { isEnabled = !selected && (!outfit.gift || has) && !store.blocked })
                    rows.addView(item, spaced())
                }
            }
        }
        tabs.addView(button("小衣柜", "查看服饰和已拥有衣柜") { breedsTab = false; render() }, LinearLayout.LayoutParams(0, dp(44), 1f).apply { marginEnd = dp(8) })
        tabs.addView(button("换毛色", "查看原型已有的猫咪毛色") { breedsTab = true; render() }, LinearLayout.LayoutParams(0, dp(44), 1f))
        render()
        trackHomeDialog(AlertDialog.Builder(this).setTitle("小猫的衣柜").setView(content).setPositiveButton("回到小屋", null).create()).show()
    }

    private fun goals() {
        val rows = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), 0, dp(16), dp(12)) }
        val scroll = ScrollView(this).apply { addView(rows) }
        val dialog = trackHomeDialog(AlertDialog.Builder(this).setTitle("小猫愿望").setView(scroll).setPositiveButton("继续陪伴", null).create())
        store.goals().forEach { goal -> rows.addView(button("${goal.title}  ${minOf(goal.progress, goal.target)}/${goal.target}\n${when { goal.claimed -> "印章已收好"; goal.progress >= goal.target -> "${goal.coins} 枚喵币 · 点击领取"; else -> "继续陪伴 · 完成后 ${goal.coins} 枚喵币" }}", goal.title) {
            if (pendingCare != null || playDialog != null) { Toast.makeText(this, "小猫正在互动，先完成这次再来领取吧。", Toast.LENGTH_SHORT).show(); return@button }
            val before = store.state()
            runCatching { store.claim(goal.id) }.onSuccess {
                say(it); refresh(); dialog.dismiss()
                committedFeedback("milestone", "goal", "phone", before, JSONObject().put("goalId", goal.id))
                growthFeedback(before, "phone")
                if (ble.isConnected()) ble.send(store.snapshot())
                goals()
            }.onFailure { Toast.makeText(this, it.message, Toast.LENGTH_SHORT).show() }
        }.apply { isEnabled = !goal.claimed && goal.progress >= goal.target && !store.blocked; minHeight = dp(64); minimumHeight = dp(64) }, spaced()) }
        dialog.show()
    }
    private fun journal() {
        val rows = store.state().getJSONArray("journal")
        val text = if (rows.length() == 0) "生活手记还没有记录。第一次照料后就会写在这里。" else (rows.length() - 1 downTo 0).joinToString("\n\n") { val row = rows.getJSONObject(it); SimpleDateFormat("MM-dd HH:mm", Locale.CHINA).format(Date(row.getLong("at"))) + "\n" + row.getString("message") }
        AlertDialog.Builder(this).setTitle("生活手记").setMessage(text).setPositiveButton("收好", null).create().let { trackHomeDialog(it).show() }
    }
    private fun rename() {
        if (pendingCare != null || playDialog != null) return say("小猫正在互动，先完成这次再来改名字吧。")
        val input = EditText(this).apply { setSingleLine(); setText(store.state().getString("name")) }
        AlertDialog.Builder(this).setTitle("小猫的名字").setView(input).setNegativeButton("取消", null).setPositiveButton("保存") { _, _ -> runCatching { store.rename(input.text.toString()) }.onSuccess { say(it); refresh() }.onFailure { say(it.message ?: "名字没有保存。") } }.create().let { trackHomeDialog(it).show() }
    }

    private fun play() {
        if (playDialog != null || pendingCare != null || lifeDialog != null) return say("小猫正在互动，陪它完成这次再来吧。")
        try { store.checkPlay() } catch (e: Exception) { say(e.message ?: "暂时无法开始接鱼。"); return }
        val generation = ++miniGeneration
        clearHomeFeedback()
        web.evaluateJavascript("window.CatRenderer&&window.CatRenderer.pause()", null)
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(8), 0, dp(8), dp(8)) }
        miniMessage = label("正在打开接鱼小天地…", 13f).apply { setPadding(dp(6), dp(8), dp(6), dp(8)) }
        content.addView(miniMessage)
        val game = WebView(this).apply {
            setBackgroundColor(cream)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.mediaPlaybackRequiresUserGesture = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            @Suppress("DEPRECATION") settings.allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION") settings.allowUniversalAccessFromFileURLs = false
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            addJavascriptInterface(MiniBridge(generation), "CatNative")
            webChromeClient = object : WebChromeClient() { override fun onPermissionRequest(request: PermissionRequest) { request.deny() } }
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = request?.url?.toString() != MINI_URL
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                    val uri = request?.url ?: return null
                    return if (uri.scheme == "file" && uri.path?.startsWith("/android_asset/") == true || uri.scheme in listOf("data", "blob")) null else WebResourceResponse("text/plain", "UTF-8", java.io.ByteArrayInputStream(ByteArray(0)))
                }
                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) { if (request?.isForMainFrame == true) { miniMessage?.text = "游戏暂时无法显示，本局不会结算。"; miniHasStarted = false } }
            }
        }
        miniWeb = game
        val height = (resources.displayMetrics.heightPixels / resources.displayMetrics.density * .48f).roundToInt().coerceIn(250, 500)
        content.addView(game, LinearLayout.LayoutParams(-1, dp(height)))
        playDialog = AlertDialog.Builder(this).setTitle("接小鱼").setView(content).setNegativeButton("取消这局") { _, _ -> cancelMini("这局已取消，没有消耗或奖励。") }.create().also { dialog ->
            dialog.setCanceledOnTouchOutside(false)
            dialog.setOnCancelListener { cancelMini("这局已取消，没有消耗或奖励。") }
            dialog.setOnDismissListener { if (miniWeb != null) cancelMini() }
            dialog.show()
        }
        game.loadUrl(MINI_URL)
    }

    inner class MiniBridge(private val generation: Long) {
        @JavascriptInterface fun miniReady() { runOnUiThread {
            if (generation != miniGeneration || !active || playDialog?.isShowing != true || miniHasStarted) return@runOnUiThread
            miniStartedAt = android.os.SystemClock.elapsedRealtime(); miniHasStarted = true
            miniMessage?.text = "左右移动接住小鱼，躲开水滴，20 秒后结算。"
            val xp = store.state().getInt("xp")
            val appearance = JSONObject().put("stage", when { xp >= 160 -> "adult"; xp >= 60 -> "young"; else -> "kitten" }).put("breed", store.state().getString("breed")).put("outfit", store.state().getString("outfit"))
            miniWeb?.evaluateJavascript("window.CatMini&&window.CatMini.applyState($appearance)", null)
            miniWeb?.evaluateJavascript("window.CatMini&&window.CatMini.start()", null)
        } }
        @JavascriptInterface fun miniFinished(score: Int) { runOnUiThread {
            if (generation != miniGeneration || !active || !miniHasStarted || miniWeb == null) return@runOnUiThread
            val elapsed = android.os.SystemClock.elapsedRealtime() - miniStartedAt
            cancelMini()
            if (score !in 0..15 || elapsed < 1200) { say("这局结果无效，进度没有改变。请重新开始。"); return@runOnUiThread }
            commitCare("play", score)
        } }
        @JavascriptInterface fun miniStatus(json: String) { runOnUiThread {
            if (generation != miniGeneration || miniWeb == null) return@runOnUiThread
            runCatching { JSONObject(json) }.onSuccess { state ->
                if (!state.isNull("error") && state.optString("error").isNotEmpty()) { miniHasStarted = false; miniMessage?.text = "游戏暂时无法显示，本局不会结算。"; return@onSuccess }
                if (!miniHasStarted) return@onSuccess
                val score = state.optInt("score", -1); val remaining = state.optDouble("remaining", Double.NaN)
                if (score in 0..15) miniMessage?.text = "接住 $score 条小鱼${if (remaining.isFinite()) " · 剩余 ${remaining.toInt().coerceAtLeast(0)} 秒" else ""}，小心水滴！"
            }
        } }
        @JavascriptInterface fun rendererError(message: String) { runOnUiThread { if (generation == miniGeneration) { miniHasStarted = false; miniMessage?.text = "游戏暂时无法显示，本局不会结算。" } } }
    }

    private fun cancelMini(message: String? = null) {
        miniGeneration++
        miniHasStarted = false; miniStartedAt = 0
        val game = miniWeb; miniWeb = null
        val dialog = playDialog; playDialog = null
        game?.evaluateJavascript("window.CatMini&&window.CatMini.stop()", null)
        dialog?.dismiss()
        game?.removeJavascriptInterface("CatNative")
        game?.destroy()
        miniMessage = null
        if (active && ::web.isInitialized) web.evaluateJavascript("window.CatRenderer&&window.CatRenderer.resume()", null)
        message?.let(::say)
    }

    private fun inventory() {
        val state = store.state()
        val rows = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), 0, dp(16), dp(8)) }
        rows.addView(label("出游完成后才把收获带回背包。这里只显示实际存档，没有赠送库存。", 12f).apply { setTextColor(muted); setPadding(0, dp(8), 0, dp(8)) })
        val dialog = trackHomeDialog(AlertDialog.Builder(this).setTitle("小猫背包").setView(rows).setPositiveButton("收好", null).create())
        LocalLifeRules.items.forEach { item ->
            val count = state.getJSONObject("inventory").getInt(item.id)
            rows.addView(label("${item.name} × $count · 每份 ${item.sellPrice} 枚喵币", 14f).apply { setPadding(0, dp(12), 0, dp(4)) })
            val actions = LinearLayout(this)
            fun sell(quantity: Int) {
                if (pendingCare != null || playDialog != null || lifeDialog != null) return say("小猫正在互动，先完成这次再来吧。")
                val before = store.state()
                runCatching { store.sellInventory(item.id, quantity) }.onSuccess { result ->
                    say(result.optString("message")); refresh()
                    if (result.optBoolean("ok")) {
                        committedFeedback("inventory", "sell", "phone", before, JSONObject().put("itemId", item.id).put("quantity", quantity))
                        growthFeedback(before, "phone")
                        if (ble.isConnected()) ble.send(store.snapshot()); dialog.dismiss(); inventory()
                    }
                    else Toast.makeText(this, result.optString("message"), Toast.LENGTH_LONG).show()
                }.onFailure { say(it.message ?: "出售未完成。"); refresh() }
            }
            actions.addView(button("出售 1 份", "出售一份${item.name}") { sell(1) }.apply { isEnabled = count > 0 && !store.blocked }, LinearLayout.LayoutParams(0, dp(44), 1f).apply { marginEnd = dp(8) })
            actions.addView(button("全部出售", "出售背包里的全部${item.name}") { sell(count) }.apply { isEnabled = count > 0 && !store.blocked }, LinearLayout.LayoutParams(0, dp(44), 1f))
            rows.addView(actions)
        }
        dialog.show()
    }

    private fun nativeIdle(): Boolean {
        if (store.blocked) { say(store.warning ?: "请先恢复存档。"); return false }
        if (pendingCare != null || playDialog != null || lifeDialog != null) { say("小猫正在互动，先完成这次再来吧。"); return false }
        if (store.hasPendingLife()) { say("有上次未完成的活动，请先收起它，再开始新的旅程。"); cancelRecoveredLife(); return false }
        return true
    }

    private fun outdoorChoice() {
        if (!nativeIdle()) return
        val ids = arrayOf("garden", "park", "river")
        val names = arrayOf("暖爪小庭院", "微风小公园", "星星河岸")
        AlertDialog.Builder(this).setTitle("今天去哪里？").setItems(names) { _, index ->
            AlertDialog.Builder(this).setTitle(names[index]).setItems(LocalLifeRules.activities.map { "${it.name} · ${it.description}" }.toTypedArray()) { _, mode ->
                startOutdoor(LocalLifeRules.activities[mode].id, ids[index])
            }.setNegativeButton("先不出门", null).create().let { trackHomeDialog(it).show() }
        }.setNegativeButton("留在小屋", null).create().let { trackHomeDialog(it).show() }
    }

    private fun startOutdoor(mode: String, location: String) {
        if (!nativeIdle()) return
        clearWipe()
        val token = UUID.randomUUID().toString()
        runCatching { store.beginOutdoor(mode, location, token, System.currentTimeMillis()) }.onSuccess { result ->
            if (!result.optBoolean("ok")) { say(result.optString("message")); return@onSuccess }
            lifeKind = "world"; lifeToken = token; lifePayload = result; lifeLocation = location; lifeStartedAt = 0
            showLifeScene("小猫出游", WORLD_URL)
            refresh()
        }.onFailure { say(it.message ?: "这次没有出门，进度未改变。"); refresh() }
    }

    private fun startClinic() {
        if (!nativeIdle()) return
        val token = UUID.randomUUID().toString()
        runCatching { store.beginClinic(token, System.currentTimeMillis()) }.onSuccess { result ->
            if (!result.optBoolean("ok")) { say(result.optString("message")); return@onSuccess }
            lifeKind = "clinic"; lifeToken = token; lifePayload = result; lifeStartedAt = 0; clinicSteps = 0; clinicComplete = false
            showLifeScene("小猫诊所", CLINIC_URL)
            refresh()
        }.onFailure { say(it.message ?: "检查未开始，没有收取诊费。"); refresh() }
    }

    private fun appearance(): JSONObject {
        val state = store.state()
        return JSONObject().put("stage", LocalLifeRules.stage(state.getInt("xp"))).put("breed", state.getString("breed")).put("outfit", state.getString("outfit"))
            .put("petId", state.getString("petId")).put("revision", state.getLong("revision"))
            .put("stats", state.getJSONObject("stats")).put("healthIssue", state.opt("healthIssue") ?: JSONObject.NULL)
            .put("wet", state.getBoolean("wet")).put("presentation", JSONObject().put("wet", state.getBoolean("wet")))
    }

    private fun showLifeScene(title: String, url: String) {
        val generation = ++lifeGeneration
        clearHomeFeedback()
        web.evaluateJavascript("window.CatRenderer&&window.CatRenderer.pause()", null)
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(8), 0, dp(8), dp(8)) }
        lifeMessage = label(lifePayload?.optString("message") ?: "正在准备小猫的活动…", 13f).apply {
            setPadding(dp(6), dp(8), dp(6), dp(8)); setLines(3); ellipsize = TextUtils.TruncateAt.END
            gravity = Gravity.TOP or Gravity.START; contentDescription = text
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        content.addView(lifeMessage)
        val scene = WebView(this).apply {
            setBackgroundColor(cream); isVerticalScrollBarEnabled = false; isHorizontalScrollBarEnabled = false
            settings.javaScriptEnabled = true; settings.domStorageEnabled = false; settings.allowFileAccess = false; settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false; settings.setSupportMultipleWindows(false); settings.mediaPlaybackRequiresUserGesture = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            @Suppress("DEPRECATION") settings.allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION") settings.allowUniversalAccessFromFileURLs = false
            addJavascriptInterface(LifeBridge(generation), "CatNative")
            webChromeClient = object : WebChromeClient() { override fun onPermissionRequest(request: PermissionRequest) { request.deny() } }
            webViewClient = object : WebViewClient() {
                private var opened = false
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = request?.url?.toString() != url
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                    val uri = request?.url ?: return null
                    return if (uri.scheme == "file" && uri.path?.startsWith("/android_asset/") == true || uri.scheme in listOf("data", "blob")) null else WebResourceResponse("text/plain", "UTF-8", java.io.ByteArrayInputStream(ByteArray(0)))
                }
                override fun onPageFinished(view: WebView?, loadedUrl: String?) {
                    if (loadedUrl == CLINIC_URL && generation == lifeGeneration && !opened) { opened = true; view?.evaluateJavascript("window.CatClinic&&window.CatClinic.open(${appearance()})", null) }
                }
                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) { if (request?.isForMainFrame == true && generation == lifeGeneration) closeLife(true, "场景暂时无法打开，未结算活动。") }
            }
        }
        lifeWeb = scene
        val sceneHeight = (resources.displayMetrics.heightPixels / resources.displayMetrics.density * .48f).roundToInt().coerceIn(230, 470)
        content.addView(scene, LinearLayout.LayoutParams(-1, dp(sceneHeight)))
        if (lifeKind == "world") content.addView(button("回家结算", "完成原型出游目标后，把实际收获带回家") { scene.evaluateJavascript("window.CatWorld&&window.CatWorld.requestSettle()", null) })
        else {
            val tools = LinearLayout(this)
            clinicToolButtons.clear()
            listOf("体温计", "听诊器", "护理棉").forEachIndexed { index, name ->
                val tool = button(name, "选择$name，并按住小猫身体完成当前检查") { scene.evaluateJavascript("window.CatClinic&&window.CatClinic.setTool($index)", null) }.apply { isEnabled = false }
                clinicToolButtons.add(tool); tools.addView(tool, LinearLayout.LayoutParams(0, dp(44), 1f).apply { setMargins(dp(2), 0, dp(2), 0) })
            }
            content.addView(tools)
            clinicFinishButton = button("完成护理 · ${lifePayload?.optInt("cost")} 枚喵币", "三项检查完成后确认付费护理") { finishClinic() }.apply { isEnabled = false }
            content.addView(clinicFinishButton)
        }
        lifeDialog = AlertDialog.Builder(this).setTitle(title).setView(content).setNegativeButton("回到小屋") { _, _ -> closeLife(true) }.create().also { dialog ->
            dialog.setCanceledOnTouchOutside(false)
            dialog.setOnCancelListener { closeLife(true) }
            dialog.setOnDismissListener { if (lifeWeb != null) closeLife(true) }
            dialog.show()
        }
        scene.loadUrl(url)
    }

    inner class LifeBridge(private val generation: Long) {
        @JavascriptInterface fun worldReady() { runOnUiThread {
            if (generation != lifeGeneration || !active || lifeKind != "world" || lifeToken == null || lifeStartedAt > 0) return@runOnUiThread
            lifeStartedAt = android.os.SystemClock.elapsedRealtime()
            lifeWeb?.evaluateJavascript("window.CatWorld.applyState(${appearance()});window.CatWorld.enter(${JSONObject.quote(lifeLocation)},${lifePayload ?: JSONObject()})", null)
        } }
        @JavascriptInterface fun worldEvent(id: String, json: String) { runOnUiThread {
            if (generation != lifeGeneration || lifeKind != "world" || lifeWeb == null) return@runOnUiThread
            var presentationOnlyRequest = false
            val response = runCatching {
                require(active && id.length in 1..256 && json.length <= 4096 && lifeToken != null && lifeStartedAt > 0) { "这次互动已经结束。" }
                val event = JSONObject(json); val token = lifeToken!!
                presentationOnlyRequest = event.optString("type") == "world-wipe-start"
                require(event.optString("token") == token) { "这次户外活动已经结束。" }
                val before = store.state()
                when (event.optString("type")) {
                    "world-wipe-start" -> {
                        require(!store.blocked) { "请先恢复本机存档，再陪小猫擦干毛毛。" }
                        requireObservedRain(before, token)
                        wipeToken = token
                        wipeStartedAt = android.os.SystemClock.elapsedRealtime()
                        JSONObject().put("ok", true).put("message", "正在准备擦拭…")
                    }
                    "world-encounter" -> store.observeOutdoorEvent(token, event.getString("event"))
                    "world-node" -> store.collectOutdoor(token, event.getString("nodeId"))
                    "world-choice" -> {
                        if (event.getString("event") == "rain" && event.getString("choice") == "care") {
                            requireObservedRain(before, token)
                            require(wipeToken == token && wipeStartedAt > 0 && android.os.SystemClock.elapsedRealtime() - wipeStartedAt >= 800) { "请先轻轻来回擦拭，让小猫的毛毛慢慢变干。" }
                        }
                        store.chooseOutdoor(token, event.getString("event"), event.getString("choice"))
                    }
                    "world-settle" -> store.settleOutdoor(token, android.os.SystemClock.elapsedRealtime() - lifeStartedAt)
                    else -> JSONObject().put("ok", false).put("message", "不支持的户外互动。")
                }.also { result ->
                    if (result.optBoolean("ok")) {
                        val type = event.optString("type")
                        if (type != "world-wipe-start") {
                            worldCommittedFeedback(event, result, before)
                            if (type == "world-choice" || type == "world-settle") clearWipe()
                            if (type == "world-settle") { lifeToken = null; say(result.optString("message")) }
                            if (ble.isConnected()) ble.send(store.snapshot())
                        }
                    }
                }
            }.getOrElse { JSONObject().put("ok", false).put("message", it.message ?: "这次互动没有保存，请重试。") }
            if (presentationOnlyRequest) {
                lifeWeb?.evaluateJavascript("window.CatWorld&&window.CatWorld.resolve(${JSONObject.quote(id)},$response)", null)
                setLifeMessage(response.optString("message"))
            } else {
                setLifeMessage(response.optString("message"))
                refresh()
                lifeWeb?.evaluateJavascript("window.CatWorld&&window.CatWorld.resolve(${JSONObject.quote(id)},$response)", null)
            }
        } }
        @JavascriptInterface fun worldProgress(json: String) { runOnUiThread {
            if (generation != lifeGeneration || lifeKind != "world" || json.length > 4096) return@runOnUiThread
            runCatching { JSONObject(json) }.onSuccess { state -> setLifeMessage("${state.optInt("completed")} / ${state.optInt("total")} · ${state.optString("message")}") }
        } }
        @JavascriptInterface fun clinicReady() { runOnUiThread {
            if (generation != lifeGeneration || !active || lifeKind != "clinic" || lifeToken == null) return@runOnUiThread
            if (lifeStartedAt == 0L) lifeStartedAt = android.os.SystemClock.elapsedRealtime()
            clinicToolButtons.forEachIndexed { index, tool -> tool.isEnabled = index == clinicSteps }
        } }
        @JavascriptInterface fun clinicProgress(json: String) { runOnUiThread {
            if (generation != lifeGeneration || lifeKind != "clinic" || json.length > 4096) return@runOnUiThread
            runCatching { JSONObject(json) }.onSuccess { state ->
                val steps = state.get("steps")
                if (steps !is Number || steps.toDouble() % 1.0 != 0.0 || steps.toInt() !in 0..3) return@onSuccess
                clinicSteps = steps.toInt(); clinicComplete = clinicSteps == 3 && state.optBoolean("completed")
                setLifeMessage(state.optString("message"))
                clinicToolButtons.forEachIndexed { index, tool -> tool.isEnabled = lifeStartedAt > 0 && index == clinicSteps }
                clinicFinishButton?.isEnabled = clinicComplete && !store.blocked
            }
        } }
        @JavascriptInterface fun rendererError(message: String) { runOnUiThread { if (generation == lifeGeneration) closeLife(true, "场景暂时无法打开，活动没有结算。") } }
    }

    private fun setLifeMessage(message: String) {
        val target = lifeMessage ?: return
        if (target.text.toString() == message && target.contentDescription?.toString() == message) return
        target.text = message
        target.contentDescription = message
    }

    private fun requireObservedRain(state: JSONObject, token: String) {
        require(!state.isNull("pendingOutdoor")) { "这次户外活动已经结束。" }
        val session = state.getJSONObject("pendingOutdoor")
        require(session.getString("token") == token && session.isNull("choice")) { "这次偶遇已经做过选择。" }
        require(LocalLifeRules.outdoorEventForToken(token) == "rain") { "这次没有遇到小雨。" }
        val expected = JSONArray().put(state.getString("petId")).put(token).put("rain").toString()
        val observed = state.getJSONArray("observedOutdoorEvents")
        require((0 until observed.length()).any { observed.getString(it) == expected } && state.getBoolean("wet")) { "先陪小猫来到实际的雨天偶遇，再擦干毛毛吧。" }
    }

    private fun clearWipe() { wipeToken = null; wipeStartedAt = 0L }

    private fun worldCommittedFeedback(request: JSONObject, result: JSONObject, before: JSONObject) {
        // Rendering is optional. A failed visual dispatch cannot undo or misreport a durable transaction.
        runCatching {
            lifeWeb?.evaluateJavascript("window.CatWorld&&window.CatWorld.applyState(${appearance()})", null)
            val type = request.optString("type")
            if (type == "world-encounter" && result.optBoolean("newlyObserved")) {
                dispatchWorldFeedback(feedbackEvent("world_event", "encounter", "world", false,
                    JSONObject().put("event", result.getString("event")), before))
            } else if (type == "world-choice") {
                val choice = store.state().getJSONObject("pendingOutdoor").getJSONObject("choice")
                dispatchWorldFeedback(feedbackEvent("world_event", "choice_saved", "world", false, choice, before))
            } else if (type == "world-settle") {
                val previousSession = before.getJSONObject("pendingOutdoor")
                if (!previousSession.isNull("choice")) {
                    dispatchWorldFeedback(feedbackEvent("world_event", "settled", "world", true,
                        previousSession.getJSONObject("choice"), before))
                }
                dispatchHomeFeedback(feedbackEvent("outdoor", "return", "world", true,
                    JSONObject().put("mode", previousSession.getString("mode")).put("location", previousSession.getString("location")), before))
                growthFeedback(before, "world")
            }
        }
    }

    private fun finishClinic() {
        val token = lifeToken ?: return
        if (lifeKind != "clinic" || !clinicComplete || clinicSteps != 3 || lifeStartedAt <= 0) return
        val before = store.state()
        runCatching { store.finishClinic(token, clinicSteps, android.os.SystemClock.elapsedRealtime() - lifeStartedAt) }.onSuccess { result ->
            if (result.optBoolean("ok")) {
                lifeToken = null; closeLife(false); say(result.optString("message")); refresh()
                committedFeedback("clinic", "recover", "phone", before)
                growthFeedback(before, "phone")
                if (ble.isConnected()) ble.send(store.snapshot())
            }
            else setLifeMessage(result.optString("message"))
        }.onFailure { setLifeMessage(it.message ?: "护理未结算。"); refresh() }
    }

    private fun closeLife(cancelSession: Boolean, message: String? = null) {
        clearWipe()
        val kind = lifeKind; val token = lifeToken; val scene = lifeWeb; val dialog = lifeDialog
        if (cancelSession && token != null) deferredHomeFeedback.clear()
        lifeGeneration++; lifeWeb = null; lifeDialog = null; lifeKind = null; lifeToken = null; lifePayload = null; lifeStartedAt = 0
        clinicComplete = false; clinicSteps = 0; clinicFinishButton = null; clinicToolButtons.clear()
        var cancellationFailed = false
        if (cancelSession && token != null) runCatching { if (kind == "world") store.cancelOutdoor(token) else store.cancelClinic(token) }
            .onSuccess { say(it.optString("message")) }.onFailure { cancellationFailed = true; say("活动暂停，未结算；请重新检查存档后收起未完成活动。${it.message}") }
        scene?.evaluateJavascript(if (kind == "world") "window.CatWorld&&window.CatWorld.stop()" else "window.CatClinic&&window.CatClinic.stop()", null)
        dialog?.dismiss(); scene?.removeJavascriptInterface("CatNative"); scene?.destroy(); lifeMessage = null
        if (active && ::web.isInitialized) web.evaluateJavascript("window.CatRenderer&&window.CatRenderer.resume()", null)
        if (::pendingLifeButton.isInitialized) refresh()
        flushDeferredHomeFeedback()
        if (!cancellationFailed) message?.let(::say)
    }

    private fun cancelRecoveredLife() {
        if (!store.hasPendingLife()) return
        AlertDialog.Builder(this).setTitle("收起未完成的活动？").setMessage("上次没有结算的出游或检查将结束，不收取费用，也不发放临时收获。可以从小屋重新开始。").setNegativeButton("保留", null).setPositiveButton("收起") { _, _ ->
            val state = store.state()
            runCatching { if (!state.isNull("pendingOutdoor")) store.cancelOutdoor(state.getJSONObject("pendingOutdoor").getString("token")) else store.cancelClinic(state.getJSONObject("pendingClinic").getString("token")) }
                .onSuccess { say(it.optString("message")); refresh() }.onFailure { say(it.message ?: "活动未能收起，请先恢复存档。"); refresh() }
        }.create().let { trackHomeDialog(it).show() }
    }

    private fun exportSave() {
        if (store.blocked) return say("当前存档无法读取，请先从有效备份恢复。")
        startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = "application/json"; putExtra(Intent.EXTRA_TITLE, "猫咪森活-${SimpleDateFormat("yyyyMMdd-HHmmss", Locale.ROOT).format(Date())}.json") }, REQUEST_EXPORT)
    }

    private fun retryLocalSave() {
        deferredHomeFeedback.clear()
        cancelCare(); cancelMini(); closeLife(false); ble.disconnect()
        runCatching { store.retryRead() }.onSuccess { say(it); refresh() }.onFailure { say(it.message ?: "仍未能读取本机存档。"); refresh() }
    }

    private fun restoreLocalSave() {
        AlertDialog.Builder(this).setTitle("恢复本机上一份有效存档？")
            .setMessage("将恢复到上一份经过校验的本机存档。当前原文件会另外保留；同一只猫的可用去重记录会合并，进度版本会推进。吧唧会断开，恢复后请重新连接。")
            .setNegativeButton("取消", null).setPositiveButton("恢复") { _, _ ->
                deferredHomeFeedback.clear()
                cancelCare(); cancelMini(); closeLife(false); ble.disconnect()
                runCatching { store.restoreLocalRecovery() }.onSuccess { say(it); refresh() }.onFailure { say("恢复未完成：${it.message}"); refresh() }
            }.create().let { trackHomeDialog(it).show() }
    }
    private fun importSave() {
        startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = "*/*"; putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/plain", "application/octet-stream")) }, REQUEST_IMPORT)
    }
    @Deprecated("Platform activity result API keeps this first slice dependency-free")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        when (requestCode) {
            REQUEST_EXPORT -> runCatching { contentResolver.openOutputStream(uri, "wt")!!.bufferedWriter(Charsets.UTF_8).use { it.write(store.export()) } }.onSuccess { say("存档备份已导出。") }.onFailure { say("备份未完成：${it.message}") }
            REQUEST_IMPORT -> runCatching { readLimited(uri) }.onSuccess { text ->
                AlertDialog.Builder(this).setTitle("恢复这份存档？").setMessage("恢复会替换当前猫咪和照料记录，并断开吧唧。现有可读存档会额外保留在本机恢复目录；同一只猫的已处理互动记录会合并，避免吧唧重放导致重复奖励。").setNegativeButton("取消", null).setPositiveButton("恢复") { _, _ -> runCatching { store.restore(text) }.onSuccess { ble.disconnect(); say(it); refresh() }.onFailure { say("恢复未完成，当前进度未变：${it.message}") } }.create().let { trackHomeDialog(it).show() }
            }.onFailure { say("无法读取备份：${it.message}") }
        }
    }
    private fun readLimited(uri: Uri): String {
        return contentResolver.openInputStream(uri)!!.use { input ->
            val output = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
            while (true) { val read = input.read(buffer); if (read < 0) break; require(output.size() + read <= 8 * 1024 * 1024) { "备份文件过大。" }; output.write(buffer, 0, read) }
            output.toString("UTF-8")
        }
    }

    override fun onResume() { super.onResume(); if (!::store.isInitialized || !::ble.isInitialized) return; active = true; feedbackGate.resume(); lastTick = android.os.SystemClock.elapsedRealtime(); if (::web.isInitialized) { web.onResume(); clearHomeFeedback(); pushRenderer(); web.evaluateJavascript("window.CatRenderer&&window.CatRenderer.resume()", null) }; handler.removeCallbacks(tick); handler.postDelayed(tick, 15_000) }
    override fun onPause() { active = false; feedbackGate.pause(); deferredHomeFeedback.clear(); clearWipe(); clearVisualFeedback(); closeHomeDrawer(); homeDialogs.toList().forEach { it.dismiss() }; cancelCare("互动已暂停，没有消耗或奖励。"); cancelMini(); if (lifeDialog != null) closeLife(true); super.onPause() }
    override fun onStop() { super.onStop(); active = false; handler.removeCallbacks(tick); if (::web.isInitialized) { web.evaluateJavascript("window.CatRenderer&&window.CatRenderer.pause()", null); web.onPause() }; if (::ble.isInitialized) ble.disconnect() }
    override fun onDestroy() { deferredHomeFeedback.clear(); homeDialogs.clear(); handler.removeCallbacksAndMessages(null); if (::ble.isInitialized) ble.close(); if (::web.isInitialized) { web.removeJavascriptInterface("CatNative"); web.destroy() }; super.onDestroy() }
    override fun onWindowFocusChanged(hasFocus: Boolean) { super.onWindowFocusChanged(hasFocus); if (hasFocus) handler.post { flushDeferredHomeFeedback() } }

    private fun label(text: String, size: Float, bold: Boolean = false) = TextView(this).apply { this.text = text; textSize = size; setTextColor(ink); if (bold) setTypeface(typeface, Typeface.BOLD) }
    private fun button(text: String, description: String, click: () -> Unit) = Button(this).apply { this.text = text; contentDescription = description; isAllCaps = false; textSize = 13f; setTextColor(ink); minHeight = dp(48); minimumHeight = dp(48); background = android.graphics.drawable.StateListDrawable().apply { addState(intArrayOf(android.R.attr.state_pressed), shape(sand, 14)); addState(intArrayOf(-android.R.attr.state_enabled), shape(Color.rgb(239, 235, 226), 14)); addState(intArrayOf(), shape(Color.rgb(246, 235, 213), 14)) }; setOnClickListener { click() } }
    private fun card() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; background = shape(Color.rgb(255, 253, 247), 24); setPadding(dp(14), dp(14), dp(14), dp(14)); elevation = dp(1).toFloat() }
    private fun shape(color: Int, radius: Int) = GradientDrawable().apply { setColor(color); cornerRadius = dp(radius).toFloat(); setStroke(dp(1), Color.argb(90, 222, 208, 183)) }
    private fun spaced() = LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(14) }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).roundToInt()

    companion object {
        private val FEEDBACK_KINDS = setOf("care", "outdoor", "world_event", "clinic", "milestone", "appearance", "inventory")
        const val REQUEST_BLE = 100; const val REQUEST_EXPORT = 101; const val REQUEST_IMPORT = 102; const val RENDERER_URL = "file:///android_asset/renderer.html"; const val MINI_URL = "file:///android_asset/minigame.html"; const val WORLD_URL = "file:///android_asset/world.html"; const val CLINIC_URL = "file:///android_asset/clinic.html"
    }
}
