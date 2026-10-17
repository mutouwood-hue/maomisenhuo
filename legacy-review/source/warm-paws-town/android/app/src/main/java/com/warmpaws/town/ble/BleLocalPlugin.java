package com.warmpaws.town.ble;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.*;
import android.bluetooth.le.*;
import android.content.Context;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.*;

/** Local-only transport: no bonding, ownership, cloud identity or background service. */
@CapacitorPlugin(name = "BleLocal", permissions = {
    @Permission(alias = "scan", strings = {Manifest.permission.BLUETOOTH_SCAN}),
    @Permission(alias = "connect", strings = {Manifest.permission.BLUETOOTH_CONNECT}),
    @Permission(alias = "location", strings = {Manifest.permission.ACCESS_FINE_LOCATION})
})
@SuppressLint("MissingPermission") // Every entry and reconnect checks the runtime permission gate.
public class BleLocalPlugin extends Plugin {
    private static final UUID SERVICE = UUID.fromString("e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a00");
    private static final UUID RX = UUID.fromString("e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a01");
    private static final UUID TX = UUID.fromString("e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a02");
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private static final int OP_TIMEOUT_MS = 10000;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, BluetoothDevice> discovered = new LinkedHashMap<>();
    private final ArrayDeque<Operation> queue = new ArrayDeque<>();
    private BluetoothAdapter adapter;
    private BluetoothLeScanner scanner;
    private ScanCallback scanCallback;
    private PluginCall scanCall;
    private Runnable scanTimeout;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic rx;
    private BluetoothGattCharacteristic tx;
    private Operation active;
    private Runnable operationTimeout;
    private Runnable connectionTimeout;
    private Runnable reconnectTask;
    private PluginCall connectCall;
    private int generation;
    private int reconnectAttempts;
    private boolean foreground = true;
    private boolean ready;
    private String desiredAddress;

    private static final class Operation {
        final String kind;
        final PluginCall call;
        final byte[] bytes;
        Operation(String kind, PluginCall call, byte[] bytes) {
            this.kind = kind; this.call = call; this.bytes = bytes;
        }
    }

    @Override public void load() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = manager == null ? null : manager.getAdapter();
    }

    private boolean permissionsGranted() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return getPermissionState("scan") == PermissionState.GRANTED && getPermissionState("connect") == PermissionState.GRANTED;
        }
        return getPermissionState("location") == PermissionState.GRANTED;
    }

    private boolean gate(PluginCall call) {
        String error = null;
        if (!foreground) error = "BLE is foreground-only";
        else if (!permissionsGranted()) error = "BLE permissions are not granted";
        else if (adapter == null) error = "BLE is not supported";
        else if (!adapter.isEnabled()) error = "Bluetooth is disabled";
        else if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            LocationManager location = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            if (location == null || (!location.isProviderEnabled(LocationManager.GPS_PROVIDER) && !location.isProviderEnabled(LocationManager.NETWORK_PROVIDER))) {
                error = "Enable system location for BLE scanning on Android 11 and earlier";
            }
        }
        if (error != null) { if (call != null) call.reject(error, "BLE_UNAVAILABLE"); return false; }
        return true;
    }

    @PluginMethod public void requestBlePermissions(PluginCall call) {
        if (permissionsGranted()) { permissionResult(call); return; }
        requestPermissionForAliases(Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? new String[]{"scan", "connect"} : new String[]{"location"}, call, "permissionResult");
    }

    @PermissionCallback private void permissionResult(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", permissionsGranted());
        result.put("androidApi", Build.VERSION.SDK_INT);
        call.resolve(result);
    }

    @PluginMethod public void scan(PluginCall call) {
        handler.post(() -> {
            if (!gate(call)) return;
            if (scanCall != null || gatt != null || desiredAddress != null) { call.reject("Disconnect or finish the existing scan first", "BLE_BUSY"); return; }
            int duration = Math.max(1000, Math.min(10000, call.getInt("durationMs", 8000)));
            discovered.clear();
            scanner = adapter.getBluetoothLeScanner();
            if (scanner == null) { call.reject("BLE scanner unavailable", "BLE_UNAVAILABLE"); return; }
            scanCall = call;
            final ScanCallback callback = new ScanCallback() {
                @Override public void onScanResult(int callbackType, ScanResult result) {
                    handler.post(() -> {
                        if (scanCallback != this || scanCall == null) return;
                        BluetoothDevice device = result.getDevice();
                        String address = device.getAddress();
                        if (!discovered.containsKey(address) && discovered.size() >= 50) return;
                        discovered.put(address, device);
                        JSObject event = new JSObject();
                        event.put("address", address);
                        event.put("name", result.getScanRecord() == null ? "" : result.getScanRecord().getDeviceName());
                        event.put("rssi", result.getRssi());
                        notifyListeners("device", event);
                    });
                }
                @Override public void onScanFailed(int errorCode) {
                    handler.post(() -> { if (scanCallback == this) stopScanInternal("Scan failed: " + errorCode); });
                }
            };
            scanCallback = callback;
            scanTimeout = () -> stopScanInternal(null);
            try {
                scanner.startScan(Collections.singletonList(new ScanFilter.Builder().setServiceUuid(new ParcelUuid(SERVICE)).build()), new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), callback);
                handler.postDelayed(scanTimeout, duration);
            } catch (RuntimeException error) { stopScanInternal("Cannot start BLE scan"); }
        });
    }

    @PluginMethod public void stopScan(PluginCall call) { handler.post(() -> { stopScanInternal(null); call.resolve(); }); }

    private void stopScanInternal(String error) {
        if (scanTimeout != null) handler.removeCallbacks(scanTimeout);
        ScanCallback callback = scanCallback;
        scanCallback = null;
        if (scanner != null && callback != null) { try { scanner.stopScan(callback); } catch (RuntimeException ignored) { /* Permission may have been revoked. */ } }
        scanner = null;
        PluginCall pending = scanCall;
        scanCall = null;
        if (pending != null) {
            if (error != null) pending.reject(error, "BLE_SCAN_FAILED");
            else { JSObject result = new JSObject(); result.put("count", discovered.size()); pending.resolve(result); }
        }
    }

    @PluginMethod public void connect(PluginCall call) {
        handler.post(() -> {
            if (!gate(call)) return;
            String address = call.getString("address", "");
            if (!discovered.containsKey(address)) { call.reject("Choose a device from the current BLE scan", "BLE_BAD_DEVICE"); return; }
            if (connectCall != null || desiredAddress != null || gatt != null) { call.reject("Disconnect first", "BLE_BUSY"); return; }
            stopScanInternal(null);
            desiredAddress = address;
            reconnectAttempts = 0;
            connectCall = call;
            beginConnect(discovered.get(address));
        });
    }

    private void emitConnection(String state, String reason) {
        JSObject event = new JSObject();
        event.put("state", state); event.put("generation", generation); event.put("reason", reason);
        event.put("reconnectAttempt", reconnectAttempts);
        notifyListeners("connection", event);
    }

    private void beginConnect(BluetoothDevice device) {
        final int token = ++generation;
        ready = false;
        emitConnection("connecting", "");
        BluetoothGattCallback callback = new BluetoothGattCallback() {
            private void dispatch(BluetoothGatt source, Runnable action) {
                handler.post(() -> { if (token == generation && source == gatt) action.run(); });
            }
            @Override public void onConnectionStateChange(BluetoothGatt source, int status, int state) {
                dispatch(source, () -> {
                    if (status != BluetoothGatt.GATT_SUCCESS || state == BluetoothProfile.STATE_DISCONNECTED) {
                        failConnection("GATT disconnected (" + status + ")", true); return;
                    }
                    if (state == BluetoothProfile.STATE_CONNECTED) {
                        emitConnection("discovering", "");
                        try { if (!source.discoverServices()) failConnection("Cannot discover GATT services", true); }
                        catch (RuntimeException error) { failConnection("Service discovery failed", false); }
                    }
                });
            }
            @Override public void onServicesDiscovered(BluetoothGatt source, int status) {
                dispatch(source, () -> {
                    BluetoothGattService service = source.getService(SERVICE);
                    if (status != BluetoothGatt.GATT_SUCCESS || service == null) { failConnection("BLE local v1 service missing", false); return; }
                    rx = service.getCharacteristic(RX); tx = service.getCharacteristic(TX);
                    if (rx == null || tx == null || (rx.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE) == 0 || (tx.getProperties() & BluetoothGattCharacteristic.PROPERTY_READ) == 0 || (tx.getProperties() & BluetoothGattCharacteristic.PROPERTY_NOTIFY) == 0 || tx.getDescriptor(CCCD) == null) {
                        failConnection("RX write-response / TX read-notify / CCCD contract mismatch", false); return;
                    }
                    emitConnection("subscribing", "");
                    try {
                        if (!source.setCharacteristicNotification(tx, true)) { failConnection("Local notification registration failed", false); return; }
                        queue.add(new Operation("subscribe", null, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE.clone()));
                        pump();
                    } catch (RuntimeException error) { failConnection("Notification subscription failed", false); }
                });
            }
            @Override public void onDescriptorWrite(BluetoothGatt source, BluetoothGattDescriptor descriptor, int status) {
                dispatch(source, () -> {
                    if (active == null || !active.kind.equals("subscribe") || !descriptor.getUuid().equals(CCCD)) return;
                    if (status != BluetoothGatt.GATT_SUCCESS) { failConnection("CCCD write failed: " + status, false); return; }
                    finishOperation(null);
                    ready = true;
                    if (connectionTimeout != null) handler.removeCallbacks(connectionTimeout);
                    JSObject connected = new JSObject(); connected.put("generation", generation);
                    PluginCall pending = connectCall; connectCall = null;
                    if (pending != null) pending.resolve(connected);
                    emitConnection("ready", "");
                    pump();
                });
            }
            @Override public void onCharacteristicWrite(BluetoothGatt source, BluetoothGattCharacteristic characteristic, int status) {
                dispatch(source, () -> {
                    if (active == null || !active.kind.equals("write") || !characteristic.getUuid().equals(RX)) return;
                    if (status != BluetoothGatt.GATT_SUCCESS) { failConnection("RX write failed: " + status, true); return; }
                    finishOperation(null); pump();
                });
            }
            @Override public void onCharacteristicRead(BluetoothGatt source, BluetoothGattCharacteristic characteristic, int status) {
                byte[] value = characteristic.getValue();
                readResult(source, characteristic, value == null ? new byte[0] : value.clone(), status);
            }
            @Override public void onCharacteristicRead(BluetoothGatt source, BluetoothGattCharacteristic characteristic, byte[] value, int status) { readResult(source, characteristic, value.clone(), status); }
            private void readResult(BluetoothGatt source, BluetoothGattCharacteristic characteristic, byte[] value, int status) {
                dispatch(source, () -> {
                    if (active == null || !active.kind.equals("read") || !characteristic.getUuid().equals(TX)) return;
                    if (status != BluetoothGatt.GATT_SUCCESS) { failConnection("TX read failed: " + status, true); return; }
                    emitFrame(value);
                    JSObject result = new JSObject(); result.put("value", Base64.encodeToString(value, Base64.NO_WRAP)); result.put("generation", generation);
                    finishOperation(result);
                    pump();
                });
            }
            @Override public void onCharacteristicChanged(BluetoothGatt source, BluetoothGattCharacteristic characteristic) {
                byte[] value = characteristic.getValue();
                changed(source, characteristic, value == null ? new byte[0] : value.clone());
            }
            @Override public void onCharacteristicChanged(BluetoothGatt source, BluetoothGattCharacteristic characteristic, byte[] value) { changed(source, characteristic, value.clone()); }
            private void changed(BluetoothGatt source, BluetoothGattCharacteristic characteristic, byte[] value) {
                dispatch(source, () -> { if (characteristic.getUuid().equals(TX)) emitFrame(value); });
            }
        };
        try {
            gatt = device.connectGatt(getContext(), false, callback, BluetoothDevice.TRANSPORT_LE);
            if (gatt == null) { failConnection("Cannot open GATT", true); return; }
            connectionTimeout = () -> { if (token == generation && !ready) failConnection("Connection setup timed out", true); };
            handler.postDelayed(connectionTimeout, 20000);
        } catch (RuntimeException error) { failConnection("Cannot connect GATT", false); }
    }

    private void emitFrame(byte[] value) {
        JSObject event = new JSObject(); event.put("generation", generation); event.put("value", Base64.encodeToString(value, Base64.NO_WRAP));
        notifyListeners("frame", event);
    }

    @PluginMethod public void write(PluginCall call) {
        handler.post(() -> {
            if (!readyGate(call)) return;
            byte[] value;
            try { value = Base64.decode(call.getString("value", ""), Base64.NO_WRAP); }
            catch (IllegalArgumentException error) { call.reject("Invalid base64 frame", "BLE_BAD_FRAME"); return; }
            if (value.length != 20) { call.reject("BLE local v1 requires exactly 20 bytes", "BLE_BAD_FRAME"); return; }
            enqueue(new Operation("write", call, value));
        });
    }
    @PluginMethod public void read(PluginCall call) { handler.post(() -> { if (readyGate(call)) enqueue(new Operation("read", call, null)); }); }

    private boolean readyGate(PluginCall call) {
        if (!gate(call)) return false;
        if (!ready || gatt == null || call.getInt("generation", -1) != generation) { call.reject("Stale or unready BLE session", "BLE_NOT_READY"); return false; }
        return true;
    }
    private void enqueue(Operation operation) {
        if (queue.size() >= 16) { operation.call.reject("GATT queue full", "BLE_BUSY"); return; }
        queue.add(operation); pump();
    }
    @SuppressWarnings("deprecation")
    private void pump() {
        if (active != null || gatt == null || queue.isEmpty()) return;
        active = queue.remove();
        boolean started;
        try {
            switch (active.kind) {
                case "subscribe":
                    BluetoothGattDescriptor descriptor = tx.getDescriptor(CCCD);
                    if (Build.VERSION.SDK_INT >= 33) started = gatt.writeDescriptor(descriptor, active.bytes) == BluetoothStatusCodes.SUCCESS;
                    else { descriptor.setValue(active.bytes); started = gatt.writeDescriptor(descriptor); }
                    break;
                case "write":
                    if (Build.VERSION.SDK_INT >= 33) started = gatt.writeCharacteristic(rx, active.bytes, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS;
                    else { rx.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT); rx.setValue(active.bytes); started = gatt.writeCharacteristic(rx); }
                    break;
                default: started = gatt.readCharacteristic(tx);
            }
        } catch (RuntimeException error) { started = false; }
        if (!started) { failConnection("GATT operation rejected", true); return; }
        final int token = generation;
        operationTimeout = () -> { if (generation == token && active != null) failConnection("GATT operation timed out", true); };
        handler.postDelayed(operationTimeout, OP_TIMEOUT_MS);
    }
    private void finishOperation(JSObject result) {
        if (operationTimeout != null) handler.removeCallbacks(operationTimeout);
        Operation completed = active; active = null;
        if (completed != null && completed.call != null) {
            JSObject response = result == null ? new JSObject() : result;
            response.put("generation", generation); completed.call.resolve(response);
        }
    }
    private void teardown(String reason) {
        ++generation; ready = false;
        if (connectionTimeout != null) handler.removeCallbacks(connectionTimeout);
        if (operationTimeout != null) handler.removeCallbacks(operationTimeout);
        if (reconnectTask != null) handler.removeCallbacks(reconnectTask);
        reconnectTask = null;
        if (active != null && active.call != null) active.call.reject(reason, "BLE_DISCONNECTED");
        active = null;
        while (!queue.isEmpty()) { Operation operation = queue.remove(); if (operation.call != null) operation.call.reject(reason, "BLE_DISCONNECTED"); }
        BluetoothGatt previous = gatt; gatt = null; rx = null; tx = null;
        if (previous != null) { try { previous.disconnect(); } catch (RuntimeException ignored) { } finally { previous.close(); } }
    }
    private void failConnection(String reason, boolean retry) {
        teardown(reason);
        PluginCall pending = connectCall; connectCall = null;
        if (pending != null) pending.reject(reason, "BLE_CONNECT_FAILED");
        emitConnection("disconnected", reason);
        if (retry) scheduleReconnect(); else desiredAddress = null;
    }
    private void scheduleReconnect() {
        if (!foreground || desiredAddress == null || reconnectAttempts >= 3 || !gate(null)) { desiredAddress = null; return; }
        int delay = 1000 << reconnectAttempts++;
        final int token = generation;
        emitConnection("reconnecting", "");
        reconnectTask = () -> {
            if (token != generation) return;
            reconnectTask = null;
            if (!foreground || desiredAddress == null || !gate(null)) { disconnectInternal("Reconnect gate unavailable"); return; }
            BluetoothDevice device = discovered.get(desiredAddress);
            if (device == null) { disconnectInternal("Reconnect device unavailable"); return; }
            beginConnect(device);
        };
        handler.postDelayed(reconnectTask, delay);
    }
    @PluginMethod public void disconnect(PluginCall call) {
        handler.post(() -> { disconnectInternal("Manual disconnect"); call.resolve(); });
    }
    private void disconnectInternal(String reason) {
        desiredAddress = null; reconnectAttempts = 0; stopScanInternal(null); teardown(reason);
        if (connectCall != null) { connectCall.reject(reason, "BLE_DISCONNECTED"); connectCall = null; }
        emitConnection("disconnected", reason);
    }
    @Override protected void handleOnPause() { handler.post(() -> { foreground = false; disconnectInternal("App left foreground; reconnect stopped"); }); }
    @Override protected void handleOnResume() { handler.post(() -> foreground = true); }
    @Override protected void handleOnDestroy() { handler.post(() -> { foreground = false; disconnectInternal("Plugin destroyed"); handler.removeCallbacksAndMessages(null); }); }
}
