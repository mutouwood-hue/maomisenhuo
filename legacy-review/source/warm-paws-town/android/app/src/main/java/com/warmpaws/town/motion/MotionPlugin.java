package com.warmpaws.town.motion;

import android.Manifest;
import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** 只报告前台真实开机累计计数，日步数由本机采样基线差分，绝不补造历史。 */
@CapacitorPlugin(name = "NativeMotion", permissions = {
    @Permission(alias = "motion", strings = {Manifest.permission.ACTIVITY_RECOGNITION})
})
public class MotionPlugin extends Plugin implements SensorEventListener {
    private SensorManager sensorManager;
    private Sensor stepCounter;
    private boolean isForeground = true;
    private boolean isSampling;
    private String bootId;

    @Override public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        stepCounter = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        int bootCount = Settings.Global.getInt(getContext().getContentResolver(), Settings.Global.BOOT_COUNT, -1);
        // 系统无法提供boot count时保守采用会话标识，宁可少计也不误算重启前数据。
        bootId = bootCount >= 0 ? "boot-" + bootCount : "session-" + SystemClock.elapsedRealtimeNanos();
    }
    private boolean hasPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || getPermissionState("motion") == PermissionState.GRANTED;
    }
    private JSObject statusValue() {
        JSObject result = new JSObject();
        result.put("isAvailable", stepCounter != null);
        result.put("isGranted", hasPermission());
        result.put("isSampling", isSampling);
        return result;
    }
    @PluginMethod public void status(PluginCall call) { call.resolve(statusValue()); }
    @PluginMethod public void requestMotionPermission(PluginCall call) {
        if (hasPermission()) { call.resolve(statusValue()); return; }
        requestPermissionForAlias("motion", call, "permissionResult");
    }
    @PermissionCallback private void permissionResult(PluginCall call) { call.resolve(statusValue()); }
    @PluginMethod public void start(PluginCall call) {
        if (!isForeground) { call.reject("运动采集仅在前台运行", "MOTION_FOREGROUND_ONLY"); return; }
        if (!hasPermission()) { call.reject("运动权限未授予", "MOTION_DENIED"); return; }
        if (stepCounter == null) { call.reject("手机没有可用的计步传感器", "MOTION_UNAVAILABLE"); return; }
        if (!isSampling) isSampling = sensorManager.registerListener(this, stepCounter, SensorManager.SENSOR_DELAY_NORMAL);
        if (!isSampling) { call.reject("无法开启计步采集", "MOTION_UNAVAILABLE"); return; }
        call.resolve(statusValue());
    }
    private void stopSampling() {
        if (sensorManager != null) sensorManager.unregisterListener(this);
        isSampling = false;
    }
    @PluginMethod public void stop(PluginCall call) { stopSampling(); call.resolve(statusValue()); }
    @Override public void onSensorChanged(SensorEvent event) {
        if (!isSampling || !isForeground || !hasPermission()) { stopSampling(); return; }
        if (event.sensor.getType() != Sensor.TYPE_STEP_COUNTER || event.values.length == 0 || !Float.isFinite(event.values[0]) || event.values[0] < 0) return;
        JSObject sample = new JSObject();
        sample.put("cumulativeSteps", (long) event.values[0]);
        sample.put("bootId", bootId);
        sample.put("time", System.currentTimeMillis());
        notifyListeners("sample", sample);
    }
    @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { /* 计数传感器不把精度回调冒称健康诊断。 */ }
    @Override protected void handleOnPause() { isForeground = false; stopSampling(); }
    @Override protected void handleOnResume() { isForeground = true; }
    @Override protected void handleOnDestroy() { isForeground = false; stopSampling(); }
}
