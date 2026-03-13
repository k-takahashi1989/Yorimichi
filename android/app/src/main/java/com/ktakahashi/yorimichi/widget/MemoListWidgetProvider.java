package com.ktakahashi.yorimichi.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import com.ktakahashi.yorimichi.MainActivity;
import com.ktakahashi.yorimichi.R;

import java.util.List;

/**
 * メモ一覧ウィジェットの AppWidgetProvider。
 * ホーム画面にメモの一覧を表示し、タップでアプリ内のメモ詳細画面を開く。
 */
public class MemoListWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_ITEM_CLICK = "com.ktakahashi.yorimichi.WIDGET_ITEM_CLICK";
    public static final String EXTRA_MEMO_ID = "extra_memo_id";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_ITEM_CLICK.equals(intent.getAction())) {
            String memoId = intent.getStringExtra(EXTRA_MEMO_ID);
            if (memoId != null) {
                // ディープリンクでメモ詳細画面を開く
                Intent openIntent = new Intent(Intent.ACTION_VIEW,
                        Uri.parse("yorimichi://open?memoId=" + memoId));
                openIntent.setClass(context, MainActivity.class);
                openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                context.startActivity(openIntent);
            }
        }
    }

    private void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_memo_list);

        // ListView の RemoteViewsService を設定
        Intent serviceIntent = new Intent(context, MemoListRemoteViewsService.class);
        serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        serviceIntent.setData(Uri.parse(serviceIntent.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.widget_list, serviceIntent);
        views.setEmptyView(R.id.widget_list, R.id.widget_empty);

        // リストアイテムのクリックテンプレート
        Intent clickIntent = new Intent(context, MemoListWidgetProvider.class);
        clickIntent.setAction(ACTION_ITEM_CLICK);
        PendingIntent clickPendingIntent = PendingIntent.getBroadcast(
                context, 0, clickIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
        views.setPendingIntentTemplate(R.id.widget_list, clickPendingIntent);

        // 「+」ボタン: 新規メモ作成画面を開く
        Intent addIntent = new Intent(Intent.ACTION_VIEW,
                Uri.parse("yorimichi://open?newMemo=true"));
        addIntent.setClass(context, MainActivity.class);
        addIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent addPendingIntent = PendingIntent.getActivity(
                context, 1, addIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_add_btn, addPendingIntent);

        // ヘッダータイトルタップでアプリを開く
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openAppPendingIntent = PendingIntent.getActivity(
                context, 2, openAppIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_title, openAppPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_list);
    }

    /**
     * 全ウィジェットインスタンスのデータを更新する。
     * JS 側から NativeModule 経由で呼び出される。
     */
    public static void refreshAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(
                new ComponentName(context, MemoListWidgetProvider.class));
        if (ids.length > 0) {
            manager.notifyAppWidgetViewDataChanged(ids, R.id.widget_list);
        }
    }
}
