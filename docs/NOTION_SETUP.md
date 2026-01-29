# Notion連携セットアップガイド

Notion連携を使用すると、以下の追加指標を計測できます：

| 機能 | 説明 | 詳細 |
|------|------|------|
| サイクルタイム | タスク着手〜完了の時間 | [CYCLE_TIME.md](CYCLE_TIME.md) |
| コーディング時間 | タスク着手〜PR作成の時間 | [CODING_TIME.md](CODING_TIME.md) |
| 開発者満足度 | タスク完了時の満足度スコア | [DEVELOPER_SATISFACTION.md](DEVELOPER_SATISFACTION.md) |

## 目次

- [必要なデータベースプロパティ](#必要なデータベースプロパティ)
- [インテグレーションの作成](#1-インテグレーションの作成)
- [データベースへの接続](#2-データベースへの接続)
- [Database IDの取得](#3-database-idの取得)
- [プロパティ名のカスタマイズ](#プロパティ名のカスタマイズ)
- [トラブルシューティング](#トラブルシューティング)

## 必要なデータベースプロパティ

Notionデータベースに以下のプロパティを追加してください：

| プロパティ名 | タイプ | 用途 | 必須 |
|-------------|--------|------|------|
| `Date Started` | Date | タスク着手日時 | サイクルタイム/コーディング時間 |
| `Date Done` | Date | タスク完了日時 | サイクルタイム |
| `Satisfaction` | Number (1-5) | 満足度スコア | 開発者満足度 |
| `PR URL` | URL | GitHub PR リンク | コーディング時間 |

> **Note**: プロパティ名は[カスタマイズ可能](#プロパティ名のカスタマイズ)です。

## 1. インテグレーションの作成

1. [Notion Integrations](https://www.notion.so/profile/integrations) にアクセス
2. 「+ New integration」（または「+ 新しいインテグレーション」）をクリック
3. 以下を設定：
   - **名前**: DevSyncGAS
   - **関連ワークスペース**: 対象のワークスペースを選択
   - **種類**: 内部インテグレーション
4. 「Save」をクリック
5. 「Secrets」セクションの「Show」をクリックし、「Internal Integration Secret」をコピー

## 2. データベースへの接続

1. 計測対象のNotionデータベースを開く
2. 右上の「•••」メニューをクリック
3. 「Add connections」（または「接続先」）を選択
4. 「DevSyncGAS」を検索して選択

> **重要**: この手順を忘れると「データが取得できない」エラーになります。

## 3. Database IDの取得

データベースのURLからIDを取得します：

```
https://www.notion.so/ワークスペース名/【この部分がDATABASE_ID】?v=...
```

取得したら `setup()` 関数の第3・第4引数にNotion設定を渡してください：

```javascript
setup('github_token', 'spreadsheet_id', 'notion_token', 'notion_database_id');
```

## プロパティ名のカスタマイズ

Notionデータベースで異なるプロパティ名を使用している場合、カスタム設定が可能です。

### 設定方法

GASエディタで以下を実行：

```javascript
configureNotionProperties({
  startedDate: "着手日",      // デフォルト: "Date Started"
  completedDate: "完了日",    // デフォルト: "Date Done"
  satisfaction: "満足度",     // デフォルト: "Satisfaction"
  prUrl: "GitHub PR"          // デフォルト: "PR URL"
});
```

### 設定の確認・リセット

```javascript
// 現在の設定を確認
showNotionPropertyNames();

// デフォルトに戻す
resetNotionProperties();
```

> **Note**: 設定しない項目はデフォルト値が使用されます。部分的な設定も可能です。

### 利用可能な関数

| 関数 | 説明 |
|------|------|
| `configureNotionProperties({...})` | プロパティ名をカスタム設定 |
| `showNotionPropertyNames()` | 現在の設定を表示 |
| `resetNotionProperties()` | デフォルトにリセット |

## トラブルシューティング

| 症状 | 原因 | 対処法 |
|------|------|--------|
| 「Notion integration is not configured」 | Token/Database IDが未設定 | `setup()` で正しく設定 |
| データが取得できない | データベースが接続されていない | [手順2](#2-データベースへの接続)でインテグレーションを接続 |
| 日付が取得できない | プロパティ名が異なる | `configureNotionProperties()` でカスタム設定 |
| 時刻が正確でない | Notionの日付設定 | 日付プロパティで「時刻を含める」を有効化 |
| 「Unauthorized」エラー | トークンが無効 | Notion Integrationsでトークンを再生成 |
| 一部のタスクが取得されない | フィルター条件に合わない | 日付プロパティが正しく設定されているか確認 |

## 次のステップ

Notion連携が完了したら、以下の関数でメトリクスを収集できます：

```javascript
// サイクルタイムを計測
syncCycleTime(30);  // 過去30日分

// コーディング時間を計測
syncCodingTime();

// 開発者満足度を計測
syncDeveloperSatisfaction(30);
```
