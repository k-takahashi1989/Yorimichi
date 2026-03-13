package com.ktakahashi.yorimichi.widget;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * SharedPreferences からメモデータを読み取るヘルパー。
 * JS 側の WidgetBridge が書き込んだ JSON をパースする。
 */
public class WidgetDataHelper {

    private static final String PREFS_NAME = "yorimichi_widget";
    private static final String KEY_MEMOS = "memos_json";

    public static class MemoSummary {
        public final String id;
        public final String title;
        public final int totalItems;
        public final int uncheckedItems;
        public final String locationLabel;  // 最初の場所ラベル (なければ null)
        public final long dueDate;          // 0 = 未設定
        public final boolean isOverdue;
        public final boolean isDueToday;

        public MemoSummary(String id, String title, int totalItems, int uncheckedItems,
                           String locationLabel, long dueDate, boolean isOverdue, boolean isDueToday) {
            this.id = id;
            this.title = title;
            this.totalItems = totalItems;
            this.uncheckedItems = uncheckedItems;
            this.locationLabel = locationLabel;
            this.dueDate = dueDate;
            this.isOverdue = isOverdue;
            this.isDueToday = isDueToday;
        }
    }

    public static List<MemoSummary> getMemos(Context context) {
        List<MemoSummary> result = new ArrayList<>();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_MEMOS, "[]");

        try {
            JSONArray array = new JSONArray(json);
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                result.add(new MemoSummary(
                        obj.getString("id"),
                        obj.getString("title"),
                        obj.optInt("totalItems", 0),
                        obj.optInt("uncheckedItems", 0),
                        obj.optString("locationLabel", null),
                        obj.optLong("dueDate", 0),
                        obj.optBoolean("isOverdue", false),
                        obj.optBoolean("isDueToday", false)
                ));
            }
        } catch (Exception e) {
            // JSON パースエラー時は空リストを返す
        }
        return result;
    }

    public static void saveMemos(Context context, String json) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_MEMOS, json)
                .apply();
    }
}
