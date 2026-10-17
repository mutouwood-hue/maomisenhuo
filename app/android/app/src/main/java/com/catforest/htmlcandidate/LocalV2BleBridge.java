package com.catforest.htmlcandidate;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.BluetoothStatusCodes;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.webkit.WebView;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.charset.CodingErrorAction;
import java.util.ArrayDeque;
import android.app.NotificationManager;
import android.app.NotificationChannel;

/** Foreground-only local-v2 NDJSON transport over a main-frame-only WebMessagePort. */
@SuppressLint("MissingPermission") // Every operation/callback rechecks the actual Android grant.
public final class LocalV2BleBridge {
    public static final int PERMISSION_REQUEST_CODE = 0xB18;
    private static final UUID SERVICE = UUID.fromString("6f3d2000-8f4d-4b73-9ce5-43464c4f4332");
    private static final UUID RX = UUID.fromString("6f3d2001-8f4d-4b73-9ce5-43464c4f4332");
    private static final UUID TX = UUID.fromString("6f3d2002-8f4d-4b73-9ce5-43464c4f4332");
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private final Activity activity;
    private final WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final AtomicInteger queuedMessages = new AtomicInteger();
    private final Map<String, Request> pending = new LinkedHashMap<>();
    private final Set<String> usedIds = new LinkedHashSet<>();
    private final Map<String, Found> found = new LinkedHashMap<>();
    private BluetoothAdapter adapter;
    private ScanSession scan;
    private Connection connection;
    private Request permissionRequest;
    private boolean systemPermissionPromptPending;
    private Runnable permissionTimeout;
    private boolean foreground;
    private boolean activityForeground;
    private String selectedMode = "off";
    private final ModeRouter modeRouter;
    private boolean initialized;
    private boolean receiverRegistered;
    private volatile boolean disposed;
    private long generation;
    private volatile long documentEpoch;
    private String documentUrl;
    private WebMessagePort nativePort;
    private WebMessagePort transferPort;
    private static final String LOCAL_ORIGIN = "https://appassets.androidplatform.net";
    private static final int BACKGROUND_PERMISSION_CODE = 0xB19;
    private static final int MAX_BUFFER_BYTES = 65536;
    private static final int MAX_BUFFER_EVENTS = 256;
    private static final int CONTEXT_WRITE_TIMEOUT_MS = 10000;
    private static final long LOCATION_FRESHNESS_MS = 120000L;
    private static final int FLIGHT_TIMEOUT_MS = 35000;
    private static final String CONTEXT_PREFIX = "badge-context-";
    private static final String NATIVE_LOCK_PREFIX = "native-lock-";
    private static final long MAX_SAFE_INTEGER = 9007199254740991L;
    private static final int GATT_FRAGMENT_BYTES = 20;
    private static final int MILLIS_PER_MINUTE = 60000;
    private static final long NANOS_PER_MILLISECOND = 1000000L;
    private final ArrayDeque<JSONObject> backgroundEvents = new ArrayDeque<>();
    private int backgroundBytes;
    private boolean backgroundEnabled;
    private String retainedDeviceId = "", retentionReason = "";
    private Request retentionRequest, backgroundPermissionRequest;
    private Runnable contextWriteTimeout, contextRequestTimeout, incomingTimeout, flightTimeout, waitingFlightTimeout, notificationTimeout, retentionTimeout;
    private boolean processingIncoming;
    private String jsFlightId, releasedFlightId;
    private String verifiedDeviceId = "", verifiedClientId = "";
    private boolean hostReplyEnabled;
    private JSONObject pendingContextRequest;
    private long lastContextGeneration = -1, lastContextCounter;
    private byte[] contextReplyLine;
    private int contextReplyOffset;
    private boolean contextReplyWrite;
    private String repliedFlightId, jsFlightOp, jsFlightClientId;
    private boolean jsFlightMobileContext;
    private final ByteArrayOutputStream outgoingLine = new ByteArrayOutputStream();
    private final ByteArrayOutputStream incomingLine = new ByteArrayOutputStream();
    private final BleRetentionService.Listener serviceListener = new BleRetentionService.Listener() {
        @Override public void onServiceReady() {
            runOnUi(() -> {
                if (disposed || connection == null || !connection.ready || !backgroundEnabled || !notificationAllowed()) {
                    stopRetention("原连接或通知权限已变化，请手动恢复"); return;
                }
                if (retentionTimeout != null) ui.removeCallbacks(retentionTimeout);
                retentionTimeout = null;
                Request request = retentionRequest; retentionRequest = null;
                if (request != null) success(request, connectionState());
                emitLifecycle();
            });
        }
        @Override public void onServiceStopped(String reason) { runOnUi(() -> stopRetention(reason)); }
    };

    private static final class Request {
        final String id;
        final long epoch;
        Request(String id, long epoch) { this.id = id; this.epoch = epoch; }
    }
    private static final class Found {
        final BluetoothDevice device;
        final JSONObject record;
        Found(BluetoothDevice device, JSONObject record) { this.device = device; this.record = record; }
    }
    private static final class ScanSession {
        final Request request;
        final long generation;
        BluetoothLeScanner scanner;
        ScanCallback callback;
        Runnable timeout;
        ScanSession(Request request, long generation) { this.request = request; this.generation = generation; }
    }
    private static final class Write {
        final Request request;
        final byte[] value;
        final int nextLineBytes;
        Write(Request request, byte[] value, int nextLineBytes) { this.request = request; this.value = value; this.nextLineBytes = nextLineBytes; }
    }
    private static final class Connection {
        final long generation;
        final long epoch;
        final String address;
        Request request;
        BluetoothGatt gatt;
        BluetoothGattCharacteristic rx;
        BluetoothGattCharacteristic tx;
        BluetoothGattDescriptor cccd;
        Write write;
        String stage = "connecting";
        Runnable setupTimeout;
        Runnable operationTimeout;
        boolean ready;
        int lineBytes;
        Connection(long generation, long epoch, String address, Request request) {
            this.generation = generation; this.epoch = epoch; this.address = address; this.request = request;
        }
    }

    /** Owner callback runs on UI thread. Must synchronously stop the other transport first. */
    public interface ModeRouter { void selectMode(String mode) throws Exception; }

    public LocalV2BleBridge(Activity activity, WebView web) { this(activity, web, null); }

    public LocalV2BleBridge(Activity activity, WebView web, ModeRouter modeRouter) {
        this.activity = activity;
        this.web = web;
        this.modeRouter = modeRouter;
        // Creation has no permissions, receiver, scanning, connection or radio side effects.
    }

    /** Call from the owner's main-frame onPageFinished. Never add this class as a JavascriptInterface. */
    public void attachPort(String finishedUrl) {
        runOnUi(() -> {
            if (disposed || nativePort != null || !trustedPage() || finishedUrl == null || !finishedUrl.equals(web.getUrl())) return;
            final long epoch = documentEpoch;
            final String token = "cat-local-v2-port:" + UUID.randomUUID();
            WebMessagePort[] channel;
            try { channel = web.createWebMessageChannel(); } catch (RuntimeException error) { return; }
            final WebMessagePort port = channel[0];
            nativePort = port; transferPort = channel[1];
            port.setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
                @Override public void onMessage(WebMessagePort source, WebMessage message) {
                    if (disposed || source != nativePort || epoch != documentEpoch || !trustedPage() || message == null) return;
                    if (message.getPorts() != null && message.getPorts().length != 0) return;
                    postMessage(message.getData());
                }
            }, ui);
            // Port transfer is addressed by Android to the precise origin's main frame only.
            // A cross-origin iframe receives neither a Java interface nor this private port.
            String bootstrap = "(function(){if(window!==window.top)return false;var token=" + JSONObject.quote(token) + ";"
                + "function bind(e){if(e.data!==token||!e.ports||e.ports.length!==1)return;window.removeEventListener('message',bind);var p=e.ports[0];"
                + "p.onmessage=function(m){try{var a=window.CatLocalV2Adapter;if(a&&typeof a.receive==='function')a.receive(JSON.parse(m.data));}catch(ignore){}};p.start();"
                + "Object.defineProperty(window,'CatLocalV2Native',{configurable:true,value:Object.freeze({postMessage:function(s){if(typeof s!=='string')throw new TypeError('JSON string required');p.postMessage(s);}})});"
                + "window.dispatchEvent(new Event('cat-local-v2-native-ready'));}window.addEventListener('message',bind);return true;})()";
            web.evaluateJavascript(bootstrap, result -> {
                if (disposed || nativePort != port || epoch != documentEpoch || !trustedPage()) return;
                if (!"true".equals(result)) { invalidateDocument(); return; }
                try { web.postWebMessage(new WebMessage(token, new WebMessagePort[]{transferPort}), Uri.parse(LOCAL_ORIGIN)); }
                catch (RuntimeException error) { invalidateDocument(); }
            });
        });
    }

    private void postMessage(String json) {
        if (json == null || json.length() > 4096) return;
        if (queuedMessages.incrementAndGet() > 64) { queuedMessages.decrementAndGet(); return; }
        final long queuedEpoch = documentEpoch;
        ui.post(() -> { queuedMessages.decrementAndGet(); if (queuedEpoch == documentEpoch) handle(json); });
    }

    private void handle(String json) {
        if (!trustedPage()) { invalidateDocument(); return; }
        Request request = null;
        try {
            JSONObject input = StrictNdjson.object(json);
            Object rawId = input.get("requestId");
            if (!(rawId instanceof String)) return;
            String id = (String) rawId;
            if (id.isEmpty() || id.length() > 128 || id.codePoints().anyMatch(Character::isISOControl)) return;
            // requestId is unique within a document. Never settle an earlier Promise twice.
            if (usedIds.contains(id) || pending.containsKey(id)) return;
            request = new Request(id, documentEpoch);
            if (pending.size() >= 32) { sendUntrackedError(request, "BUSY", "Too many pending bridge requests"); return; }
            pending.put(id, request);
            keys(input, "requestId", "method", "args");
            Object rawMethod = input.get("method");
            if (!(rawMethod instanceof String)) throw new IllegalArgumentException("method must be a string");
            JSONObject args = input.has("args") ? input.getJSONObject("args") : new JSONObject();
            String method = (String) rawMethod;
            if (disposed) {
                if (method.equals("dispose")) success(request, object());
                else failure(request, "NOT_READY", "BLE bridge is disposed", "no_change");
                return;
            }
            if (method.equals("initialize")) {
                empty(args);
                if (!initialized) {
                    documentUrl = web.getUrl();
                    BluetoothManager manager = (BluetoothManager) activity.getSystemService(Context.BLUETOOTH_SERVICE);
                    adapter = manager == null ? null : manager.getAdapter();
                    registerReceiver();
                    initialized = true;
                }
                success(request, availability());
                return;
            }
            if (method.equals("dispose")) {
                empty(args); stopScan("Bridge disposed"); endConnection("Bridge disposed", "NOT_READY");
                cancelPermission("Bridge disposed"); success(request, object());
                // Transport is already stopped. Allow the queued port result to be delivered,
                // then close the channel; all new work is immediately disabled.
                disposed = true; initialized = false; foreground = false; pending.clear(); unregisterReceiver();
                ui.postDelayed(() -> { ++documentEpoch; closePorts(); usedIds.clear(); }, 250); return;
            }
            if (method.equals("disconnect")) {
                empty(args); stopScan("Manual disconnect"); endConnection("Manual disconnect", "NOT_READY");
                found.clear(); success(request, object("generation", generation)); return;
            }
            if (method.equals("getConnectionState")) { empty(args); success(request, connectionState()); return; }
            if (method.equals("requestBackgroundPermissions")) { requestBackgroundPermissions(request, args); return; }
            if (method.equals("setBackgroundRetention")) { setBackgroundRetention(request, args); return; }
            if (method.equals("beginFlight")) { beginFlight(request, args); return; }
            if (method.equals("endFlight")) { endFlight(request, args); return; }
            if (method.equals("stopScan")) { empty(args); stopScan(null); success(request, scanResult()); return; }
            if (!initialized) { failure(request, "NOT_READY", "Call initialize first", "no_change"); return; }
            switch (method) {
                case "selectTransport": selectTransport(request, args); break;
                case "requestPermissions": empty(args); requestPermissions(request); break;
                case "scan": beginScan(request, args); break;
                case "connect": connect(request, args); break;
                case "write": write(request, args); break;
                default: failure(request, "UNSUPPORTED_PROTOCOL", "Unknown bridge method", "no_change");
            }
        } catch (SecurityException error) {
            if (request != null) failure(request, "PERMISSION_REQUIRED", "Android BLE permission is unavailable", "no_change");
        } catch (JSONException | IllegalArgumentException error) {
            if (request != null) failure(request, "BAD_REQUEST", "Malformed bridge request: " + error.getMessage(), "no_change");
        } catch (RuntimeException error) {
            if (request != null) failure(request, "NOT_READY", "Native BLE operation could not start", "no_change");
        }
    }

    private Request waitingFlightRequest;
    private String waitingFlightId;

    private boolean notificationAllowed() {
        NotificationManager manager = activity.getSystemService(NotificationManager.class);
        if (manager == null || !manager.areNotificationsEnabled() ||
            (Build.VERSION.SDK_INT >= 33 && !has(Manifest.permission.POST_NOTIFICATIONS))) return false;
        NotificationChannel channel = manager.getNotificationChannel(BleRetentionService.CHANNEL);
        return channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }
    private JSONObject connectionState() {
        Connection context = connection;
        return object("foreground", foreground, "activityForeground", activityForeground,
            "backgroundEnabled", backgroundEnabled, "serviceRunning", BleRetentionService.isRunning(serviceListener),
            "retained", !activityForeground && transportAlive(), "connected", context != null && context.ready,
            "evidence", context == null ? JSONObject.NULL : evidence(context), "deviceId", verifiedDeviceId,
            "reason", retentionReason, "heartbeatInFlight", false, "contextReplyInFlight", contextReplyLine != null);
    }
    private void emitLifecycle() { JSONObject event = connectionState(); put(event, "type", "lifecycle"); emit(event, documentEpoch); }
    private void requestBackgroundPermissions(Request request, JSONObject args) {
        keys(args, "origin");
        if (!"explicit_user_action".equals(args.optString("origin")) || !activityForeground) {
            failure(request, "NOT_READY", "通知权限必须由前台用户主动请求", "no_change"); return;
        }
        if (notificationAllowed()) { success(request, connectionState()); return; }
        if (Build.VERSION.SDK_INT < 33 || has(Manifest.permission.POST_NOTIFICATIONS)) {
            failure(request, "PERMISSION_REQUIRED", "请在系统设置开启应用及锁屏蓝牙通知后重试", "no_change"); return;
        }
        if (backgroundPermissionRequest != null) { failure(request, "BUSY", "通知权限请求正在进行", "no_change"); return; }
        backgroundPermissionRequest = request;
        notificationTimeout = () -> {
            if (backgroundPermissionRequest != request) return;
            backgroundPermissionRequest = null; notificationTimeout = null;
            failure(request, "PERMISSION_REQUIRED", "通知授权等待已结束，请显式重试", "no_change");
            if (!activityForeground && !backgroundEnabled) endConnection("通知授权等待结束", "NOT_READY");
        };
        ui.postDelayed(notificationTimeout, FLIGHT_TIMEOUT_MS);
        try { activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, BACKGROUND_PERMISSION_CODE); }
        catch (RuntimeException failure) {
            backgroundPermissionRequest = null; failure(request, "PERMISSION_REQUIRED", "系统未能打开通知权限请求", "no_change");
        }
    }
    private void setBackgroundRetention(Request request, JSONObject args) throws JSONException {
        keys(args, "enabled", "generation", "address", "deviceId", "origin");
        Object enabled = args.get("enabled");
        if (!(enabled instanceof Boolean) || !"explicit_user_action".equals(args.optString("origin")) || !activityForeground) {
            failure(request, "BAD_REQUEST", "锁屏保持只能由前台用户主动开启或关闭", "no_change"); return;
        }
        if (!((Boolean) enabled)) { stopRetention("user_stopped"); success(request, connectionState()); return; }
        Connection context = connection;
        if (!foreground || !granted() || !Boolean.TRUE.equals(enabled()) || context == null || !context.ready ||
            integer(args, "generation", 0, 9007199254740991L) != context.generation ||
            !context.address.equals(args.getString("address")) || verifiedDeviceId.isEmpty() ||
            !verifiedDeviceId.equals(args.getString("deviceId"))) {
            failure(request, "NOT_READY", "必须先验证原设备的hello身份与当前连接", "no_change"); return;
        }
        if (!notificationAllowed()) { failure(request, "PERMISSION_REQUIRED", "必须允许常驻通知后才能保持连接", "no_change"); return; }
        if (retentionRequest != null) { failure(request, "BUSY", "服务正在启动", "no_change"); return; }
        backgroundEnabled = true; retainedDeviceId = verifiedDeviceId; retentionReason = "";
        if (BleRetentionService.isRunning(serviceListener)) { success(request, connectionState()); return; }
        retentionRequest = request;
        retentionTimeout = () -> { if (retentionRequest == request && connection == context) stopRetention("蓝牙常驻服务启动超时"); };
        ui.postDelayed(retentionTimeout, CONTEXT_WRITE_TIMEOUT_MS);
        BleRetentionService.start(activity, serviceListener);
    }
    private void stopRetention(String reason) {
        backgroundEnabled = false; retainedDeviceId = ""; retentionReason = reason;
        BleRetentionService.stop(serviceListener);
        Request request = retentionRequest; retentionRequest = null;
        if (request != null) failure(request, "NOT_READY", reason, "no_change");
        endConnection(reason, "NOT_READY"); emitLifecycle();
    }
    private boolean transportAlive() {
        return foreground || (!activityForeground && backgroundPermissionRequest != null && connection != null && connection.ready) ||
            (!activityForeground && backgroundEnabled && connection != null && connection.ready &&
            BleRetentionService.isRunning(serviceListener) && notificationAllowed() &&
            !verifiedDeviceId.isEmpty() && verifiedDeviceId.equals(retainedDeviceId));
    }
    private void beginFlight(Request request, JSONObject args) throws JSONException {
        keys(args, "generation", "id");
        String id = args.getString("id");
        if (!id.matches("[A-Za-z0-9_-]{1,64}") || id.startsWith(CONTEXT_PREFIX) || id.startsWith(NATIVE_LOCK_PREFIX)) throw new IllegalArgumentException("Invalid wire id");
        Connection context = connection;
        if (!gate(request, false)) return;
        if (context == null || !context.ready || integer(args, "generation", 0, 9007199254740991L) != context.generation) {
            failure(request, "STALE_GENERATION", "Flight belongs to another connection", "no_change"); return;
        }
        if (id.equals(releasedFlightId)) { failure(request, "BUSY", "The observed flight id is awaiting release", "no_change"); return; }
        if (jsFlightId != null || waitingFlightRequest != null || context.write != null || context.lineBytes != 0) {
            failure(request, "BUSY", "Only one complete NDJSON flight may be active", "no_change"); return;
        }
        if (contextReplyLine != null || pendingContextRequest != null || incomingLine.size() != 0) {
            waitingFlightRequest = request; waitingFlightId = id;
            waitingFlightTimeout = () -> {
                if (waitingFlightRequest != request || connection != context) return;
                waitingFlightRequest = null; waitingFlightId = null; waitingFlightTimeout = null;
                failure(request, "BUSY", "设备情境通道未及时释放，请稍后恢复", "no_change");
            };
            ui.postDelayed(waitingFlightTimeout, CONTEXT_WRITE_TIMEOUT_MS);
            drainContextReply(context); return;
        }
        acquireFlight(id); success(request, object("generation", context.generation));
    }
    private void acquireFlight(String id) {
        jsFlightId = id; jsFlightOp = null; jsFlightClientId = null;
        jsFlightMobileContext = false; repliedFlightId = null; outgoingLine.reset();
        if (flightTimeout != null) ui.removeCallbacks(flightTimeout);
        final Connection context = connection;
        flightTimeout = () -> {
            if (connection == context && id.equals(jsFlightId))
                endConnection("原flight未完成，请恢复原设备", "ACK_TIMEOUT_OUTCOME_UNKNOWN");
        };
        ui.postDelayed(flightTimeout, FLIGHT_TIMEOUT_MS);
    }
    private void endFlight(Request request, JSONObject args) throws JSONException {
        keys(args, "generation", "id");
        Connection context = connection;
        if (context == null || integer(args, "generation", 0, 9007199254740991L) != context.generation) {
            failure(request, "STALE_GENERATION", "Flight connection ended", "no_change"); return;
        }
        String id = args.getString("id");
        if (id.equals(releasedFlightId)) { releasedFlightId = null; success(request, object("generation", context.generation)); return; }
        if (jsFlightId == null) {
            failure(request, "BUSY", "No matching flight to release", "no_change");
            return;
        }
        if (!jsFlightId.equals(id)) { failure(request, "BUSY", "Flight owner mismatch", "no_change"); return; }
        if (context.write != null || context.lineBytes != 0 || outgoingLine.size() != 0 || !id.equals(repliedFlightId)) { endConnection("Partial or unacknowledged flight cannot be released", "ACK_TIMEOUT_OUTCOME_UNKNOWN"); failure(request, "NOT_READY", "NDJSON flight closed safely", "unknown"); return; }
        jsFlightId = null; jsFlightOp = null; jsFlightClientId = null; jsFlightMobileContext = false;
        repliedFlightId = null; releasedFlightId = null; outgoingLine.reset();
        if (flightTimeout != null) ui.removeCallbacks(flightTimeout); flightTimeout = null;
        success(request, object("generation", context.generation));
        drainContextReply(context);
    }
    /** 仅响应已确认owner的设备请求；不启用定位采集或周期保活。 */
    private void acceptContextRequest(Connection context, JSONObject request) throws JSONException {
        keys(request, "v", "id", "op", "request", "data");
        if (!hostReplyEnabled || verifiedDeviceId.isEmpty() || verifiedClientId.isEmpty() || !transportAlive() ||
            integer(request, "v", 2, 2) != 2 || !"host_context".equals(request.getString("op")) ||
            !Boolean.TRUE.equals(request.get("request"))) throw new IllegalArgumentException("Unconfirmed host context request");
        JSONObject data = request.getJSONObject("data"); keys(data, "time", "location");
        if (!Boolean.TRUE.equals(data.get("time")) || !Boolean.TRUE.equals(data.get("location"))) throw new IllegalArgumentException("Invalid context fields");
        String id = request.getString("id");
        if (!id.matches("badge-context-[0-9]{1,16}-[0-9]{1,16}") || id.length() > 64) throw new IllegalArgumentException("Invalid context id");
        String[] parts = id.substring(CONTEXT_PREFIX.length()).split("-");
        long sourceGeneration = Long.parseLong(parts[0]), counter = Long.parseLong(parts[1]);
        if (sourceGeneration < 1 || sourceGeneration > MAX_SAFE_INTEGER || counter < 1 || counter > MAX_SAFE_INTEGER ||
            (lastContextGeneration >= 0 && sourceGeneration != lastContextGeneration) || counter <= lastContextCounter)
            throw new IllegalArgumentException("Stale context request");
        if (pendingContextRequest != null || contextReplyLine != null) throw new IllegalArgumentException("Context request limit exceeded");
        lastContextGeneration = sourceGeneration; lastContextCounter = counter;
        pendingContextRequest = request;
        contextRequestTimeout = () -> {
            if (connection != context || pendingContextRequest != request) return;
            pendingContextRequest = null; contextRequestTimeout = null;
            drainContextReply(context); releaseWaitingFlight(context);
        };
        ui.postDelayed(contextRequestTimeout, FLIGHT_TIMEOUT_MS);
        drainContextReply(context);
    }
    private void drainContextReply(Connection context) {
        if (connection != context || !transportAlive() || !granted() || !Boolean.TRUE.equals(enabled()) || processingIncoming ||
            context.write != null || context.lineBytes != 0 || incomingLine.size() != 0 || jsFlightId != null) return;
        if (contextReplyLine == null && pendingContextRequest != null) {
            JSONObject request = pendingContextRequest; pendingContextRequest = null;
            if (contextRequestTimeout != null) ui.removeCallbacks(contextRequestTimeout);
            contextRequestTimeout = null;
            long now = System.currentTimeMillis();
            JSONObject data = object("epochMs", now, "utcOffsetMinutes", java.util.TimeZone.getDefault().getOffset(now) / 60000,
                "foreground", activityForeground, "location", lastAuthorizedLocation(now));
            contextReplyLine = (object("v", 2, "id", request.optString("id"), "op", "host_context", "ok", true, "data", data).toString() + "\n").getBytes(StandardCharsets.UTF_8);
            contextReplyOffset = 0;
            contextWriteTimeout = () -> endConnection("设备情境回复未完成，请回前台恢复原设备", "ACK_TIMEOUT_OUTCOME_UNKNOWN");
            ui.postDelayed(contextWriteTimeout, CONTEXT_WRITE_TIMEOUT_MS);
        }
        writeContextFragment(context);
    }
    private JSONObject lastAuthorizedLocation(long now) {
        boolean authorized = has(Manifest.permission.ACCESS_FINE_LOCATION) || has(Manifest.permission.ACCESS_COARSE_LOCATION);
        if (!authorized) return object("status", "not_authorized");
        if (!activityForeground && (Build.VERSION.SDK_INT >= 29 && !has(Manifest.permission.ACCESS_BACKGROUND_LOCATION)))
            return object("status", "unavailable");
        android.location.LocationManager manager = activity.getSystemService(android.location.LocationManager.class);
        if (manager == null) return object("status", "unavailable");
        android.location.Location newest = null;
        try {
            for (String provider : manager.getProviders(true)) {
                android.location.Location value = manager.getLastKnownLocation(provider);
                if (value != null && (newest == null || value.getTime() > newest.getTime())) newest = value;
            }
        } catch (SecurityException denied) { return object("status", "not_authorized"); }
        catch (RuntimeException unavailable) { return object("status", "unavailable"); }
        if (newest == null || newest.isFromMockProvider() || !newest.hasAccuracy() ||
            !Double.isFinite(newest.getLatitude()) || Math.abs(newest.getLatitude()) > 90 ||
            !Double.isFinite(newest.getLongitude()) || Math.abs(newest.getLongitude()) > 180 ||
            !Float.isFinite(newest.getAccuracy()) || newest.getAccuracy() < 0 || newest.getTime() <= 0 || newest.getTime() > now)
            return object("status", "unavailable");
        long elapsed = android.os.SystemClock.elapsedRealtimeNanos(), captured = newest.getElapsedRealtimeNanos();
        if (captured <= 0 || captured > elapsed) return object("status", "unavailable");
        if (now - newest.getTime() > LOCATION_FRESHNESS_MS || elapsed - captured > LOCATION_FRESHNESS_MS * NANOS_PER_MILLISECOND)
            return object("status", "stale");
        return object("status", "available", "capturedAtMs", newest.getTime(), "accuracyMeters", newest.getAccuracy(),
            "latitude", newest.getLatitude(), "longitude", newest.getLongitude());
    }
    private void writeContextFragment(Connection context) {
        if (connection != context || contextReplyLine == null || contextReplyWrite || context.write != null || jsFlightId != null) return;
        if (contextReplyOffset >= contextReplyLine.length) { completeContextReply(context); return; }
        byte[] value = Arrays.copyOfRange(contextReplyLine, contextReplyOffset, Math.min(contextReplyOffset + 20, contextReplyLine.length));
        contextReplyWrite = true;
        try { if (!startWrite(context, value)) endConnection("系统拒绝设备情境回复", "NOT_READY"); }
        catch (RuntimeException failure) { endConnection("设备情境回复提交失败", "NOT_READY"); }
    }
    private void completeContextReply(Connection context) {
        if (contextReplyLine == null || contextReplyWrite || contextReplyOffset != contextReplyLine.length) return;
        if (contextWriteTimeout != null) ui.removeCallbacks(contextWriteTimeout);
        contextWriteTimeout = null; contextReplyLine = null; contextReplyOffset = 0;
        releaseWaitingFlight(context);
    }
    private void releaseWaitingFlight(Connection context) {
        if (connection != context || processingIncoming || jsFlightId != null || contextReplyLine != null || pendingContextRequest != null || incomingLine.size() != 0 || context.write != null || context.lineBytes != 0) return;
        if (waitingFlightRequest != null) {
            Request waiting = waitingFlightRequest; String id = waitingFlightId;
            waitingFlightRequest = null; waitingFlightId = null;
            if (waitingFlightTimeout != null) ui.removeCallbacks(waitingFlightTimeout);
            waitingFlightTimeout = null;
            if (foreground) { acquireFlight(id); success(waiting, object("generation", context.generation)); }
            else failure(waiting, "NOT_READY", "App paused while waiting for context reply", "no_change");
        }
    }
    private void releaseObservedFlight(Connection context) {
        if (context == null || connection != context || activityForeground || jsFlightId == null || !jsFlightId.equals(repliedFlightId) || context.lineBytes != 0 || context.write != null) return;
        releasedFlightId = jsFlightId;
        jsFlightId = null; jsFlightOp = null; jsFlightClientId = null; jsFlightMobileContext = false;
        repliedFlightId = null; outgoingLine.reset();
        if (flightTimeout != null) ui.removeCallbacks(flightTimeout); flightTimeout = null;
        drainContextReply(context);
    }
    private void emitFrame(Connection context, byte[] line) {
        for (int offset = 0; offset < line.length; offset += 512) {
            byte[] fragment = Arrays.copyOfRange(line, offset, Math.min(offset + 512, line.length));
            emit(object("type", "frame", "generation", context.generation, "value", Base64.encodeToString(fragment, Base64.NO_WRAP)), context.epoch);
            if (connection != context) return;
        }
    }
    /** 先按完整UTF-8行分类；原JS回执只缓存，Native不结算、不ACK、不写journal。 */
    private void acceptIncoming(Connection context, byte[] value) {
        processingIncoming = true;
        try {
        for (byte octet : value) {
            incomingLine.write(octet);
            if (incomingLine.size() > 2048) { endConnection("设备返回行超过协议上限", "MALFORMED_FRAME"); return; }
            if (octet != 10) continue;
            byte[] line = incomingLine.toByteArray(); incomingLine.reset();
            try {
                String decoded = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(line)).toString();
                JSONObject reply = StrictNdjson.object(decoded);
                if ("host_context".equals(reply.optString("op")) && reply.has("request")) {
                    acceptContextRequest(context, reply); continue;
                }
                keys(reply, "v", "id", "op", "ok", "data", "error");
                if (integer(reply, "v", 2, 2) != 2 || !(reply.get("id") instanceof String) || !(reply.get("op") instanceof String) || !(reply.get("ok") instanceof Boolean)) throw new IllegalArgumentException("Invalid protocol envelope");
                String id = reply.getString("id"), op = reply.getString("op");
                if (reply.getBoolean("ok") ? !(reply.opt("data") instanceof JSONObject) || reply.has("error") : !(reply.opt("error") instanceof JSONObject) || reply.has("data")) throw new IllegalArgumentException("Invalid protocol result");
                if (id.equals(jsFlightId) && !op.equals(jsFlightOp)) throw new IllegalArgumentException("Flight response operation mismatch");
                if (id.equals(jsFlightId) && reply.optBoolean("ok") && (op.equals("hello") || op.equals("state"))) {
                    String deviceId = reply.getJSONObject("data").getString("deviceId");
                    if (!deviceId.matches("[0-9a-f]{32}") || (!verifiedDeviceId.isEmpty() && !verifiedDeviceId.equals(deviceId))) throw new IllegalArgumentException("Device identity changed");
                    verifiedDeviceId = deviceId;
                    if (op.equals("hello")) { hostReplyEnabled = false; verifiedClientId = ""; }
                }
                if (id.equals(jsFlightId) && op.equals("care_capabilities") && reply.optBoolean("ok")) {
                    JSONObject data = reply.getJSONObject("data");
                    if (verifiedDeviceId.isEmpty() || !verifiedDeviceId.equals(data.opt("deviceId")) || jsFlightClientId == null ||
                        !jsFlightClientId.equals(data.opt("clientId"))) throw new IllegalArgumentException("Context owner mismatch");
                    hostReplyEnabled = jsFlightMobileContext && Boolean.TRUE.equals(data.opt("mobileContextV1")) && Boolean.TRUE.equals(data.opt("confirmed"));
                    if (hostReplyEnabled) verifiedClientId = jsFlightClientId;
                }
                if (id.equals(jsFlightId)) repliedFlightId = id;
                emitFrame(context, line);
                if (connection != context) return;
                releaseObservedFlight(context);
            } catch (Exception malformed) { endConnection("设备响应或原身份校验失败，请手动恢复", "MALFORMED_FRAME"); return; }
        }
        } finally {
            processingIncoming = false;
            if (connection == context) {
                if (incomingLine.size() == 0) {
                    if (incomingTimeout != null) ui.removeCallbacks(incomingTimeout);
                    incomingTimeout = null;
                } else if (incomingTimeout == null) {
                    incomingTimeout = () -> {
                        if (connection == context && incomingLine.size() != 0)
                            endConnection("设备部分行未完成", "MALFORMED_FRAME");
                    };
                    ui.postDelayed(incomingTimeout, FLIGHT_TIMEOUT_MS);
                }
                drainContextReply(context);
                if (waitingFlightRequest != null && jsFlightId == null && pendingContextRequest == null && contextReplyLine == null && incomingLine.size() == 0)
                    releaseWaitingFlight(context);
            }
        }
    }

    private boolean trustedPage() {
        if (activity.isFinishing() || activity.isDestroyed()) return false;
        try {
            Uri uri = Uri.parse(web.getUrl() == null ? "" : web.getUrl());
            if (!"https".equals(uri.getScheme()) || !"appassets.androidplatform.net".equals(uri.getHost()) ||
                uri.getPort() != -1 || uri.getUserInfo() != null || !"/offline/index.html".equals(uri.getEncodedPath()) || uri.getFragment() != null) return false;
            for (String name : uri.getQueryParameterNames()) if (!name.equals("slot")) return false;
            return documentUrl == null || documentUrl.equals(web.getUrl());
        } catch (RuntimeException error) { return false; }
    }

    private boolean granted() {
        if (Build.VERSION.SDK_INT >= 31) return has(Manifest.permission.BLUETOOTH_SCAN) && has(Manifest.permission.BLUETOOTH_CONNECT);
        return has(Manifest.permission.BLUETOOTH) && has(Manifest.permission.BLUETOOTH_ADMIN) && has(Manifest.permission.ACCESS_FINE_LOCATION);
    }
    private boolean has(String permission) { return activity.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED; }
    private Boolean enabled() {
        if (adapter == null || (Build.VERSION.SDK_INT >= 31 && !has(Manifest.permission.BLUETOOTH_CONNECT))) return null;
        try { return adapter.isEnabled(); } catch (RuntimeException error) { return null; }
    }
    private JSONObject availability() {
        Boolean enabled = enabled();
        return object("available", adapter != null, "bluetoothEnabled", enabled == null ? JSONObject.NULL : enabled,
            "granted", granted(), "androidApi", Build.VERSION.SDK_INT, "foreground", foreground,
            "activityForeground", activityForeground, "mode", selectedMode, "routingAvailable", modeRouter != null);
    }
    private void selectTransport(Request request, JSONObject args) throws JSONException {
        keys(args, "mode", "origin");
        Object mode = args.get("mode"), origin = args.get("origin");
        if (!(mode instanceof String) || (!mode.equals("cflocal2") && !mode.equals("legacy")) || (!"explicit_user_action".equals(origin) && !"saved_device_reconnect".equals(origin)))
            throw new IllegalArgumentException("An explicit cflocal2/legacy transport selection is required");
        if (!activityForeground) { failure(request, "NOT_READY", "Transport selection requires the foreground", "no_change"); return; }
        if (modeRouter == null) { failure(request, "NOT_READY", "Owner transport router is not installed", "no_change"); return; }
        String target = (String) mode;
        if (selectedMode.equals(target)) { success(request, object("mode", selectedMode, "foreground", foreground)); return; }
        String previous = selectedMode;
        foreground = false;
        stopScan("Explicit transport selection"); endConnection("Explicit transport selection", "NOT_READY"); found.clear();
        RouteResult result = route(modeRouter, previous, target);
        selectedMode = result.mode;
        foreground = activityForeground && selectedMode.equals("cflocal2") && result.confirmed;
        if (result.success) success(request, object("mode", selectedMode, "foreground", foreground, "generation", generation));
        else failure(request, "NOT_READY", result.confirmed ? "Transport router failed; previous mode restored with links disconnected" :
            "Transport router and rollback failed; V2 is disabled and owner must confirm both transports stopped", result.confirmed ? "no_change" : "unknown");
    }
    private static final class RouteResult {
        final boolean success, confirmed;
        final String mode;
        RouteResult(boolean success, boolean confirmed, String mode) { this.success = success; this.confirmed = confirmed; this.mode = mode; }
    }
    private static RouteResult route(ModeRouter router, String previous, String target) {
        try { router.selectMode(target); return new RouteResult(true, true, target); }
        catch (Exception failed) {
            try { router.selectMode(previous); return new RouteResult(false, true, previous); }
            catch (Exception rollbackFailed) {
                try { router.selectMode("off"); } catch (Exception ignored) { }
                return new RouteResult(false, false, "off");
            }
        }
    }
    private boolean gate(Request request, boolean scanning) {
        if (!foreground) {
            if (request != null) failure(request, "NOT_READY", "后台只保持原连接，普通BLE操作已暂停", "no_change");
            return false;
        }
        String code = null, message = null;
        if (!granted()) { code = "PERMISSION_REQUIRED"; message = "Grant the Android BLE permission explicitly"; }
        else if (adapter == null) { code = "NOT_READY"; message = "BLE hardware is unavailable"; }
        else if (!Boolean.TRUE.equals(enabled())) { code = "BLUETOOTH_OFF"; message = "Turn Bluetooth on in system settings"; }
        else if (scanning && Build.VERSION.SDK_INT <= 30 && Settings.Secure.getInt(activity.getContentResolver(), Settings.Secure.LOCATION_MODE, 0) == 0) {
            code = "PERMISSION_REQUIRED"; message = "Android 11 and earlier require system location enabled for BLE scanning; this bridge never reads GPS";
        }
        if (code == null) return true;
        // A revoked grant or disabled adapter also terminates an already active lease.
        stopScan(message); endConnection(message, code); found.clear();
        if (request != null) failure(request, code, message, "no_change");
        return false;
    }

    private void requestPermissions(Request request) {
        if (!activityForeground) { failure(request, "NOT_READY", "Permission requests require the foreground", "no_change"); return; }
        if (systemPermissionPromptPending) { failure(request, "BUSY", "An Android permission prompt is pending", "no_change"); return; }
        if (granted()) { success(request, availability()); return; }
        permissionRequest = request;
        systemPermissionPromptPending = true;
        permissionTimeout = () -> cancelPermission("Permission request timed out; check the actual system grant and retry explicitly");
        ui.postDelayed(permissionTimeout, 120000);
        try {
            activity.requestPermissions(Build.VERSION.SDK_INT >= 31 ? new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT} :
                new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, PERMISSION_REQUEST_CODE);
        } catch (RuntimeException error) { systemPermissionPromptPending = false; cancelPermission("Android could not open its permission prompt"); }
    }
    public boolean onRequestPermissionsResult(int code, String[] permissions, int[] grantResults) {
        if (code == BACKGROUND_PERMISSION_CODE) {
            runOnUi(() -> {
                if (notificationTimeout != null) ui.removeCallbacks(notificationTimeout);
                notificationTimeout = null;
                Request request = backgroundPermissionRequest; backgroundPermissionRequest = null;
                if (request != null) {
                    if (notificationAllowed()) success(request, connectionState());
                    else failure(request, "PERMISSION_REQUIRED", "未允许通知，锁屏保持未开启", "no_change");
                }
            });
            return true;
        }
        if (code != PERMISSION_REQUEST_CODE) return false;
        runOnUi(() -> {
            systemPermissionPromptPending = false;
            Request request = permissionRequest; permissionRequest = null;
            if (permissionTimeout != null) ui.removeCallbacks(permissionTimeout);
            permissionTimeout = null;
            if (request != null) success(request, availability()); // inspect actual grants, never trust a forwarded array
        });
        return true;
    }
    private void cancelPermission(String reason) {
        if (permissionTimeout != null) ui.removeCallbacks(permissionTimeout);
        permissionTimeout = null;
        Request request = permissionRequest; permissionRequest = null;
        if (request != null) failure(request, "PERMISSION_REQUIRED", reason, "no_change");
    }

    private void beginScan(Request request, JSONObject args) throws JSONException {
        keys(args, "durationMs");
        int duration = args.has("durationMs") ? (int) integer(args, "durationMs", 1000, 10000) : 8000;
        if (!gate(request, true)) return;
        if (scan != null || connection != null) { failure(request, "BUSY", "Finish the active scan or disconnect first", "no_change"); return; }
        found.clear();
        ScanSession session = new ScanSession(request, ++generation);
        scan = session;
        session.scanner = adapter.getBluetoothLeScanner();
        if (session.scanner == null) { stopScan("BLE scanner is unavailable"); return; }
        session.callback = new ScanCallback() {
            @Override public void onScanResult(int callbackType, ScanResult result) { ui.post(() -> acceptScan(session, result)); }
            @Override public void onBatchScanResults(java.util.List<ScanResult> results) {
                for (ScanResult result : results) ui.post(() -> acceptScan(session, result));
            }
            @Override public void onScanFailed(int errorCode) { ui.post(() -> { if (scan == session) stopScan("Android scan failed: " + errorCode); }); }
        };
        session.timeout = () -> { if (scan == session) stopScan(gate(null, true) ? null : "BLE scan gate became unavailable"); };
        try {
            session.scanner.startScan(Collections.singletonList(new ScanFilter.Builder().setServiceUuid(new ParcelUuid(SERVICE)).build()),
                new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), session.callback);
            ui.postDelayed(session.timeout, duration);
        } catch (RuntimeException error) { stopScan("Cannot start BLE scan"); }
    }
    private void acceptScan(ScanSession session, ScanResult result) {
        if (scan != session || session.request.epoch != documentEpoch || disposed) return;
        if (!trustedPage() || !gate(null, true)) { stopScan("BLE scan gate became unavailable"); return; }
        try {
            ScanRecord record = result.getScanRecord();
            if (record == null || record.getServiceUuids() == null || !record.getServiceUuids().contains(new ParcelUuid(SERVICE))) return;
            BluetoothDevice device = result.getDevice();
            String address = device.getAddress();
            if (!found.containsKey(address) && found.size() >= 50) return;
            JSONObject event = object("type", "device", "generation", session.generation, "address", address,
                "name", record.getDeviceName() == null ? "" : record.getDeviceName(), "rssi", result.getRssi(), "source", "native_scan");
            found.put(address, new Found(device, event));
            emit(event, session.request.epoch);
        } catch (RuntimeException error) { stopScan("BLE scan permission or device access failed"); }
    }
    private JSONObject scanResult() {
        JSONArray devices = new JSONArray();
        for (Found item : found.values()) devices.put(item.record);
        return object("devices", devices, "count", devices.length(), "generation", generation);
    }
    private void stopScan(String reason) {
        ScanSession session = scan; scan = null;
        if (session == null) return;
        if (session.timeout != null) ui.removeCallbacks(session.timeout);
        if (session.scanner != null && session.callback != null) try { session.scanner.stopScan(session.callback); } catch (RuntimeException ignored) { }
        if (reason == null) success(session.request, scanResult());
        else failure(session.request, "NOT_READY", reason, "no_change");
    }

    private void connect(Request request, JSONObject args) throws JSONException {
        keys(args, "address");
        Object rawAddress = args.get("address");
        if (!(rawAddress instanceof String)) throw new IllegalArgumentException("address must be a string");
        String address = (String) rawAddress;
        if (!gate(request, false)) return;
        Found selected = found.get(address);
        if (selected == null) { failure(request, "NOT_READY", "Select a device from the current real scan list", "no_change"); return; }
        if (connection != null) { failure(request, "BUSY", "Disconnect the current device first", "no_change"); return; }
        stopScan(null);
        Connection context = new Connection(++generation, documentEpoch, address, request);
        connection = context;
        connectionEvent(context, "connecting", "");
        try {
            context.gatt = selected.device.connectGatt(activity, false, callback(context), BluetoothDevice.TRANSPORT_LE);
            if (context.gatt == null) { endConnection("Android could not open GATT", "NOT_READY"); return; }
            context.setupTimeout = () -> { if (connection == context && !context.ready) endConnection("GATT discovery/subscription timed out", "NOT_READY"); };
            ui.postDelayed(context.setupTimeout, 20000);
        } catch (RuntimeException error) { endConnection("Cannot connect GATT", "NOT_READY"); }
    }

    private BluetoothGattCallback callback(Connection context) {
        return new BluetoothGattCallback() {
            private void dispatch(BluetoothGatt source, Runnable action) {
                ui.post(() -> {
                    if (!current(context, source)) return;
                    if (!trustedPage() || !transportAlive() || !granted() || !Boolean.TRUE.equals(enabled())) { endConnection("BLE page, radio or permission gate changed", "NOT_READY"); return; }
                    try { action.run(); } catch (RuntimeException error) { endConnection("GATT callback failed safely", "NOT_READY"); }
                });
            }
            @Override public void onConnectionStateChange(BluetoothGatt source, int status, int state) {
                dispatch(source, () -> {
                    if (status != BluetoothGatt.GATT_SUCCESS || state == BluetoothProfile.STATE_DISCONNECTED) { endConnection("GATT disconnected: " + status, "NOT_READY"); return; }
                    if (state == BluetoothProfile.STATE_CONNECTED && context.stage.equals("connecting")) {
                        context.stage = "discovering"; connectionEvent(context, context.stage, "");
                        if (!source.discoverServices()) endConnection("GATT service discovery did not start", "NOT_READY");
                    }
                });
            }
            @Override public void onServicesDiscovered(BluetoothGatt source, int status) {
                dispatch(source, () -> {
                    if (!context.stage.equals("discovering")) return;
                    BluetoothGattService service = source.getService(SERVICE);
                    if (status != BluetoothGatt.GATT_SUCCESS || service == null) { endConnection("Local-v2 service is missing", "UNSUPPORTED_PROTOCOL"); return; }
                    context.rx = service.getCharacteristic(RX); context.tx = service.getCharacteristic(TX);
                    if (context.rx == null || context.tx == null || (context.rx.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE) == 0 ||
                        (context.tx.getProperties() & BluetoothGattCharacteristic.PROPERTY_READ) == 0 || (context.tx.getProperties() & BluetoothGattCharacteristic.PROPERTY_NOTIFY) == 0) {
                        endConnection("RX write-response / TX read-notify contract mismatch", "UNSUPPORTED_PROTOCOL"); return;
                    }
                    context.cccd = context.tx.getDescriptor(CCCD);
                    if (context.cccd == null || !source.setCharacteristicNotification(context.tx, true)) { endConnection("TX notification/CCCD registration failed", "UNSUPPORTED_PROTOCOL"); return; }
                    context.stage = "subscribing"; connectionEvent(context, context.stage, "");
                    if (!subscribe(context)) { endConnection("CCCD write did not start", "NOT_READY"); return; }
                    context.operationTimeout = () -> { if (connection == context && !context.ready) endConnection("CCCD write timed out", "NOT_READY"); };
                    ui.postDelayed(context.operationTimeout, 10000);
                });
            }
            @Override public void onDescriptorWrite(BluetoothGatt source, BluetoothGattDescriptor descriptor, int status) {
                dispatch(source, () -> {
                    if (!context.stage.equals("subscribing") || descriptor != context.cccd || descriptor.getCharacteristic() != context.tx) return;
                    if (status != BluetoothGatt.GATT_SUCCESS) { endConnection("CCCD write failed: " + status, "NOT_READY"); return; }
                    cancelTimers(context); context.ready = true; context.stage = "subscribed";
                    connectionEvent(context, "subscribed", "");
                    Request request = context.request; context.request = null;
                    if (request != null) success(request, evidence(context));
                });
            }
            @Override public void onCharacteristicWrite(BluetoothGatt source, BluetoothGattCharacteristic characteristic, int status) {
                dispatch(source, () -> {
                    if (!context.ready || characteristic != context.rx) return;
                    if (contextReplyWrite) {
                        if (status != BluetoothGatt.GATT_SUCCESS) { endConnection("设备情境回复GATT写失败", "NOT_READY"); return; }
                        contextReplyWrite = false;
                        contextReplyOffset = Math.min(contextReplyOffset + GATT_FRAGMENT_BYTES, contextReplyLine.length);
                        completeContextReply(context);
                        drainContextReply(context); return;
                    }
                    if (context.write == null) return;
                    if (status != BluetoothGatt.GATT_SUCCESS) { endConnection("RX write failed: " + status, "NOT_READY"); return; }
                    Write completed = context.write; context.write = null;
                    context.lineBytes = completed.nextLineBytes;
                    if (context.operationTimeout != null) ui.removeCallbacks(context.operationTimeout);
                    context.operationTimeout = null;
                    success(completed.request, object("generation", context.generation)); // only the GATT completion; never an app ACK
                    releaseObservedFlight(context);
                });
            }
            @Override public void onCharacteristicChanged(BluetoothGatt source, BluetoothGattCharacteristic characteristic, byte[] value) {
                notifyValue(source, characteristic, value == null ? null : value.clone());
            }
            @Override @SuppressWarnings("deprecation") public void onCharacteristicChanged(BluetoothGatt source, BluetoothGattCharacteristic characteristic) {
                byte[] value = characteristic.getValue();
                notifyValue(source, characteristic, value == null ? null : value.clone());
            }
            private void notifyValue(BluetoothGatt source, BluetoothGattCharacteristic characteristic, byte[] value) {
                dispatch(source, () -> {
                    if (!context.ready || characteristic != context.tx || value == null || value.length > 512) return;
                    acceptIncoming(context, value);
                });
            }
            // There is no raw read ABI or readCharacteristic call. Unsolicited read callbacks
            // cannot settle a write/connection request or inject stale device state.
        };
    }
    private boolean current(Connection context, BluetoothGatt source) {
        return !disposed && initialized && transportAlive() && connection == context && context.epoch == documentEpoch && source == context.gatt;
    }
    @SuppressWarnings("deprecation") private boolean subscribe(Connection context) {
        if (Build.VERSION.SDK_INT >= 33) return context.gatt.writeDescriptor(context.cccd, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE.clone()) == BluetoothStatusCodes.SUCCESS;
        context.cccd.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE.clone());
        return context.gatt.writeDescriptor(context.cccd);
    }

    private void write(Request request, JSONObject args) throws JSONException {
        keys(args, "generation", "base64");
        long requestedGeneration = integer(args, "generation", 0, 9007199254740991L);
        byte[] value;
        try {
            Object raw = args.get("base64");
            if (!(raw instanceof String) || ((String) raw).length() < 4 || ((String) raw).length() > 28) throw new IllegalArgumentException();
            value = Base64.decode((String) raw, Base64.NO_WRAP);
            if (!Base64.encodeToString(value, Base64.NO_WRAP).equals(raw) || !validFragment(value)) throw new IllegalArgumentException();
        } catch (IllegalArgumentException error) { failure(request, "MALFORMED_FRAME", "A canonical Base64 fragment of 1..20 bytes is required", "no_change"); return; }
        if (!gate(request, false)) return;
        Connection context = connection;
        if (context == null || !context.ready) { failure(request, "NOT_READY", "Subscribe before writing", "no_change"); return; }
        if (requestedGeneration != context.generation) { failure(request, "STALE_GENERATION", "Write belongs to an old connection", "no_change"); return; }
        if (jsFlightId == null || contextReplyLine != null || contextReplyWrite) { failure(request, "BUSY", "Acquire the complete JS flight before writing", "no_change"); return; }
        if (context.write != null) { failure(request, "BUSY", "Only one GATT write may be in flight", "no_change"); return; }
        int nextLine;
        try { nextLine = nextLineBytes(context.lineBytes, value); }
        catch (IllegalArgumentException error) {
            failure(request, "MALFORMED_FRAME", "NDJSON line exceeds 2048 bytes including LF", "no_change");
            endConnection("Oversized outbound line; reconnect to reset partial framing", "MALFORMED_FRAME"); return;
        }
        if (jsFlightOp != null) {
            failure(request, "MALFORMED_FRAME", "The flight command line is already complete", "no_change");
            endConnection("A flight cannot send a second or trailing partial line", "MALFORMED_FRAME"); return;
        }
        try {
            for (int index = 0; index < value.length; index++) {
                byte octet = value[index];
                outgoingLine.write(octet);
                if (octet == 10) {
                    JSONObject command = StrictNdjson.object(StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                        .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(outgoingLine.toByteArray())).toString());
                    if (index != value.length - 1 || !jsFlightId.equals(command.get("id")) || integer(command, "v", 2, 2) != 2 || !(command.get("op") instanceof String))
                        throw new IllegalArgumentException("Flight line mismatch");
                    jsFlightOp = command.getString("op");
                    if (jsFlightOp.equals("care_capabilities")) {
                        Object owner = command.opt("clientId");
                        if (!(owner instanceof String) || !((String) owner).matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"))
                            throw new IllegalArgumentException("Invalid capability owner");
                        jsFlightClientId = (String) owner;
                        jsFlightMobileContext = Boolean.TRUE.equals(command.getJSONObject("data").opt("mobileContextV1"));
                        hostReplyEnabled = false;
                    }
                    outgoingLine.reset();
                }
            }
        } catch (Exception malformed) {
            endConnection("原NDJSON flight身份或单行边界不匹配", "MALFORMED_FRAME");
            failure(request, "MALFORMED_FRAME", "完整命令必须属于已获取的flight", "unknown"); return;
        }
        Write operation = new Write(request, value.clone(), nextLine); context.write = operation;
        boolean started;
        try { started = startWrite(context, operation.value); }
        catch (RuntimeException error) { endConnection("GATT write submission failed; outcome is unknown", "NOT_READY"); return; }
        if (!started) {
            context.write = null;
            failure(request, "NOT_READY", "Android rejected the GATT write before submission", "no_change");
            endConnection("GATT write submission failed", "NOT_READY"); return;
        }
        context.operationTimeout = () -> {
            if (connection == context && context.write == operation) endConnection("GATT write timed out; command outcome is unknown", "ACK_TIMEOUT_OUTCOME_UNKNOWN");
        };
        ui.postDelayed(context.operationTimeout, 10000);
    }
    @SuppressWarnings("deprecation") private boolean startWrite(Connection context, byte[] value) {
        if (Build.VERSION.SDK_INT >= 33) return context.gatt.writeCharacteristic(context.rx, value, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS;
        context.rx.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT); context.rx.setValue(value);
        return context.gatt.writeCharacteristic(context.rx);
    }
    private static boolean validFragment(byte[] value) { return value != null && value.length >= 1 && value.length <= 20; }
    private static int nextLineBytes(int current, byte[] value) {
        if (current < 0 || current > 2048 || !validFragment(value)) throw new IllegalArgumentException("Invalid fragment state");
        int count = current;
        for (byte octet : value) {
            if (++count > 2048) throw new IllegalArgumentException("Line exceeds 2048 bytes including LF");
            if (octet == 10) count = 0;
        }
        return count;
    }

    private JSONObject evidence(Connection context) {
        return object("generation", context.generation, "address", context.address,
            "serviceVerified", true, "rxVerified", true, "txVerified", true, "subscribed", context.ready);
    }
    private void connectionEvent(Connection context, String state, String reason) {
        JSONObject event = object("type", "connection", "generation", context.generation, "address", context.address, "state", state, "reason", reason);
        if (state.equals("subscribed")) {
            event = evidence(context);
            put(event, "type", "connection"); put(event, "state", state); put(event, "reason", reason);
        }
        emit(event, context.epoch);
    }
    private void endConnection(String reason, String code) {
        if (contextWriteTimeout != null) ui.removeCallbacks(contextWriteTimeout);
        if (contextRequestTimeout != null) ui.removeCallbacks(contextRequestTimeout);
        if (incomingTimeout != null) ui.removeCallbacks(incomingTimeout);
        if (waitingFlightTimeout != null) ui.removeCallbacks(waitingFlightTimeout);
        if (flightTimeout != null) ui.removeCallbacks(flightTimeout);
        if (retentionTimeout != null) ui.removeCallbacks(retentionTimeout);
        contextWriteTimeout = null; contextRequestTimeout = null; incomingTimeout = null;
        waitingFlightTimeout = null; flightTimeout = null; retentionTimeout = null;
        pendingContextRequest = null; contextReplyLine = null; contextReplyWrite = false; contextReplyOffset = 0;
        hostReplyEnabled = false; verifiedClientId = ""; lastContextGeneration = -1; lastContextCounter = 0;
        jsFlightId = null; releasedFlightId = null; repliedFlightId = null; jsFlightClientId = null; jsFlightMobileContext = false;
        incomingLine.reset(); outgoingLine.reset(); jsFlightOp = null; verifiedDeviceId = "";
        backgroundEnabled = false; retainedDeviceId = "";
        if (!"user_stopped".equals(retentionReason) || connection != null || "user_stopped".equals(reason)) retentionReason = reason;
        BleRetentionService.stop(serviceListener);
        Request starting = retentionRequest; retentionRequest = null;
        if (starting != null) failure(starting, code, reason, "no_change");
        Request waiting = waitingFlightRequest; waitingFlightRequest = null; waitingFlightId = null;
        if (waiting != null) failure(waiting, code, reason, "no_change");
        Connection context = connection; connection = null;
        if (context == null) return;
        ++generation; context.ready = false; cancelTimers(context);
        if (context.request != null) { failure(context.request, code, reason, "no_change"); context.request = null; }
        if (context.write != null) { failure(context.write.request, code, reason, "unknown"); context.write = null; }
        BluetoothGatt old = context.gatt; context.gatt = null;
        if (old != null) {
            try { old.disconnect(); } catch (RuntimeException ignored) { }
            try { old.close(); } catch (RuntimeException ignored) { }
        }
        connectionEvent(context, "disconnected", reason);
    }
    private void cancelTimers(Connection context) {
        if (context.setupTimeout != null) ui.removeCallbacks(context.setupTimeout);
        if (context.operationTimeout != null) ui.removeCallbacks(context.operationTimeout);
        context.setupTimeout = null; context.operationTimeout = null;
    }

    /** 宿主页错误不是锁屏，不允许服务维持失效文档连接。 */
    public void stopForHostError() { runOnUi(() -> { stopRetention("宿主页已暂停，请重新打开后手动恢复原设备"); setForeground(false); }); }

    /** Must be called directly by the owner before WebView pause; never depend on paused JS timers. */
    public void setForeground(boolean value) {
        runOnUi(() -> {
            if (disposed) return;
            activityForeground = value;
            foreground = value && selectedMode.equals("cflocal2") && modeRouter != null;
            if (value) {
                releaseObservedFlight(connection);
                if (backgroundEnabled && (!notificationAllowed() || !granted() || !Boolean.TRUE.equals(enabled()))) stopRetention("权限或蓝牙已关闭，请手动恢复原设备");
                while (!backgroundEvents.isEmpty()) {
                    JSONObject event = backgroundEvents.removeFirst();
                    deliver(event, documentEpoch);
                }
                backgroundBytes = 0; emitLifecycle();
            } else {
                stopScan("App left foreground"); found.clear();
                if (!transportAlive()) { endConnection("App left foreground without verified retention", "NOT_READY"); }
                else {
                    releaseObservedFlight(connection);
                    drainContextReply(connection);                }
                emitLifecycle();
            }
        });
    }
    /** Required on every main-frame navigation, including a same-URL reload or slot replacement. */
    public void onPageStarted(String url) { runOnUi(this::invalidateDocument); }
    private void invalidateDocument() {
        ++documentEpoch; initialized = false; documentUrl = null;
        selectedMode = "off"; foreground = false;
        closePorts();
        pending.clear(); usedIds.clear();
        stopScan("Page changed"); endConnection("Page changed", "NOT_READY");
        cancelPermission("Page changed"); found.clear(); unregisterReceiver();
    }
    public void dispose() { runOnUi(this::disposeInternal); }
    private void disposeInternal() {
        if (disposed) { closePorts(); return; }
        ++documentEpoch; initialized = false; disposed = true; foreground = false;
        activityForeground = false; selectedMode = "off";
        closePorts();
        pending.clear(); stopScan("Bridge disposed"); endConnection("Bridge disposed", "NOT_READY");
        cancelPermission("Bridge disposed"); found.clear(); usedIds.clear(); unregisterReceiver();
    }
    private final BroadcastReceiver bluetoothState = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (!BluetoothAdapter.ACTION_STATE_CHANGED.equals(intent.getAction())) return;
            int state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR);
            if (state == BluetoothAdapter.STATE_OFF || state == BluetoothAdapter.STATE_TURNING_OFF) {
                stopScan("Bluetooth switched off"); endConnection("Bluetooth switched off", "BLUETOOTH_OFF"); found.clear();
            }
        }
    };
    private void registerReceiver() {
        if (receiverRegistered) return;
        IntentFilter filter = new IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED);
        if (Build.VERSION.SDK_INT >= 33) activity.registerReceiver(bluetoothState, filter, Context.RECEIVER_NOT_EXPORTED);
        else activity.registerReceiver(bluetoothState, filter);
        receiverRegistered = true;
    }
    private void unregisterReceiver() {
        if (!receiverRegistered) return;
        receiverRegistered = false;
        try { activity.unregisterReceiver(bluetoothState); } catch (RuntimeException ignored) { }
    }

    private void success(Request request, JSONObject result) { finish(request, object("type", "result", "requestId", request.id, "ok", true, "result", result)); }
    private void failure(Request request, String code, String message, String outcome) {
        finish(request, object("type", "result", "requestId", request.id, "ok", false, "error", object("code", code, "message", message, "outcome", outcome)));
    }
    private void sendUntrackedError(Request request, String code, String message) {
        remember(request.id);
        emit(object("type", "result", "requestId", request.id, "ok", false, "error", object("code", code, "message", message, "outcome", "no_change")), request.epoch);
    }
    private void finish(Request request, JSONObject result) {
        if (pending.get(request.id) != request) return;
        pending.remove(request.id); remember(request.id); emit(result, request.epoch);
    }
    private void remember(String id) {
        usedIds.add(id);
        while (usedIds.size() > 256) usedIds.remove(usedIds.iterator().next());
    }
    private void emit(JSONObject event, long epoch) {
        if (epoch != documentEpoch || !trustedPage() || nativePort == null) return;
        if (!activityForeground) {
            int bytes = event.toString().getBytes(StandardCharsets.UTF_8).length;
            if (backgroundEvents.size() >= MAX_BUFFER_EVENTS || backgroundBytes + bytes > MAX_BUFFER_BYTES) {
                backgroundEvents.clear(); backgroundBytes = 0;
                endConnection("后台回执缓存已满，原pending保留，请回前台恢复", "ACK_TIMEOUT_OUTCOME_UNKNOWN");
                JSONObject stopped = connectionState(); put(stopped, "type", "lifecycle");
                backgroundEvents.addLast(stopped); backgroundBytes = stopped.toString().getBytes(StandardCharsets.UTF_8).length;
                return;
            }
            backgroundEvents.addLast(event); backgroundBytes += bytes; return;
        }
        deliver(event, epoch);
    }
    private void deliver(JSONObject event, long epoch) {
        if (epoch != documentEpoch || !trustedPage() || nativePort == null) return;
        try { nativePort.postMessage(new WebMessage(event.toString())); }
        catch (RuntimeException error) { invalidateDocument(); }
    }
    private void closePorts() {
        backgroundEvents.clear(); backgroundBytes = 0;
        Request notification = backgroundPermissionRequest; backgroundPermissionRequest = null;
        if (notification != null) pending.remove(notification.id);
        WebMessagePort oldNative = nativePort, oldTransfer = transferPort;
        nativePort = null; transferPort = null;
        if (oldNative != null) try { oldNative.close(); } catch (RuntimeException ignored) { }
        if (oldTransfer != null) try { oldTransfer.close(); } catch (RuntimeException ignored) { }
    }
    private void runOnUi(Runnable action) { if (Looper.myLooper() == Looper.getMainLooper()) action.run(); else ui.post(action); }
    private static void empty(JSONObject args) { if (args.length() != 0) throw new IllegalArgumentException("args must be empty"); }
    private static void keys(JSONObject args, String... allowed) {
        Set<String> keys = new LinkedHashSet<>(Arrays.asList(allowed));
        java.util.Iterator<String> names = args.keys();
        while (names.hasNext()) if (!keys.contains(names.next())) throw new IllegalArgumentException("Unexpected argument");
    }
    private static long integer(JSONObject args, String name, long min, long max) throws JSONException {
        Object value = args.get(name);
        if (!(value instanceof Number)) throw new IllegalArgumentException(name + " must be an integer");
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number) || number != Math.rint(number) || number < min || number > max) throw new IllegalArgumentException(name + " is out of range");
        return ((Number) value).longValue();
    }
    private static JSONObject object(Object... pairs) {
        JSONObject value = new JSONObject();
        for (int index = 0; index < pairs.length; index += 2) put(value, (String) pairs[index], pairs[index + 1]);
        return value;
    }
    private static void put(JSONObject object, String key, Object value) {
        try { object.put(key, value); } catch (JSONException error) { throw new IllegalArgumentException(error); }
    }
}
