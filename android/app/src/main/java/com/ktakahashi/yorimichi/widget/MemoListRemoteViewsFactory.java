package com.ktakahashi.yorimichi.widget;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import com.ktakahashi.yorimichi.R;

import java.util.ArrayList;
import java.util.List;

/**
 * ウィジェットの ListView 各行を構築する Factory。
 */
public class MemoListRemoteViewsFactory implements RemoteViewsService.RemoteViewsFactory {

    private final Context context;
    private List<WidgetDataHelper.MemoSummary> memos = new ArrayList<>();

    public MemoListRemoteViewsFactory(Context context) {
        this.context = context;
    }

    @Override
    public void onCreate() {}

    @Override
    public void onDataSetChanged() {
        memos = WidgetDataHelper.getMemos(context);
    }

    @Override
    public void onDestroy() {
        memos.clear();
    }

    @Override
    public int getCount() {
        return memos.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
        if (position >= memos.size()) return null;

        WidgetDataHelper.MemoSummary memo = memos.get(position);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_memo_list_item);

        // タイトル
        views.setTextViewText(R.id.item_title, memo.title);

        // アイテム数
        if (memo.totalItems > 0) {
            String countText = memo.uncheckedItems + " / " + memo.totalItems;
            views.setTextViewText(R.id.item_count, countText);
            views.setViewVisibility(R.id.item_count, View.VISIBLE);
            // 全完了は緑、それ以外はグレー
            views.setTextColor(R.id.item_count,
                    memo.uncheckedItems == 0 ? Color.parseColor("#4CAF50") : Color.parseColor("#9E9E9E"));
        } else {
            views.setViewVisibility(R.id.item_count, View.GONE);
        }

        // サブ情報行 (場所 + 期限)
        boolean hasLocation = memo.locationLabel != null && !memo.locationLabel.isEmpty();
        boolean hasDueDate = memo.dueDate > 0;

        if (hasLocation || hasDueDate) {
            views.setViewVisibility(R.id.item_sub_row, View.VISIBLE);

            // 場所
            if (hasLocation) {
                views.setTextViewText(R.id.item_location, "📍 " + memo.locationLabel);
                views.setViewVisibility(R.id.item_location, View.VISIBLE);
            } else {
                views.setViewVisibility(R.id.item_location, View.GONE);
            }

            // 期限
            if (hasDueDate) {
                java.util.Calendar cal = java.util.Calendar.getInstance();
                cal.setTimeInMillis(memo.dueDate);
                String dateStr = (cal.get(java.util.Calendar.MONTH) + 1) + "/" + cal.get(java.util.Calendar.DAY_OF_MONTH);

                if (memo.isOverdue) {
                    views.setTextViewText(R.id.item_due_date,
                            context.getString(R.string.widget_due_overdue, dateStr));
                    views.setTextColor(R.id.item_due_date, Color.parseColor("#EF5350"));
                } else if (memo.isDueToday) {
                    views.setTextViewText(R.id.item_due_date,
                            context.getString(R.string.widget_due_today));
                    views.setTextColor(R.id.item_due_date, Color.parseColor("#FF9800"));
                } else {
                    views.setTextViewText(R.id.item_due_date, "📅 " + dateStr);
                    views.setTextColor(R.id.item_due_date, Color.parseColor("#9E9E9E"));
                }
                views.setViewVisibility(R.id.item_due_date, View.VISIBLE);
            } else {
                views.setViewVisibility(R.id.item_due_date, View.GONE);
            }
        } else {
            views.setViewVisibility(R.id.item_sub_row, View.GONE);
        }

        // クリックインテント（memoId をセット）
        Intent fillInIntent = new Intent();
        fillInIntent.putExtra(MemoListWidgetProvider.EXTRA_MEMO_ID, memo.id);
        views.setOnClickFillInIntent(R.id.item_root, fillInIntent);

        return views;
    }

    @Override
    public RemoteViews getLoadingView() {
        return null;
    }

    @Override
    public int getViewTypeCount() {
        return 1;
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public boolean hasStableIds() {
        return false;
    }
}
