# DevSyncGAS - コマンドリファレンス

日常的に使用するコマンドとGAS関数のクイックリファレンス。

---

## 📦 開発コマンド

### ビルド・デプロイ
```bash
bun run build          # TypeScript → GAS用JSにビルド
bun run push           # ビルド + GASにデプロイ
```

### テスト・品質チェック
```bash
bun test               # テスト実行
bun run lint           # ESLintチェック
bun run lint:fix       # ESLint自動修正
bun run format         # Prettierフォーマット
bun run check:all      # 全チェックを一括実行（循環依存、未使用コード、型カバレッジ）
```

### 完了前の必須チェック
```bash
bunx tsc --noEmit && bun run lint && bun test && bun run build
```

---

## 🔧 GAS関数（診断・確認）

```javascript
// 設定診断
checkConfig()                    // 設定診断（困ったら最初に実行）
testPermissions()                // GitHub API権限テスト
showAuthMode()                   // 認証方式確認（PAT/GitHub Apps）

// 主要な設定表示
showCycleTimeConfig()            // サイクルタイム設定確認
showCodingTimeConfig()           // コーディングタイム設定確認
showLogLevel()                   // ログレベル確認
showSlackConfig()                // Slack通知設定確認

// リポジトリ・プロジェクト管理
listRepos()                      // 登録リポジトリ一覧
addRepo('owner', 'repo-name')    // リポジトリ追加
removeRepo('owner/repo-name')    // リポジトリ削除
listProjects()                   // プロジェクト一覧
```

---

## 📊 GAS関数（データ同期）

```javascript
// 🚀 一括同期（推奨）※引数で日数指定可能（デフォルト: 30日）
syncAllMetrics()                 // 全指標を一括同期（DORA + 拡張指標全部）

// DORA指標同期
syncDevOpsMetrics()              // DORA指標を同期（Dashboard/チャート自動生成）
syncDailyBackfill(30)            // 過去30日分をバックフィル
```

---

## ⚙️ GAS関数（設定変更）

### 初期設定
```javascript
initConfig()  // src/init.ts の設定を PropertiesService に保存
```

> **📝 Note:** 細かい設定（API/ラベル/除外ブランチ/ログレベル等）は `src/init.ts` で設定 → `bun run push` → `initConfig()` で反映。詳細: [init.example.ts](src/init.example.ts)

### Slack通知
```javascript
// 設定
configureSlackWebhook('https://hooks.slack.com/...')
removeSlackWebhook()

// トリガー設定
setupWeeklyReportTrigger()        // 週次（月曜9時）
setupIncidentDailySummaryTrigger() // 日次（毎日18時）
setupAlertTrigger()               // アラート
setupMonthlyReportTrigger()       // 月次

// 手動送信
sendWeeklyReport()
sendIncidentDailySummary()
sendMonthlyReport()
checkAndSendAlerts()

// トリガー削除
removeWeeklyReportTrigger() / removeIncidentDailySummaryTrigger() / removeAlertTrigger() / removeMonthlyReportTrigger()
```

---

## 💡 よくあるパターン

### 設定変更
```bash
src/init.ts 編集 → bun run push → initConfig() → checkConfig()
```

### エラー調査
```javascript
// 1. init.ts でログレベル DEBUG に変更 → push → initConfig()
// 2. 関数実行してログ確認
// 3. エラーコードを Grep で検索 → src/utils/errors.ts 確認
```

### 作業完了チェックリスト
```bash
bunx tsc --noEmit && bun run lint && bun test && bun run build
bun run check:all  # 循環依存、未使用コード、型カバレッジ
/review            # コードレビュー実行
```

詳細: [CLAUDE_TASKS.md](CLAUDE_TASKS.md)