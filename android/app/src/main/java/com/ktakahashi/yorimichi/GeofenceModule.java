package com.ktakahashi.yorimichi;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;

import androidx.core.app.ActivityCompat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * NativeModule: Android GeofencingClient をラップし、
 * JS 層から syncGeofences / removeGeofencesForMemo / clearAll を呼べるようにする。
 *
 * Java で実装することで Kotlin K2 コンパイラの GMS ジェネリクス型解決問題を回避する。
 *
 * 使用方法 (JS側):
 *   const { YorimichiGeofence } = NativeModules;
 *   await YorimichiGeofence.syncGeofences(JSON.stringify([{ id, latitude, longitude, radius, memoId, notifTitle, notifBody }]));
 */
public class GeofenceModule extends ReactContextBaseJavaModule {

    public static final String PREFS_NAME = "yorimichi_geofence_meta";
    private static final String MODULE_NAME = "YorimichiGeofence";
    /** Android GeofencingClient ハードリミット */
    private static final int MAX_GEOFENCES = 100;

    private GeofencingClient geofencingClient;
    private PendingIntent geofencePendingIntent;

    public GeofenceModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    private synchronized GeofencingClient getGeofencingClient() {
        if (geofencingClient == null) {
            geofencingClient = LocationServices.getGeofencingClient(getReactApplicationContext());
        }
        return geofencingClient;
    }

    private synchronized PendingIntent getGeofencePendingIntent() {
        if (geofencePendingIntent == null) {
            Intent intent = new Intent(getReactApplicationContext(), GeofenceTransitionReceiver.class);
            geofencePendingIntent = PendingIntent.getBroadcast(
                    getReactApplicationContext(),
                    0,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
            );
        }
        return geofencePendingIntent;
    }

    /**
     * 既存のジオフェンスをすべて削除してから、JSON で渡された一覧を新規登録する。
     *
     * @param geofencesJson  JSON array of:
     *   { id, latitude, longitude, radius, memoId, notifTitle, notifBody }
     */
    @ReactMethod
    public void syncGeofences(String geofencesJson, final Promise promise) {
        try {
            JSONArray array = new JSONArray(geofencesJson);
            final List<Geofence> geofences = new ArrayList<>();

            // メタデータ (通知文言) を SharedPreferences に永続化
            SharedPreferences prefs = getReactApplicationContext()
                    .getSharedPreferences(PREFS_NAME, 0);
            SharedPreferences.Editor editor = prefs.edit();

            // 古いメタデータをクリア（stale エントリ防止）
            for (String key : prefs.getAll().keySet()) {
                if (key.startsWith("meta_")) {
                    editor.remove(key);
                }
            }

            for (int i = 0; i < array.length(); i++) {
                if (geofences.size() >= MAX_GEOFENCES) break;
                JSONObject obj = array.getJSONObject(i);
                String id = obj.getString("id");
                float radius = Math.max(50f, (float) obj.getDouble("radius"));
                geofences.add(new Geofence.Builder()
                        .setRequestId(id)
                        .setCircularRegion(
                                obj.getDouble("latitude"),
                                obj.getDouble("longitude"),
                                radius
                        )
                        .setExpirationDuration(Geofence.NEVER_EXPIRE)
                        .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER)
                        .setLoiteringDelay(0)
                        .build()
                );
                editor.putString("meta_" + id, obj.toString());
            }
            editor.apply();

            // まず既存をクリア → その後 addGeofences
            getGeofencingClient().removeGeofences(getGeofencePendingIntent())
                    .addOnCompleteListener(task -> {
                        if (geofences.isEmpty()) {
                            promise.resolve(null);
                            return;
                        }
                        if (ActivityCompat.checkSelfPermission(
                                getReactApplicationContext(),
                                Manifest.permission.ACCESS_FINE_LOCATION
                        ) != PackageManager.PERMISSION_GRANTED) {
                            promise.reject("PERMISSION_DENIED", "Location permission not granted");
                            return;
                        }
                        GeofencingRequest request = new GeofencingRequest.Builder()
                                .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
                                .addGeofences(geofences)
                                .build();
                        getGeofencingClient().addGeofences(request, getGeofencePendingIntent())
                                .addOnSuccessListener(aVoid -> promise.resolve(null))
                                .addOnFailureListener(e -> promise.reject("GEOFENCE_ERROR",
                                        e.getMessage() != null ? e.getMessage() : "Unknown error"));
                    });
        } catch (Exception e) {
            promise.reject("JSON_ERROR",
                    e.getMessage() != null ? e.getMessage() : "Parse error");
        }
    }

    /**
     * 特定メモのジオフェンスを削除する（メモ削除・通知OFF時）。
     */
    @ReactMethod
    public void removeGeofencesForMemo(String memoId, final Promise promise) {
        SharedPreferences prefs = getReactApplicationContext()
                .getSharedPreferences(PREFS_NAME, 0);
        List<String> ids = new ArrayList<>();
        String prefix = "meta_" + memoId + ":";
        for (String key : prefs.getAll().keySet()) {
            if (key.startsWith("meta_") && key.substring("meta_".length()).startsWith(memoId + ":")) {
                ids.add(key.substring("meta_".length()));
            }
        }

        if (ids.isEmpty()) {
            promise.resolve(null);
            return;
        }

        getGeofencingClient().removeGeofences(ids)
                .addOnSuccessListener(aVoid -> {
                    SharedPreferences.Editor editor = prefs.edit();
                    for (String id : ids) {
                        editor.remove("meta_" + id);
                    }
                    editor.apply();
                    promise.resolve(null);
                })
                .addOnFailureListener(e -> promise.reject("GEOFENCE_ERROR",
                        e.getMessage() != null ? e.getMessage() : "Unknown error"));
    }

    /**
     * 通知許可時間帯をグローバル設定として SharedPreferences に保存する。
     * GeofenceTransitionReceiver がジオフェンス発火時にこの値を参照し、
     * 時間帯外なら通知を出さずに return する。
     *
     * @param enabled   時間帯制限を有効にするか
     * @param startHour 開始時刻（float, 例: 8.0=8:00, 8.5=8:30）
     * @param endHour   終了時刻（float, 例: 22.0=22:00）
     */
    @ReactMethod
    public void setNotifWindow(boolean enabled, double startHour, double endHour) {
        getReactApplicationContext()
                .getSharedPreferences(PREFS_NAME, 0)
                .edit()
                .putBoolean("notif_window_enabled", enabled)
                .putFloat("notif_window_start", (float) startHour)
                .putFloat("notif_window_end", (float) endHour)
                .apply();
    }

    /**
     * 登録されているジオフェンスをすべて削除する（監視 OFF 時）。
     */
    @ReactMethod
    public void clearAll(final Promise promise) {
        getGeofencingClient().removeGeofences(getGeofencePendingIntent())
                .addOnSuccessListener(aVoid -> {
                    // SharedPreferences のメタデータもクリア
                    SharedPreferences prefs = getReactApplicationContext()
                            .getSharedPreferences(PREFS_NAME, 0);
                    SharedPreferences.Editor editor = prefs.edit();
                    for (String key : prefs.getAll().keySet()) {
                        if (key.startsWith("meta_")) {
                            editor.remove(key);
                        }
                    }
                    editor.apply();
                    promise.resolve(null);
                })
                .addOnFailureListener(e -> promise.reject("GEOFENCE_ERROR",
                        e.getMessage() != null ? e.getMessage() : "Unknown error"));
    }
}
