package com.catforest.htmlcandidate;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/** 只提升原连接进程优先级；不创建GATT，不负责Activity或进程死亡恢复。 */
public final class BleRetentionService extends Service {
    static final String CHANNEL = "verified_ble_connection";
    private static final String STOP = "com.catforest.htmlcandidate.STOP_BLE_RETENTION";
    private static final int NOTIFICATION_ID = 3801;
    interface Listener { void onServiceReady(); void onServiceStopped(String reason); }
    private static Listener owner;
    private static BleRetentionService running;
    private Listener lease;
    static void start(Activity activity, Listener listener) {
        if (owner != null && owner != listener) owner.onServiceStopped("另一房间接管服务，请手动恢复原设备");
        owner = listener;
        try { activity.startForegroundService(new Intent(activity, BleRetentionService.class)); }
        catch (RuntimeException failure) {
            if (owner == listener) owner = null;
            listener.onServiceStopped("系统未允许启动蓝牙常驻服务，请回前台手动开启");
        }
    }
    static boolean isRunning(Listener listener) { return owner == listener && running != null && running.lease == listener; }
    static void stop(Listener listener) {
        if (owner != listener) return;
        owner = null;
        if (running != null) { running.lease = null; running.stopForeground(STOP_FOREGROUND_REMOVE); running.stopSelf(); }
    }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || STOP.equals(intent.getAction()) || owner == null) {
            stopLease("user_stopped"); return START_NOT_STICKY;
        }
        lease = owner;
        try {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null || !manager.areNotificationsEnabled() ||
                (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)) {
                stopLease("通知权限已关闭，锁屏蓝牙保持已停止"); return START_NOT_STICKY;
            }
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, "锁屏蓝牙连接", NotificationManager.IMPORTANCE_LOW));
            NotificationChannel channel = manager.getNotificationChannel(CHANNEL);
            if (channel == null || channel.getImportance() == NotificationManager.IMPORTANCE_NONE) {
                stopLease("锁屏蓝牙通知已关闭，请恢复通知后手动开启"); return START_NOT_STICKY;
            }
            PendingIntent stop = PendingIntent.getService(this, NOTIFICATION_ID,
                new Intent(this, BleRetentionService.class).setAction(STOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            PendingIntent open = PendingIntent.getActivity(this, NOTIFICATION_ID,
                new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification notification = new Notification.Builder(this, CHANNEL)
                .setContentIntent(open)
                .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
                .setContentTitle("猫咪森活：保持原吧唧蓝牙连接")
                .setContentText("锁屏仅维持原连接，不录音、不结算。可随时停止。")
                .setOngoing(true).setOnlyAlertOnce(true)
                .addAction(new Notification.Action.Builder(null, "停止保持", stop).build()).build();
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
            else startForeground(NOTIFICATION_ID, notification);
            running = this; lease.onServiceReady();
        } catch (RuntimeException failure) { stopLease("蓝牙常驻服务启动失败，请检查附近设备和通知权限后手动恢复"); }
        return START_NOT_STICKY;
    }
    private void stopLease(String reason) {
        Listener previous = lease != null ? lease : owner;
        owner = null; lease = null; stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
        if (previous != null) previous.onServiceStopped(reason);
    }
    @Override public void onTaskRemoved(Intent rootIntent) {
        stopLease("应用任务已移除，原连接已停止，请重新打开手动恢复"); super.onTaskRemoved(rootIntent);
    }
    @Override public void onDestroy() {
        if (running == this) running = null;
        if (lease != null) stopLease("系统已停止蓝牙保持服务，请回前台手动恢复");
        super.onDestroy();
    }
}
