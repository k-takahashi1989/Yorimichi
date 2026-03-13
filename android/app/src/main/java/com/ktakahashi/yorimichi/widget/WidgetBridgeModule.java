package com.ktakahashi.yorimichi.widget;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * JS 側からウィジェットのデータ更新をトリガーする NativeModule。
 * メモの追加・更新・削除時に呼び出す。
 */
public class WidgetBridgeModule extends ReactContextBaseJavaModule {

    public WidgetBridgeModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return "WidgetBridge";
    }

    /**
     * JS 側からメモ一覧の JSON を受け取り、SharedPreferences に保存して
     * ウィジェットを更新する。
     *
     * @param memosJson メモサマリーの JSON 配列文字列
     */
    @ReactMethod
    public void updateWidget(String memosJson) {
        WidgetDataHelper.saveMemos(getReactApplicationContext(), memosJson);
        MemoListWidgetProvider.refreshAllWidgets(getReactApplicationContext());
    }
}
