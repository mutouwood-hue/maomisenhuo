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
            JSONObject input = new JSONObject(json);
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
        String code = null, message = null;
        if (!foreground) { code = "NOT_READY"; message = "BLE is foreground-only"; }
        else if (!granted()) { code = "PERMISSION_REQUIRED"; message = "Grant the Android BLE permission explicitly"; }
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
                    if (!trustedPage() || !gate(null, false)) { endConnection("BLE foreground, page, radio or permission gate changed", "NOT_READY"); return; }
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
                    if (!context.ready || characteristic != context.rx || context.write == null) return;
                    if (status != BluetoothGatt.GATT_SUCCESS) { endConnection("RX write failed: " + status, "NOT_READY"); return; }
                    Write completed = context.write; context.write = null;
                    context.lineBytes = completed.nextLineBytes;
                    if (context.operationTimeout != null) ui.removeCallbacks(context.operationTimeout);
                    context.operationTimeout = null;
                    success(completed.request, object("generation", context.generation)); // only the GATT completion; never an app ACK
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
                    emit(object("type", "frame", "generation", context.generation, "value", Base64.encodeToString(value, Base64.NO_WRAP)), context.epoch);
                });
            }
            // There is no raw read ABI or readCharacteristic call. Unsolicited read callbacks
            // cannot settle a write/connection request or inject stale device state.
        };
    }
    private boolean current(Connection context, BluetoothGatt source) {
        return !disposed && initialized && foreground && connection == context && context.epoch == documentEpoch && source == context.gatt;
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
        if (context.write != null) { failure(request, "BUSY", "Only one GATT write may be in flight", "no_change"); return; }
        int nextLine;
        try { nextLine = nextLineBytes(context.lineBytes, value); }
        catch (IllegalArgumentException error) {
            failure(request, "MALFORMED_FRAME", "NDJSON line exceeds 2048 bytes including LF", "no_change");
            endConnection("Oversized outbound line; reconnect to reset partial framing", "MALFORMED_FRAME"); return;
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

    /** Must be called directly by the owner before WebView pause; never depend on paused JS timers. */
    public void setForeground(boolean value) {
        runOnUi(() -> {
            if (disposed) return;
            activityForeground = value;
            foreground = value && selectedMode.equals("cflocal2") && modeRouter != null;
            if (!value) { stopScan("App left foreground"); endConnection("App left foreground; reconnect is disabled", "NOT_READY"); found.clear(); }
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
        try { nativePort.postMessage(new WebMessage(event.toString())); }
        catch (RuntimeException error) { invalidateDocument(); }
    }
    private void closePorts() {
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
