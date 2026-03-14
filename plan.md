# E2Eテスト設計プラン (Maestro + pre-commit)

## 概要
Maestroを使ったE2Eテストを導入し、コミット前に毎回自動実行する仕組みを構築する。

---

## Step 1: Maestroセットアップ

- `maestro/` ディレクトリを作成
- Maestro設定ファイル (`maestro/config.yaml`) を追加
- `package.json` に `e2e` スクリプトを追加

## Step 2: testID の追加

各画面の主要UI要素に `testID` を付与する（Maestroは `testID` でも テキストでも要素検出可能だが、testIDの方が安定）。

対象画面と追加するtestID:

| 画面 | 要素 | testID |
|------|------|--------|
| MemoList | 追加ボタン | `memo-add-button` |
| MemoList | メモカード | `memo-card-{index}` |
| MemoList | シェアコード入力ボタン | `share-import-button` |
| MemoEdit | タイトル入力 | `memo-title-input` |
| MemoEdit | アイテム入力 | `memo-item-input` |
| MemoEdit | アイテム追加ボタン | `memo-item-add-button` |
| MemoEdit | 完了ボタン | `memo-done-button` |
| MemoEdit | ノート入力 | `memo-note-input` |
| MemoDetail | 編集ボタン | `memo-edit-button` |
| MemoDetail | 場所追加ボタン | `location-add-button` |
| MemoDetail | チェックボックス | `checklist-item-{index}` |
| MemoDetail | 全チェックボタン | `check-all-button` |
| MemoDetail | シェアボタン | `memo-share-button` |
| LocationPicker | 検索入力 | `location-search-input` |
| LocationPicker | ラベル入力 | `location-label-input` |
| LocationPicker | 保存ボタン | `location-save-button` |
| LocationPicker | 半径スライダー | `radius-slider` |
| Settings | 監視開始/停止ボタン | `monitor-toggle-button` |
| Settings | デフォルト半径スライダー | `default-radius-slider` |
| BadgeList | カテゴリタブ | `badge-tab-{category}` |
| Premium | 購入ボタン | `purchase-button` |

## Step 3: Maestroテストフロー作成

### 3-1. スモークテスト（必ずコミット前に実行）
高速で基本動線の動作確認。約1-2分で完了を目標。

```
maestro/flows/
├── smoke/
│   ├── 01_app_launch.yaml          # アプリ起動・メモ一覧表示
│   ├── 02_create_memo.yaml         # メモ作成→一覧に表示確認
│   ├── 03_edit_memo.yaml           # メモ編集（タイトル変更・アイテム追加）
│   ├── 04_checklist_toggle.yaml    # チェックリスト操作
│   ├── 05_delete_memo.yaml         # メモ削除
│   └── 06_settings_navigation.yaml # 設定画面遷移
```

### 3-2. フルテスト（手動実行 or CI）
全画面フローの網羅テスト。

```
maestro/flows/
├── full/
│   ├── memo_crud.yaml              # メモCRUD全操作
│   ├── location_picker.yaml        # 場所選択フロー（検索・ラベル・半径・保存）
│   ├── checklist_operations.yaml   # チェックリスト全操作（個別/全/表示切替）
│   ├── share_flow.yaml             # シェアコード生成・インポート
│   ├── settings_all.yaml           # 設定画面全操作
│   ├── badge_list.yaml             # バッジ一覧表示・カテゴリ切替
│   ├── premium_screen.yaml         # プレミアム画面表示
│   ├── deep_link_navigation.yaml   # 画面遷移（タブ・スタック・戻る）
│   └── due_date_flow.yaml          # 期限設定・表示確認
```

## Step 4: pre-commit フック設定

Huskyを導入し、コミット前にスモークテストを自動実行する。

```
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Unit tests
npx jest --bail --silent

# E2E smoke tests (Maestro)
maestro test maestro/flows/smoke/
```

**注意**: Maestroはエミュレータ/実機が必要。エミュレータ未起動時はスキップするロジックを入れる。

```bash
# エミュレータ起動チェック
if adb devices | grep -q "emulator"; then
  maestro test maestro/flows/smoke/
else
  echo "⚠️  Emulator not running - skipping E2E tests"
fi
```

## Step 5: package.json スクリプト追加

```json
{
  "scripts": {
    "e2e": "maestro test maestro/flows/smoke/",
    "e2e:full": "maestro test maestro/flows/full/",
    "prepare": "husky"
  }
}
```

---

## テストシナリオ詳細

### スモークテスト（コミット前に毎回実行）

**01_app_launch.yaml**
- アプリ起動
- メモ一覧画面が表示されることを確認

**02_create_memo.yaml**
- `+` ボタンタップ → MemoEdit画面へ
- タイトル入力（"E2Eテストメモ"）
- アイテム追加（"牛乳", "パン"）
- 完了ボタンタップ → MemoDetail画面へ
- タイトルが表示されていることを確認
- 戻る → 一覧にメモが表示されていることを確認

**03_edit_memo.yaml**
- 作成したメモをタップ → MemoDetail
- 編集ボタンタップ → MemoEdit
- タイトル変更（"E2Eテストメモ 更新"）
- アイテム追加（"卵"）
- 完了 → タイトル更新確認

**04_checklist_toggle.yaml**
- メモ詳細を開く
- アイテムをタップしてチェック
- 全チェックボタンをタップ
- 完了スタンプが表示されることを確認

**05_delete_memo.yaml**
- メモ一覧で削除アイコンタップ
- 確認ダイアログでOK
- メモが一覧から消えることを確認

**06_settings_navigation.yaml**
- 設定タブをタップ
- 設定画面が表示されることを確認
- メモ一覧タブに戻る

---

## 実装順序

1. **testID追加** - 各画面コンポーネントに testID を追加（コード変更）
2. **Maestroフロー作成** - smoke テストの YAML を作成
3. **Husky + pre-commit** - フック設定
4. **動作確認** - エミュレータでスモークテスト実行確認
5. **フルテスト作成** - 追加フローを段階的に作成
