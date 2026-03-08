const ja = {
  // ── 共通 ──────────────────────────────────────────────────
  common: {
    cancel: 'キャンセル',
    delete: '削除',
    confirm: '確定',
    error: 'エラー',
    radiusM: '{{radius}}m',
    undo: '元に戻す',
  },

  // ── MemoListScreen ────────────────────────────────────────
  memoList: {
    headerTitle: 'よりみちリスト',
    deleteTitle: 'メモを削除',
    deleteMessage: '「{{title}}」を削除しますか？',
    itemsLeft: '{{unchecked}} / {{total}} 点残り',
    noItems: 'アイテムなし',
    emptyText: 'メモがありません',
    emptySubText: '右上の + ボタンで追加しましょう',
    memoCount: 'メモ {{current}}/{{max}}',
    deleteSwipe: '削除',
    deletedSnack: '「{{title}}」を削除しました',
    completed: '完了',
  },

  // ── MemoEditScreen ────────────────────────────────────────
  memoEdit: {
    screenTitleNew: '新しいメモ',
    screenTitleEdit: 'メモを編集',
    titleLabel: 'タイトル',
    titlePlaceholder: '例: スーパーで買うもの',
    itemsLabel: 'チェックリスト',
    addItemPlaceholder: '+ アイテムを追加',
    doneButton: '確認する',
    unsavedTitle: '編集中の内容があります',
    unsavedMessage: '保存されていない変更があります。破棄しますか？',
    unsavedDiscard: '破棄する',
    errorTitle: 'エラー',
    errorEmptyTitle: 'タイトルを入力してください',
    errorNeedTitleFirst: 'メモタイトルを入力してください',
    errorNeedTitleFirstMsg: 'アイテムを追加する前にタイトルを入力してください',
  },

  // ── MemoDetailScreen ─────────────────────────────────────
  memoDetail: {
    screenTitle: 'メモ詳細',
    notFound: 'メモが見つかりません',
    locationSection: '📍 場所 ({{count}}件)',
    addLocation: '追加',
    locationEmpty: '場所を追加するとそこに近づいたとき通知が来ます',
    showMoreLocations: '他{{count}}件を表示',
    collapseLocations: '折りたたむ',
    itemSection: '📝 チェックリスト',
    itemEmpty: '編集画面でアイテムを追加してください',
    radiusLabel: '半径 {{radius}}m',
    notificationOn: '通知オン',
    notificationOff: '通知オフ',
    deleteLocTitle: '場所を削除',
    deleteLocMessage: '「{{label}}」を削除しますか？',
    uncheckTitle: 'チェックを外しますか？',
    uncheckMessage: '購入日時の記録もクリアされます。',
    uncheckDone: 'チェックを外しました',
    uncheckAll: '全て解除',
    hiddenItems: '{{count}}件完了（タップで表示）',
    allCheckedTitle: '全アイテム完了！',
    allCheckedMessage: 'このメモの通知をオフにしますか？',
  },

  // ── LocationPickerScreen ──────────────────────────────────
  locationPicker: {
    screenTitle: '場所を選択',
    alertNoLocation: '場所を選択してください',
    alertNoLocationMsg: '地図を長押しするか検索で場所を選んでください',
    alertNoLabel: '名前を入力してください',
    alertNoLabelMsg: 'この場所の名前 (例: スーパー) を入力してください',
    alertMaxTitle: '追加できません',
    alertMaxMsg: '登録できる場所の上限に達しています。プレミアムプランにアップグレードすると、より多くの場所を登録できます。',
    markerSelected: '選択中',
    markerRegistered: '登録済み',
    searchPlaceholder: '場所を検索…',
    hintLongPress: '地図を長押しでピン',
    legendSelected: '選択中',
    legendRegistered: '登録済み',
    labelInput: '場所の名前',
    labelPlaceholder: '例: スーパー三和',
    radiusLabel: '通知半径: {{radius}}m',
    saveButton: 'この場所を保存',
    recentTitle: '最近の場所',
    geocodingInProgress: '住所を取得中…',
  },

  // ── SettingsScreen ────────────────────────────────────────
  settings: {
    screenTitle: '⚙️ 設定',
    permCard: {
      title: '通知・位置情報の権限',
      foreground: '現在地の取得',
      background: '位置情報（常に許可）',
      notification: 'プッシュ通知',
      enableButton: '位置情報・通知をオンにする',
      grantedButton: '✅ 許可済み',
    },
    status: {
      on: 'オン',
      off: 'オフ',
      blocked: 'ブロック中',
      unavailable: '利用不可',
      checking: '確認中...',
    },
    monitorCard: {
      title: '位置連動リマインド',
      description:
        'オンにすると登録した場所に近づいたとき通知が届きます。バッテリー消費が増える場合があります。',
      startButton: 'リマインドを開始する',
      stopButton: 'リマインドを停止する',
    },
    defaultRadius: {
      title: 'デフォルト通知半径',
    },
    maxRadius: {
      title: '通知半径の上限',
      description: 'スライダーの上限値を選択してください',
    },
    appInfo: {
      title: 'アプリ情報',
      version: 'バージョン: {{version}}',
      name: 'Yorimichi',
      privacyPolicy: 'プライバシーポリシー',
    },
    alertFineLocation: {
      title: '位置情報の許可が必要です',
      message: '設定 > アプリ > Yorimichi > 位置情報から許可してください',
      openSettings: '設定を開く',
    },
    alertBackground: {
      title: 'バックグラウンド位置情報のアクセス許可',
      message:
        'よりみちは、アプリを閉じているときや使用していないときも、登録した場所への接近通知をお届けするために、バックグラウンドで位置情報を取得します。\n\n設定画面で「常に許可」を選択してください。',
      openSettings: '設定を開く',
    },
    alertMonitor: {
      title: '位置情報の許可が必要です',
      message: '先に位置情報を許可してください',
    },
    alertPermsAlreadyGranted: {
      title: '✅ すでに設定済みです',
      message: '位置情報と通知の許可はすでに有効になっています。',
    },
    alertPermsSuccess: {
      title: '✅ 設定が完了しました',
      message: '位置情報と通知が有効になりました。リマインドを開始できます。',
    },
    langCard: {
      title: '表示言語',
    },
  },

  // ── AppNavigator ──────────────────────────────────────────
  nav: {
    tabList: 'よりみち',
    tabSettings: '設定',
    backButton: '戻る',
    memoDetail: 'メモ詳細',
    memoEditNew: '新しいメモ',
    memoEditExisting: 'メモを編集',
    locationPicker: '場所を選択',
  },

  // ── Tutorial ──────────────────────────────────────────────
  tutorial: {
    skip: 'スキップ',
    next: '次へ',
    ok: 'OK',
    memoEdit: {
      step1: '📝 メモのタイトルを入力しましょう',
      step2: '✏️ アイテムを入力したら＋ボタンでリストに追加できます',
      step3: '✅ 「確認する」で保存。詳細画面で場所を登録すると、近づいたときに通知が届きます！',
    },
    memoDetail: {
      step1: '🔔 ベルマークで通知の ON / OFF を切り替えられます',
    },
    memoDetailShare: {
      step1: '👥 共有ボタンでメモを他の人と共有できます。コードを送るだけで同じリストを見られます',
    },
    memoDetailItems: {
      step1: '☑️ このボタンでアイテムを一括でチェック／解除できます',
      step2: '👁️ チェック済みのアイテムを非表示にして、残りタスクだけに集中できます',
    },
    memoDetailSync: {
      step1: '🔄 共有メモは自動では更新されません。このボタンで最新の内容を取得できます',
    },
  },
  // ── ジオフェンスサービス ─────────────────────────────────
  geofence: {
    taskDesc: '登録した場所に近づくとお知らせします',
  },

  // ── MemoDetailScreen 監視停止警告 ────────────────────────
  memoDetailExtra: {
    monitoringStopped: '⚠️ リマインドが停止中です。設定画面で開始してください。',
  },

  // ── 通知文言 ────────────────────────────────────────────
  notification: {
    arrivalTitle: '📍 {{label}} に近づいています',
    arrivalBody: '「{{title}}」のチェックリスト ({{count}}点) を確認しましょう',
    arrivalBodyBig: '「{{title}}」のチェックリスト ({{count}}点) を確認しましょう\n\nタップしてメモを開く',
    modeTitle: '通知モード',
    modeSilent: 'サイレント',
    modeSilentDesc: '音・バイブなし、通知バーのみ',
    modePush: '通知（標準）',
    modePushDesc: 'バイブ・音あり',
    modeAlarm: 'アラーム',
    modeAlarmDesc: '画面点灯・大音量',
    modeAlarmComingSoon: 'アラーム通知は現在準備中です。近日公開予定です。',
    comingSoon: '（近日公開）',
  },
  // ── 共有機能 ──────────────────────────────────────
  share: {
    button: '共有',
    shareTitle: 'メモを共有',
    shareMessage: 'Yorimichi でメモを共有しましょう！',
    limitReached: '共有は1件まで（無料プラン）',
    limitReachedMsg: '無料プランで共有できるメモは1件までです。共有済みのメモを削除するか、プレミアムにアップグレードしてください',
    importing: 'メモを取り込んでいます...',
    importTitle: 'メモを取り込む',
    importMessage: '「{{title}}」を自分のメモに追加しますか？',
    importConfirm: '追加',
    importSuccess: 'メモを取り込みました',
    importError: 'メモの取り込みに失敗しました',
    notFound: '共有メモが見つかりません（削除済みの可能性があります）',
    presenceBanner: '他のユーザーが編集中...',
    presenceWarning: '他のユーザーが編集中です。上書きされる場合があります',
    syncError: '同期に失敗しました',
    uploadError: '共有の登録に失敗しました',
    importByCode: '共有コードでインポート',
    importByCodePrompt: '共有コードを入力してください',
    shareCodeLabel: '共有コード',
    shareCodeHint: 'アプリの「共有コードでインポート」にこのコードを入力してください',
    importByCodeInvalid: '無効な共有コードです',
    syncButton: '最新に更新',
    syncSuccess: 'メモを最新の状態に更新しました',
    roleOwner: 'オーナー',
    roleCollaborator: 'コラボレーター',
  },
  // ── プレミアムプラン ───────────────────────────────────
  premium: {
    screenTitle: '✨ プレミアムプラン',
    currentFree: '現在のプラン：無料',
    currentPremium: '現在のプラン：プレミアム ✨',
    freePlan: '無料プラン',
    premiumPlan: 'プレミアム',
    upgradeButton: 'プレミアムにアップグレード',
    comingSoon: '（準備中）',
    alreadyPremium: '✅ プレミアムプランを利用中',
    devToggleOn: '[DEV] プレミアムをOFFにする',
    devToggleOff: '[DEV] プレミアムをONにする',
    featureMemos: 'メモ数',
    featureItems: 'アイテム数 / メモ',
    featureLocations: '登録地点数 / メモ',
    featureCollaborators: '共有人数',
    featureAlarm: '通知モード',
    featureAds: '広告',
    freeVal: '5件',
    freeValItems: '10個',
    freeValLocations: '2か所',
    freeValCollaborators: '1対1',
    freeValAlarm: 'サイレント/標準',
    freeValAds: 'あり',
    premiumVal: '無制限',
    premiumValLocations: '最大100か所',
    premiumValAlarm: 'アラーム対応',
    premiumValAds: 'なし',
    startTrialButton: '7日間無料お試しを開始',
    startTrialConfirm: '7日間、プレミアムプランの全機能を無料でお試しいただけます。トライアルは1回限りです。開始しますか？',
    trialActive: 'お試し中 — あと{{days}}日',
    trialExpiredMsg: 'トライアル期間が終了しました。ご利用ありがとうございました。',
  },
  // ── 上限エラー ────────────────────────────────────────────────────
  errors: {
    memoLimitTitle: 'メモの上限に達しました',
    memoLimitMsg: '無料プランでは最大{{count}}件までです。プレミアムプランにアップグレードすると無制限に追加できます。',
    itemLimitTitle: 'アイテムの上限に達しました',
    itemLimitMsg: '無料プランでは1メモあたり最大{{count}}個までです。プレミアムプランにアップグレードすると無制限に追加できます。',
    locationLimitTitle: '地点の上限に達しました',
    locationLimitMsg: '無料プランでは1メモあたり最大{{count}}か所まで登録できます。プレミアムプランでは無制限に追加できます。',
    collaboratorLimitTitle: '参加人数の上限に達しました',
    collaboratorLimitMsg: '無料プランでは1対1（2人）まで共有できます。プレミアムプランにアップグレードするともっと多くのメンバーを招待できます。',
  },
} as const;

export default ja;
export type TranslationKeys = typeof ja;
// Type that requires the same key structure but allows any string values
export type Translation = {
  [K in keyof typeof ja]: (typeof ja)[K] extends string
    ? string
    : {
        [NK in keyof (typeof ja)[K]]: (typeof ja)[K][NK] extends string
          ? string
          : { [NNK in keyof (typeof ja)[K][NK]]: string };
      };
};
