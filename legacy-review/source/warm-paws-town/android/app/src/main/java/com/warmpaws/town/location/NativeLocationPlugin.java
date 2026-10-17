package com.warmpaws.town.location;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "NativeLocation", permissions = {
    @Permission(alias = "background", strings = {Manifest.permission.ACCESS_BACKGROUND_LOCATION}),
    @Permission(alias = "notification", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public class NativeLocationPlugin extends Plugin {
    private boolean isForeground = true;
    private boolean granted(String permission) { return getContext().checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED; }
    private JSObject statusValue() throws Exception {
        JSONObject stored = LocationQueue.get(getContext()).read();
        JSObject result = new JSObject();
        result.put("isForegroundGranted", granted(Manifest.permission.ACCESS_COARSE_LOCATION) || granted(Manifest.permission.ACCESS_FINE_LOCATION));
        result.put("isBackgroundGranted", Build.VERSION.SDK_INT < 29 || granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION));
        result.put("isNotificationGranted", Build.VERSION.SDK_INT < 33 || granted(Manifest.permission.POST_NOTIFICATIONS));
        result.put("isRunning", BackgroundLocationService.isRunning);
        result.put("isEnabled", stored.optBoolean("enabled"));
        result.put("owner", stored.optString("owner")); result.put("generation", stored.optString("generation"));
        result.put("pendingCount", stored.optJSONArray("samples").length()); result.put("droppedCount", stored.optInt("dropped"));
        result.put("lastError", BackgroundLocationService.lastError); return result;
    }
    @PluginMethod public void status(PluginCall call) {
        try {
            if (!(granted(Manifest.permission.ACCESS_COARSE_LOCATION) || granted(Manifest.permission.ACCESS_FINE_LOCATION)) || (Build.VERSION.SDK_INT >= 29 && !granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION))) {
                try { LocationQueue.get(getContext()).stop(true); } finally { getContext().stopService(new Intent(getContext(), BackgroundLocationService.class)); BackgroundLocationService.isRunning = false; }
            }
            call.resolve(statusValue());
        } catch (Exception error) { getContext().stopService(new Intent(getContext(), BackgroundLocationService.class)); call.reject("无法读取本机定位状态", error); }
    }
    @PluginMethod public void requestBackgroundPermission(PluginCall call) {
        if (!isForeground) { call.reject("请在应用前台单独开启后台位置权限"); return; }
        if (!(granted(Manifest.permission.ACCESS_COARSE_LOCATION) || granted(Manifest.permission.ACCESS_FINE_LOCATION))) { call.reject("请先授予前台位置权限，再单独设置后台权限"); return; }
        if (Build.VERSION.SDK_INT < 29 || granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION)) { status(call); return; }
        if (Build.VERSION.SDK_INT == 29) { requestPermissionForAlias("background", call, "permissionResult"); return; }
        // Android 11+ never combines foreground/background requests. User chooses "Allow all the time" in Settings.
        Intent settings = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(settings);
        JSObject result = new JSObject(); result.put("requiresSettings", true); call.resolve(result);
    }
    @PluginMethod public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || granted(Manifest.permission.POST_NOTIFICATIONS)) { status(call); return; }
        requestPermissionForAlias("notification", call, "permissionResult");
    }
    @PermissionCallback private void permissionResult(PluginCall call) { status(call); }
    @PluginMethod public void start(PluginCall call) {
        String owner = call.getString("owner");
        if (!isForeground || getActivity().isFinishing() || !Boolean.TRUE.equals(call.getBoolean("isBackgroundAllowed")) || owner == null || owner.isEmpty() || owner.length() > 100) { call.reject("仅前台明确授权的登录账号能启动后台轨迹记录"); return; }
        if (!(granted(Manifest.permission.ACCESS_COARSE_LOCATION) || granted(Manifest.permission.ACCESS_FINE_LOCATION)) || (Build.VERSION.SDK_INT >= 29 && !granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION))) { call.reject("后台位置权限未授予，保持前台采集模式"); return; }
        try {
            JSONObject state = LocationQueue.get(getContext()).read();
            if (BackgroundLocationService.isRunning && owner.equals(state.optString("owner"))) { call.resolve(statusValue()); return; }
            getContext().stopService(new Intent(getContext(), BackgroundLocationService.class));
            String generation = LocationQueue.get(getContext()).begin(owner);
            Intent intent = new Intent(getContext(), BackgroundLocationService.class).putExtra("generation", generation);
            if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(intent); else getContext().startService(intent);
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
                private int attempts;
                @Override public void run() {
                    try {
                        JSONObject current = LocationQueue.get(getContext()).read();
                        if (!generation.equals(current.optString("generation"))) { call.reject("后台启动已取消"); return; }
                        if (BackgroundLocationService.isRunning) { call.resolve(statusValue()); return; }
                        if (++attempts < 20 && current.optBoolean("enabled")) { new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(this, 100); return; }
                        try { LocationQueue.get(getContext()).stop(true); } finally { getContext().stopService(new Intent(getContext(), BackgroundLocationService.class)); }
                        call.reject("后台服务未就绪，未开启记录");
                    } catch (Exception error) { getContext().stopService(new Intent(getContext(), BackgroundLocationService.class)); call.reject("后台启动状态失败", error); }
                }
            }, 100);
        } catch (Exception error) { try { LocationQueue.get(getContext()).stop(true); } catch (Exception ignored) {} finally { getContext().stopService(new Intent(getContext(), BackgroundLocationService.class)); } call.reject("系统未允许启动后台定位服务，请在前台重试", error); }
    }
    @PluginMethod public void stop(PluginCall call) {
        try { LocationQueue.get(getContext()).stop(Boolean.TRUE.equals(call.getBoolean("clear", true))); getContext().stopService(new Intent(getContext(), BackgroundLocationService.class)); BackgroundLocationService.isRunning = false; call.resolve(statusValue()); }
        catch (Exception error) { call.reject("本机定位队列清除失败", error); }
        finally { getContext().stopService(new Intent(getContext(), BackgroundLocationService.class)); }
    }
    @PluginMethod public void readBatch(PluginCall call) {
        try {
            JSONObject state = LocationQueue.get(getContext()).read(); String owner = call.getString("owner");
            if (owner == null || !owner.equals(state.optString("owner"))) { call.reject("定位队列不属于当前账号"); return; }
            int limit = Math.max(1, Math.min(200, call.getInt("limit", 200))); JSONArray all = state.optJSONArray("samples"), samples = new JSONArray();
            for (int i = 0; i < Math.min(limit, all.length()); i++) samples.put(all.getJSONObject(i));
            JSObject result = new JSObject(); result.put("owner", owner); result.put("generation", state.optString("generation")); result.put("samples", JSArray.from(samples)); result.put("droppedCount", state.optInt("dropped")); call.resolve(result);
        } catch (Exception error) { call.reject("读取定位队列失败", error); }
    }
    @PluginMethod public void ack(PluginCall call) {
        try { LocationQueue.get(getContext()).acknowledge(call.getString("owner"), call.getString("generation"), call.getArray("ids", new JSArray())); call.resolve(); }
        catch (Exception error) { call.reject("旧定位确认已失效，队列未删除", error); }
    }
    @Override protected void handleOnPause() { isForeground = false; }
    @Override protected void handleOnResume() { isForeground = true; }
}
