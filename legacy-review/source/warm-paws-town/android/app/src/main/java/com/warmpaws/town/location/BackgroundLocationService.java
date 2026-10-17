package com.warmpaws.town.location;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.*;
import org.json.JSONObject;
import com.warmpaws.town.MainActivity;

/** Started only by a visible Activity after independent background permission. No boot receiver. */
public class BackgroundLocationService extends Service implements LocationListener {
    public static volatile boolean isRunning;
    public static volatile String lastError = "";
    private LocationManager manager;
    private String generation;
    private long lastTime;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable guard = new Runnable() {
        @Override public void run() { if (!allowed()) { stopAndClear(); return; } try { LocationQueue.get(BackgroundLocationService.this).read(); } catch (Exception error) { lastError = "Location storage unavailable"; stopAndClear(); return; } handler.postDelayed(this, 60000); }
    };
    boolean allowed() {
        boolean foreground = checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        return foreground && (Build.VERSION.SDK_INT < 29 || checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED);
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP".equals(intent.getAction())) { stopAndClear(); return START_NOT_STICKY; }
        if (intent == null || !allowed()) { stopAndClear(); return START_NOT_STICKY; }
        String requested = intent.getStringExtra("generation");
        try { JSONObject state = LocationQueue.get(this).read(); if (!state.optBoolean("enabled") || !state.optString("generation").equals(requested)) { return START_NOT_STICKY; } }
        catch (Exception error) { lastError = "Location storage unavailable"; stopAndClear(); return START_NOT_STICKY; }
        generation = requested;
        NotificationManager notifications = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) notifications.createNotificationChannel(new NotificationChannel("life-location", "生活轨迹记录", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "life-location") : new Notification.Builder(this);
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, BackgroundLocationService.class).setAction("STOP"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "停止并清除待处理位置", stop).setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("暖爪小镇正在记录生活轨迹").setContentText("位置仅留本机七天；打开应用可停止并清除").setContentIntent(open).setOngoing(true).build();
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(4101, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION); else startForeground(4101, notification);
            manager = (LocationManager) getSystemService(LOCATION_SERVICE); manager.removeUpdates(this);
            boolean subscribed = false;
            if (manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) { manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 60000, 0, this, Looper.getMainLooper()); subscribed = true; }
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED && manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) { manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 60000, 0, this, Looper.getMainLooper()); subscribed = true; }
            if (!subscribed) throw new IllegalStateException("System location providers disabled");
            isRunning = true; lastError = ""; handler.removeCallbacks(guard); handler.post(guard);
        } catch (SecurityException error) { lastError = "Location permission revoked"; stopAndClear(); }
        catch (Exception error) { lastError = "Cannot start location service: " + error.getClass().getSimpleName(); stopAndClear(); }
        // OS kill/force-stop does not silently revive collection or claim uninterrupted coverage.
        return START_NOT_STICKY;
    }
    @Override public void onLocationChanged(Location location) {
        if (!isRunning || !allowed()) { stopAndClear(); return; }
        boolean isMock = Build.VERSION.SDK_INT >= 31 ? location.isMock() : location.isFromMockProvider();
        long time = location.getTime(), now = System.currentTimeMillis();
        if (time > now || time <= now - 7L * 86400000L || time <= lastTime) return;
        if (isMock || !location.hasAccuracy() || location.getAccuracy() < 0 || location.getAccuracy() > 150) {
            lastError = isMock ? "Mock location ignored" : "Location accuracy insufficient; interval unknown";
            try { JSONObject barrier = new JSONObject(); barrier.put("timestamp", time); barrier.put("isMock", isMock); barrier.put("isContinuityBreak", true); LocationQueue.get(this).append(generation, barrier); }
            catch (Exception error) { stopAndClear(); }
            return;
        }
        if (lastTime > 0 && time - lastTime < 60000) return;
        try {
            JSONObject sample = new JSONObject(); sample.put("isMock", false); sample.put("timestamp", time);
            JSONObject coords = new JSONObject(); coords.put("latitude", location.getLatitude()); coords.put("longitude", location.getLongitude()); coords.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : JSONObject.NULL); sample.put("coords", coords);
            if (LocationQueue.get(this).append(generation, sample)) lastTime = time;
        } catch (Exception error) { lastError = "Location persistence failed; collection stopped"; stopAndClear(); }
    }
    private void stopAndClear() { isRunning = false; try { LocationQueue.get(this).stop(true); } catch (Exception ignored) {} stopSelf(); }
    @Override public void onDestroy() { isRunning = false; handler.removeCallbacks(guard); if (manager != null) try { manager.removeUpdates(this); } catch (SecurityException ignored) {} stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy(); }
    @Override public void onProviderDisabled(String provider) { lastError = "System location provider disabled"; }
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Override public IBinder onBind(Intent intent) { return null; }
}
