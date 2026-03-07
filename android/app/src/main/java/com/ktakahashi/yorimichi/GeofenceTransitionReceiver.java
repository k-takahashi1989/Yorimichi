package com.ktakahashi.yorimichi;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;

import org.json.JSONObject;

import java.util.List;

/**
 * ジオフェンス進入イベントを受け取り、即座にプッシュ通知を発行する BroadcastReceiver。
 *
 * アプリが killed 状態でも動作する。通知文言は GeofenceModule が SharedPreferences に
 * 保存したメタデータ (notifTitle / notifBody) から取得する。
 *
 * Java で実装することで Kotlin K2 コンパイラの GMS 型パラメータ解決問題を回避する。
 */
@SuppressWarnings("deprecation")
public class GeofenceTransitionReceiver extends BroadcastReceiver {

    private static final String CHANNEL_ID = "shopping-reminder";
    private static final String CHANNEL_NAME = "Yorimichi";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        GeofencingEvent geofencingEvent = GeofencingEvent.fromIntent(intent);
        if (geofencingEvent == null) return;
        if (geofencingEvent.hasError()) return;

        int transition = geofencingEvent.getGeofenceTransition();
        if (transition != Geofence.GEOFENCE_TRANSITION_ENTER) return;

        android.content.SharedPreferences prefs =
                context.getSharedPreferences(GeofenceModule.PREFS_NAME, 0);

        List<Geofence> triggered = geofencingEvent.getTriggeringGeofences();
        if (triggered == null) return;

        for (Geofence geofence : triggered) {
            String id = geofence.getRequestId();
            String metaJson = prefs.getString("meta_" + id, null);
            if (metaJson == null) continue;
            try {
                JSONObject meta = new JSONObject(metaJson);
                sendNotification(
                        context,
                        id,
                        meta.optString("memoId", ""),
                        meta.optString("notifTitle", "Yorimichi"),
                        meta.optString("notifBody", "")
                );
            } catch (Exception ignored) {
                // メタデータが破損している場合は無視
            }
        }
    }

    private void sendNotification(Context context, String geofenceId, String memoId,
                                  String notifTitle, String notifBody) {
        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        // Android O+ ではチャンネルが必須（notifee が作成済みなら no-op）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
            channel.enableVibration(true);
            manager.createNotificationChannel(channel);
        }

        // タップ時にアプリを開き、memoId を Extra として渡す
        Intent launchIntent = context.getPackageManager()
                .getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent == null) return;
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launchIntent.putExtra("memoId", memoId);

        PendingIntent pi = PendingIntent.getActivity(
                context,
                memoId.hashCode(),
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        androidx.core.app.NotificationCompat.Builder builder =
                new NotificationCompat.Builder(context, CHANNEL_ID)
                        .setSmallIcon(getNotificationIcon(context))
                        .setContentTitle(notifTitle)
                        .setContentText(notifBody)
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(notifBody))
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setAutoCancel(true)
                        .setContentIntent(pi)
                        .setColor(0xFF4CAF50);

        // 通知 ID: geofenceId のハッシュ（同一場所の重複通知を防ぐ）
        manager.notify(("arrival-" + geofenceId).hashCode(), builder.build());
    }

    /**
     * ic_notification drawable があればそれを使用、なければランチャーアイコンにフォールバック。
     */
    private int getNotificationIcon(Context context) {
        int res = context.getResources().getIdentifier(
                "ic_notification", "drawable", context.getPackageName());
        return res != 0 ? res : android.R.drawable.ic_dialog_info;
    }
}
