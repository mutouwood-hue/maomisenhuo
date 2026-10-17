package com.catforest.app

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.*
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.util.ArrayDeque
import java.util.UUID

/** Foreground BLE only. The user chooses a device and accepts OS pairing themselves. */
@SuppressLint("MissingPermission")
class BadgeBle(private val context: Context, private val listener: Listener) {
    interface Listener {
        fun onStatus(message: String, connected: Boolean)
        fun onDevices(devices: List<Device>)
        fun onReady()
        fun onMessage(message: JSONObject)
    }
    data class Device(val address: String, val name: String, val bonded: Boolean)
    private val handler = Handler(Looper.getMainLooper())
    private val manager = context.getSystemService(BluetoothManager::class.java)
    private val adapter get() = manager?.adapter
    private var active: BluetoothGatt? = null
    private var selected: BluetoothDevice? = null
    private var rx: BluetoothGattCharacteristic? = null
    private var tx: BluetoothGattCharacteristic? = null
    private var ready = false
    private var requested = false
    private var retries = 0
    private var chunkSize = 20
    private val chunks = ArrayDeque<ByteArray>()
    private var writing = false
    private var received = ByteArrayOutputStream()
    private var discardFrame = false
    private val found = linkedMapOf<String, Device>()
    private var scanning = false
    private var generation = 0
    private var operationTimer: Runnable? = null
    private val scanStop = Runnable { stopScan(); status("搜索结束，请选择你的吧唧。") }
    private val bondReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != BluetoothDevice.ACTION_BOND_STATE_CHANGED) return
            val device = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java) else @Suppress("DEPRECATION") intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
            if (device == null || device.address != selected?.address || !requested) return
            when (intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.ERROR)) {
                BluetoothDevice.BOND_BONDED -> { clearTimer(); connectGatt(device) }
                BluetoothDevice.BOND_NONE -> fail("配对未完成。请在系统弹窗输入吧唧屏幕上的配对码后重试。", false)
            }
        }
    }

    init {
        if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(bondReceiver, IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED), Context.RECEIVER_EXPORTED)
        else @Suppress("DEPRECATION") context.registerReceiver(bondReceiver, IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED))
    }

    fun hasPermissions(): Boolean = Build.VERSION.SDK_INT < 31 || listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT).all { context.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }
    fun isConnected(): Boolean = ready
    fun lastAddress(): String? = context.getSharedPreferences("badge", Context.MODE_PRIVATE).getString("address", null)

    /** No system location permission on Android 8–11: only paired list/manual address there. */
    fun scan() {
        if (!available()) return
        stopScan()
        found.clear()
        try {
            adapter?.bondedDevices?.forEach { record(it) }
            listener.onDevices(found.values.toList())
            if (Build.VERSION.SDK_INT < 31) {
                status("Android 8–11 仅列出已配对设备；可在系统蓝牙配对后返回，或输入设备地址。本应用不申请定位。")
                return
            }
            val scanner = adapter?.bluetoothLeScanner ?: return status("蓝牙搜索不可用，请检查系统蓝牙设置。")
            scanning = true
            scanner.startScan(listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(SERVICE)).build()), ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), scanCallback)
            status("正在搜索附近的猫咪吧唧…")
            handler.postDelayed(scanStop, 8_000)
        } catch (e: Exception) { scanning = false; status("无法搜索：${e.message ?: "请检查蓝牙权限"}") }
    }

    fun connect(address: String) {
        if (!available()) return
        if (!BluetoothAdapter.checkBluetoothAddress(address)) return status("蓝牙地址格式无效。")
        stopScan()
        disconnect(false)
        requested = true
        retries = 0
        try {
            val device = adapter!!.getRemoteDevice(address)
            selected = device
            if (device.bondState != BluetoothDevice.BOND_BONDED) {
                status("等待安全配对，请在系统弹窗输入吧唧显示的配对码。")
                if (!device.createBond()) return fail("无法开始配对，请检查吧唧是否处于可配对状态。", false)
                setTimer(60_000) { fail("配对超时，请重试。", false) }
            } else connectGatt(device)
        } catch (e: Exception) { fail("连接失败：${e.message}", false) }
    }

    fun reconnect() { lastAddress()?.let(::connect) ?: status("请先选择并连接一块吧唧。") }

    fun disconnect(show: Boolean = true) {
        requested = false
        generation++
        stopScan()
        clearTimer()
        closeGatt()
        if (show) status("吧唧已断开，本地照料继续保存。")
    }

    fun close() {
        disconnect(false)
        runCatching { context.unregisterReceiver(bondReceiver) }
        handler.removeCallbacksAndMessages(null)
    }

    fun send(message: JSONObject): Boolean {
        if (!ready || active == null || rx == null) return false
        val bytes = (message.toString() + "\n").toByteArray(Charsets.UTF_8)
        if (bytes.size > MAX_FRAME) { status("同步消息过大，已停止发送。"); return false }
        if (chunks.size + (bytes.size + chunkSize - 1) / chunkSize > 300) { fail("同步队列已满，请重新连接。", true); return false }
        var start = 0
        while (start < bytes.size) { chunks.addLast(bytes.copyOfRange(start, minOf(start + chunkSize, bytes.size))); start += chunkSize }
        if (!writing) writeNext()
        return true
    }

    private fun available(): Boolean {
        if (!hasPermissions()) { status("请先通过「蓝牙权限」按钮授权，再选择连接设备。"); return false }
        if (adapter == null) { status("这台设备不支持蓝牙。"); return false }
        return try { if (adapter?.isEnabled != true) { status("请在系统设置打开蓝牙，再返回连接。"); false } else true } catch (_: SecurityException) { status("蓝牙权限尚未授予。"); false }
    }

    private fun connectGatt(device: BluetoothDevice) {
        if (!requested) return
        closeGatt()
        status("正在连接安全吧唧…")
        try {
            active = device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
            setTimer(20_000) { fail("连接超时，检查设备距离和电量。", true) }
        } catch (e: Exception) { fail("连接失败：${e.message}", true) }
    }

    private fun configureNotifications(gatt: BluetoothGatt) {
        val characteristic = tx ?: return fail("设备没有事件通道。", false)
        val cccd = characteristic.getDescriptor(CCCD) ?: return fail("事件通道没有通知描述符。", false)
        if (!gatt.setCharacteristicNotification(characteristic, true)) return fail("无法启用事件接收。", true)
        val result = if (Build.VERSION.SDK_INT >= 33) gatt.writeDescriptor(cccd, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) == BluetoothStatusCodes.SUCCESS else {
            @Suppress("DEPRECATION") cccd.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            @Suppress("DEPRECATION") gatt.writeDescriptor(cccd)
        }
        if (!result) fail("无法订阅吧唧事件。", true)
        else setTimer(10_000) { fail("事件订阅超时。", true) }
    }

    private val callback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, result: Int, newState: Int) = main(gatt) {
            if (result != BluetoothGatt.GATT_SUCCESS || newState == BluetoothProfile.STATE_DISCONNECTED) { fail("吧唧连接已断开（$result）。", true); return@main }
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                clearTimer()
                if (selected?.bondState != BluetoothDevice.BOND_BONDED) { fail("连接未完成安全配对。", false); return@main }
                status("已配对，正在发现服务…")
                if (!gatt.discoverServices()) fail("无法发现设备服务。", true)
                else setTimer(15_000) { fail("服务发现超时。", true) }
            }
        }
        override fun onServicesDiscovered(gatt: BluetoothGatt, result: Int) = main(gatt) {
            if (result != BluetoothGatt.GATT_SUCCESS) { fail("服务发现失败（$result）。", true); return@main }
            clearTimer()
            val service = gatt.getService(SERVICE)
            rx = service?.getCharacteristic(RX)
            tx = service?.getCharacteristic(TX)
            if (rx == null || tx == null || rx!!.properties and BluetoothGattCharacteristic.PROPERTY_WRITE == 0 || tx!!.properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY == 0) {
                fail("这块设备不提供猫咪森活 v1 同步服务，请检查固件版本。", false); return@main
            }
            if (gatt.requestMtu(185)) setTimer(10_000) { fail("协商蓝牙数据长度超时。", true) } else configureNotifications(gatt)
        }
        override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, result: Int) = main(gatt) {
            chunkSize = if (result == BluetoothGatt.GATT_SUCCESS) (mtu - 3).coerceIn(20, 512) else 20
            if (ready) return@main
            clearTimer()
            configureNotifications(gatt)
        }
        override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, result: Int) = main(gatt) {
            if (descriptor.uuid != CCCD) return@main
            clearTimer()
            if (result != BluetoothGatt.GATT_SUCCESS) { fail("事件订阅失败（$result）。", true); return@main }
            ready = true; retries = 0
            context.getSharedPreferences("badge", Context.MODE_PRIVATE).edit().putString("address", selected?.address).apply()
            status("吧唧已连接，正在同步小猫…")
            listener.onReady()
        }
        @Deprecated("Pre Android 13 callback")
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            if (Build.VERSION.SDK_INT < 33 && characteristic.uuid == TX) { @Suppress("DEPRECATION") val value = characteristic.value?.clone() ?: return; main(gatt) { receive(value) } }
        }
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
            if (characteristic.uuid == TX) main(gatt) { receive(value) }
        }
        override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, result: Int) = main(gatt) {
            if (characteristic.uuid != RX) return@main
            clearTimer()
            if (result != BluetoothGatt.GATT_SUCCESS) { fail("同步写入失败（$result），请重新连接。", true); return@main }
            if (chunks.isNotEmpty()) chunks.removeFirst()
            writing = false
            writeNext()
        }
    }

    private fun writeNext() {
        if (chunks.isEmpty() || !ready) { writing = false; return }
        val gatt = active ?: return
        val characteristic = rx ?: return
        val bytes = chunks.peekFirst() ?: run { writing = false; return }
        writing = true
        val result = try {
            if (Build.VERSION.SDK_INT >= 33) gatt.writeCharacteristic(characteristic, bytes, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS
            else { @Suppress("DEPRECATION") characteristic.value = bytes; characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT; @Suppress("DEPRECATION") gatt.writeCharacteristic(characteristic) }
        } catch (_: Exception) { false }
        if (!result) fail("同步写入无法开始，请重新连接。", true)
        else setTimer(10_000) { fail("同步写入超时，请重新连接。", true) }
    }

    private fun receive(bytes: ByteArray) {
        for (value in bytes) {
            if (value.toInt() == 10) {
                if (!discardFrame && received.size() > 0) try {
                    val decoder = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
                    val frame = decoder.decode(ByteBuffer.wrap(received.toByteArray())).toString()
                    val message = JSONObject(frame)
                    require(message.get("protocolVersion") is Number && (message.get("protocolVersion") as Number).toDouble() == 1.0)
                    require(message.get("kind") in setOf("event", "status"))
                    if (message.getString("kind") == "status") {
                        val revision = message.get("revision")
                        require(revision is Number && revision.toDouble().isFinite() && revision.toDouble() % 1.0 == 0.0 && revision.toDouble() in 0.0..9_007_199_254_740_990.0)
                        require(message.get("petId") is String && message.getString("petId").codePointCount(0, message.getString("petId").length) in 1..64)
                        require(message.get("status") in setOf("synced", "stale", "revision_conflict", "pet_mismatch", "error"))
                    }
                    listener.onMessage(message)
                } catch (_: Exception) { status("收到无法识别的吧唧消息，当前存档未改变。") }
                received = ByteArrayOutputStream(); discardFrame = false
            } else if (!discardFrame) {
                if (received.size() >= MAX_FRAME - 1) { received.reset(); discardFrame = true; status("吧唧消息超过长度限制。") }
                else received.write(value.toInt())
            }
        }
    }

    private fun fail(message: String, retry: Boolean) {
        clearTimer()
        closeGatt()
        status(message)
        val device = selected
        if (retry && requested && device != null && retries < 3 && hasPermissions()) {
            retries++
            val token = generation
            status("$message 正在重连（$retries/3）…")
            handler.postDelayed({ if (token == generation && requested) connectGatt(device) }, (2000L * retries))
        } else if (retry && requested) status("$message 自动重连已停止，可点击「重连」。")
    }

    private fun closeGatt() {
        ready = false; writing = false; rx = null; tx = null; chunkSize = 20
        chunks.clear(); received.reset(); discardFrame = false
        val old = active; active = null
        if (old != null) { runCatching { old.disconnect() }; runCatching { old.close() } }
    }
    private fun status(message: String) = listener.onStatus(message, ready)
    private fun main(gatt: BluetoothGatt, block: () -> Unit) { handler.post { if (gatt === active) block() } }
    private fun setTimer(delay: Long, action: () -> Unit) { clearTimer(); operationTimer = Runnable(action).also { handler.postDelayed(it, delay) } }
    private fun clearTimer() { operationTimer?.let(handler::removeCallbacks); operationTimer = null }
    private fun record(device: BluetoothDevice) { found[device.address] = Device(device.address, device.name ?: "猫咪吧唧", device.bondState == BluetoothDevice.BOND_BONDED) }
    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) { handler.post { if (scanning) { record(result.device); listener.onDevices(found.values.toList()) } } }
        override fun onScanFailed(errorCode: Int) { handler.post { scanning = false; handler.removeCallbacks(scanStop); status("蓝牙搜索失败（$errorCode），请重试。") } }
    }
    fun stopScan() {
        handler.removeCallbacks(scanStop)
        if (scanning) runCatching { adapter?.bluetoothLeScanner?.stopScan(scanCallback) }
        scanning = false
    }

    companion object {
        val SERVICE: UUID = UUID.fromString("7b2e1000-6a6d-4d8f-9c45-4f4d43415431")
        val RX: UUID = UUID.fromString("7b2e1001-6a6d-4d8f-9c45-4f4d43415431")
        val TX: UUID = UUID.fromString("7b2e1002-6a6d-4d8f-9c45-4f4d43415431")
        val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        const val MAX_FRAME = 2048
    }
}
