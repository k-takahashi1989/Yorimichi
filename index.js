/**
 * @format
 * @build-cache-bust 20260301
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundNotificationHandler } from './src/services/notificationService';
import { setBackgroundMessageHandler } from './src/services/fcmService';
import { storage } from './src/storage/mmkvStorage';

// バックグラウンドで通知をタップしたときの処理
// 起動前なのでナビゲーションは使えない → MMKV に memoId を保存し、起動後に AppNavigator.onReady で処理する
registerBackgroundNotificationHandler(
  (memoId) => {
    if (memoId) {
      storage.set('pendingNotificationMemoId', memoId);
    }
  },
  (shareId) => {
    if (shareId) {
      storage.set('pendingNotificationShareId', shareId);
    }
  },
);

// FCM バックグラウンドメッセージハンドラー（共有メモ更新通知用）
// notification フィールド付き FCM は Android が自動表示するが、
// タップ時の画面遷移用に shareId を MMKV に保存しておく。
setBackgroundMessageHandler((data) => {
  if (data && data.type === 'memo_updated' && data.shareId) {
    storage.set('pendingNotificationShareId', data.shareId);
  }
});

AppRegistry.registerComponent(appName, () => App);