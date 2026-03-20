import notifee, {
  AndroidImportance,
  AndroidStyle,
  EventType,
  TriggerType,
  TimestampTrigger,
} from '@notifee/react-native';
import i18n from '../i18n';

const CHANNEL_ID = 'shopping-reminder';

/**
 * アプリ起動時に通知チャンネルを作成する (Android 必須)
 */
export async function createNotificationChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Yorimichi',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
}

/**
 * メモの到着通知を表示する
 */
export async function showArrivalNotification(params: {
  memoId: string;
  locationId: string;
  memoTitle: string;
  locationLabel: string;
  itemCount: number;
}): Promise<void> {
  const { memoId, locationId, memoTitle, locationLabel, itemCount } = params;

  await notifee.displayNotification({
    id: `arrival-${memoId}-${locationId}`,
    title: i18n.t('notification.arrivalTitle', { label: locationLabel }),
    body: i18n.t('notification.arrivalBody', { title: memoTitle, count: itemCount }),
    // data はトップレベルに置く (notifee 仕様)
    data: { memoId },
    android: {
      channelId: CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      style: {
        type: AndroidStyle.BIGTEXT,
        text: i18n.t('notification.arrivalBodyBig', { title: memoTitle, count: itemCount }),
      },
      pressAction: {
        id: 'open_memo',
        launchActivity: 'com.ktakahashi.yorimichi.MainActivity',
      },
      smallIcon: 'ic_notification',
      color: '#4CAF50',
    },
  });
}

/**
 * 共有メモ更新のローカル通知を表示する（フォアグラウンド受信時用）
 */
export async function showSharedMemoUpdateNotification(params: {
  shareId: string;
  memoTitle: string;
}): Promise<void> {
  const { shareId, memoTitle } = params;
  await notifee.displayNotification({
    id: `memo-updated-${shareId}`,
    title: `「${memoTitle}」`,
    body: i18n.t('notification.sharedMemoUpdated', { defaultValue: '共有メモが更新されました。タップして確認' }),
    data: { shareId, type: 'memo_updated' },
    android: {
      channelId: CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      pressAction: {
        id: 'open_shared_memo',
        launchActivity: 'com.ktakahashi.yorimichi.MainActivity',
      },
      smallIcon: 'ic_notification',
      color: '#2196F3',
    },
  });
}

/**
 * バックグラウンドの通知イベントリスナーを登録する
 * (index.js で呼び出す)
 */
export function registerBackgroundNotificationHandler(
  onOpenMemo: (memoId: string) => void,
  onOpenSharedMemo?: (shareId: string) => void,
): void {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS && detail.notification?.data) {
      const data = detail.notification.data;
      if (data.type === 'memo_updated' && data.shareId && onOpenSharedMemo) {
        onOpenSharedMemo(data.shareId as string);
      } else if (data.memoId) {
        onOpenMemo(data.memoId as string);
      }
    }
  });
}

/**
 * フォアグラウンドの通知イベントリスナーを登録する
 * (NavigationContainer 内で呼び出す)
 */
export function handleForegroundNotification(
  onOpenMemo: (memoId: string) => void,
  onOpenSharedMemo?: (shareId: string) => void,
): void {
  notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS && detail.notification?.data) {
      const data = detail.notification.data;
      if (data.type === 'memo_updated' && data.shareId && onOpenSharedMemo) {
        onOpenSharedMemo(data.shareId as string);
      } else if (data.memoId) {
        onOpenMemo(data.memoId as string);
      }
    }
  });
}

/**
 * メモの期限日に通知をスケジュールする（期限日の朝9:00）
 */
export async function scheduleDueDateNotification(
  memoId: string,
  title: string,
  dueDate: number,
): Promise<void> {
  // 期限日の朝9:00を算出
  const due = new Date(dueDate);
  const triggerDate = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 9, 0, 0);

  // 過去の日時ならスケジュールしない
  if (triggerDate.getTime() <= Date.now()) return;

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: triggerDate.getTime(),
  };

  await notifee.createTriggerNotification(
    {
      id: `duedate-${memoId}`,
      title: i18n.t('notification.dueDateTitle', { title }),
      body: i18n.t('notification.dueDateBody'),
      data: { memoId },
      android: {
        channelId: CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        smallIcon: 'ic_notification',
        color: '#FF9800',
        pressAction: {
          id: 'open_memo',
          launchActivity: 'com.ktakahashi.yorimichi.MainActivity',
        },
      },
    },
    trigger,
  );
}

/**
 * メモの期限通知をキャンセルする
 */
export async function cancelDueDateNotification(memoId: string): Promise<void> {
  await notifee.cancelNotification(`duedate-${memoId}`);
}
