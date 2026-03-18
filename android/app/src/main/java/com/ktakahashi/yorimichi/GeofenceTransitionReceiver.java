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
    private static final String CHANNEL_ID_SILENT = "shopping-reminder-silent";
    private static final String CHANNEL_NAME_SILENT = "Yorimichi サイレント";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        GeofencingEvent geofencingEvent = GeofencingEvent.fromIntent(intent);
        if (geofencingEvent == null) return;
        if (geofencingEvent.hasError()) return;

        int transition = geofencingEvent.getGeofenceTransition();
        if (transition != Geofence.GEOFENCE_TRANSITION_ENTER
                && transition != Geofence.GEOFENCE_TRANSITION_EXIT) return;

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
                // triggerType と実際の transition が一致する場合のみ通知
                String triggerType = meta.optString("triggerType", "enter");
                boolean isEnter = transition == Geofence.GEOFENCE_TRANSITION_ENTER;
                if (isEnter && !"enter".equals(triggerType)) continue;
                if (!isEnter && !"exit".equals(triggerType)) continue;
                sendNotification(
                        context,
                        id,
                        meta.optString("memoId", ""),
                        meta.optString("notifTitle", "Yorimichi"),
                        meta.optString("notifBody", ""),
                        meta.optString("notificationMode", "push")
                );
            } catch (Exception ignored) {
                // メタデータが破損している場合は無視
            }
        }
    }

    private void sendNotification(Context context, String geofenceId, String memoId,
                                  String notifTitle, String notifBody, String notificationMode) {

        // ── 通知許可時間帯チェック ────────────────────────────────
        android.content.SharedPreferences windowPrefs =
                context.getSharedPreferences(GeofenceModule.PREFS_NAME, 0);
        if (windowPrefs.getBoolean("notif_window_enabled", false)) {
            java.util.Calendar cal = java.util.Calendar.getInstance();
            float currentHour = cal.get(java.util.Calendar.HOUR_OF_DAY)
                    + cal.get(java.util.Calendar.MINUTE) / 60.0f;
            float start = windowPrefs.getFloat("notif_window_start", 0.0f);
            float end   = windowPrefs.getFloat("notif_window_end",   24.0f);
            boolean inWindow;
            if (start < end) {
                // 通常帯（例: 8:00〜22:00）
                inWindow = currentHour >= start && currentHour < end;
            } else {
                // 深夜跨ぎ（例: 22:00〜7:00）
                inWindow = currentHour >= start || currentHour < end;
            }
            if (!inWindow) return; // 時間帯外は通知しない
        }
        // ─────────────────────────────────────────────────────────

        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        boolean isSilent = "silent".equals(notificationMode);
        String channelId = isSilent ? CHANNEL_ID_SILENT : CHANNEL_ID;

        // Android O+ ではチャンネルが必須（notifee が作成済みなら no-op）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (isSilent) {
                NotificationChannel silentCh = new NotificationChannel(
                        CHANNEL_ID_SILENT, CHANNEL_NAME_SILENT, NotificationManager.IMPORTANCE_LOW);
                silentCh.enableVibration(false);
                silentCh.setSound(null, null);
                manager.createNotificationChannel(silentCh);
            } else {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
                channel.enableVibration(true);
                manager.createNotificationChannel(channel);
            }
        }

        // タップ時にアプリを開き、ディープリンクでメモ詳細画面へ遷移する
        // ACTION_VIEW + URI にすることで React Native の Linking API が正しく受け取れる
        Intent launchIntent = new Intent(Intent.ACTION_VIEW,
                android.net.Uri.parse("yorimichi://open?memoId=" + memoId));
        launchIntent.setClass(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pi = PendingIntent.getActivity(
                context,
                memoId.hashCode(),
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        androidx.core.app.NotificationCompat.Builder builder =
                new NotificationCompat.Builder(context, channelId)
                        .setSmallIcon(getNotificationIcon(context))
                        .setContentTitle(notifTitle)
                        .setContentText(notifBody)
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(notifBody))
                        .setPriority(isSilent ? NotificationCompat.PRIORITY_LOW : NotificationCompat.PRIORITY_HIGH)
                        .setAutoCancel(true)
                        .setContentIntent(pi)
                        .setColor(0xFF4CAF50);

        if (isSilent) {
            builder.setSilent(true);
        }

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
