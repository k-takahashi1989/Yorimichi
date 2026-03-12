# クーポンコード発行手順

> アプリのリリース・ビルドは**不要**です。Firebase Console または Node.js スクリプトから随時発行できます。

---

## 仕組み

| 項目 | 内容 |
|------|------|
| Firestore コレクション | `couponCodes` |
| ドキュメント ID | クーポンコード文字列そのもの（例: `BETA2026`） |
| 有効期間 | `durationDays` フィールドで指定（日数） |
| 一度きり | `used: false` → 使用後 `used: true` に更新（トランザクション） |

ユーザーがプレミアム画面でコードを入力すると、アプリが Firestore トランザクションで以下を検証します:
1. ドキュメントが存在する
2. `used === false`
3. トランザクション内で `used: true` / `usedBy: deviceId` / `usedAt: 現在時刻` を書き込む
4. 成功したら `couponExpiry = 現在時刻 + durationDays日` をローカルに保存

---

## 方法1: Firebase Console（推奨・簡単）

1. [Firebase Console](https://console.firebase.google.com/) を開く
2. プロジェクト **yorimichi-app-dev** を選択
3. 左メニュー → **Firestore Database**
4. コレクション `couponCodes` を開く（存在しない場合は「コレクションを開始」）
5. **「ドキュメントを追加」** をクリック
6. **ドキュメント ID** に発行するコード文字列を入力（例: `BETA2026`）
   - 英数字推奨、大文字小文字を区別する
7. 以下のフィールドを追加:

| フィールド名 | 型 | 値 |
|-------------|----|----|
| `used` | boolean | `false` |
| `durationDays` | number | `30`（30日間有効にする場合） |
| `usedBy` | string | `""` |
| `usedAt` | null | — |

8. **「保存」** → 即時有効

---

## 方法2: Node.js スクリプト（複数コードを一括発行）

### 前提

```bash
# firebase-tools がインストール済みであること（npm install -g firebase-tools）
# ログイン済みであること（firebase login）
```

### スクリプト例

```javascript
// scripts/issue-coupons.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Firebase Console からダウンロード

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 発行するコード一覧
const coupons = [
  { code: 'BETA2026',   durationDays: 30 },
  { code: 'TESTER001',  durationDays: 60 },
  { code: 'PRESS2026',  durationDays: 90 },
];

async function issueCoupons() {
  const batch = db.batch();
  for (const { code, durationDays } of coupons) {
    const ref = db.collection('couponCodes').doc(code);
    batch.set(ref, {
      used: false,
      durationDays,
      usedBy: '',
      usedAt: null,
    });
  }
  await batch.commit();
  console.log(`✅ ${coupons.length}件のクーポンを発行しました`);
}

issueCoupons().catch(console.error);
```

### 実行

```bash
node scripts/issue-coupons.js
```

---

## 使用済みコードの確認

Firebase Console → `couponCodes` コレクションで `used: true` のドキュメントを確認。

| フィールド | 内容 |
|-----------|------|
| `used` | `true` = 使用済み |
| `usedBy` | 使用したデバイスの device ID |
| `usedAt` | 使用日時（Firestore Timestamp） |

---

## コード設計のガイドライン

| 項目 | 推奨 |
|------|------|
| フォーマット | 英大文字 + 数字 8〜12文字（例: `BETA2026`） |
| テスター向け | `TESTER001`, `TESTER002`, ... と連番にすると管理しやすい |
| メディア向け | `PRESS-<媒体名>` で流入元を追跡可能 |
| 期間 | クローズドテスト中は 60〜90 日が目安 |
| 使い捨て | 1コード1デバイスのみ（設計上、再利用不可） |

---

*作成日: 2026年3月8日*
