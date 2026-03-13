package com.ktakahashi.yorimichi.widget;

import android.content.Intent;
import android.widget.RemoteViewsService;

/**
 * ウィジェットの ListView にデータを供給する RemoteViewsService。
 */
public class MemoListRemoteViewsService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new MemoListRemoteViewsFactory(getApplicationContext());
    }
}
