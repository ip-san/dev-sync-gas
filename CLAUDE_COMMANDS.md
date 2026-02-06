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
showAuthMode()                   // 認証方式確認（PAT/GitHub Apps）
showApiMode()                    // API選択確認（GraphQL/REST）
showLogLevel()                   // ログレベル確認
showExcludeLabels()              // 除外ラベル確認
showIncidentLabels()             // インシデントラベル確認
showSlackConfig()                // Slack通知設定確認

// リポジトリ管理
listRepos()                      // 登録リポジトリ一覧
addRepo('owner', 'repo-name')    // リポジトリ追加
removeRepo('owner/repo-name')    // リポジトリ削除
```

---

## 📊 GAS関数（データ同期）

```javascript
// メイン同期
syncDevOpsMetrics()              // DORA指標を同期（Dashboard/チャート自動生成）
syncDailyBackfill(30)            // 過去30日分をバックフィル
syncAllProjects()                // 全プロジェクトを同期

// 個別指標同期
syncCycleTime(30)                // サイクルタイム（過去30日）
syncCodingTime(30)               // コーディング時間（過去30日）
syncReworkRate(30)               // 手戻り率（過去30日）
syncReviewEfficiency(30)         // レビュー効率（過去30日）
syncPRSize(30)                   // PRサイズ（過去30日）
```

---

## ⚙️ GAS関数（設定変更）

### 初期設定
```javascript
initConfig()                     // src/init.ts の設定を PropertiesService に保存
```

### API設定
```javascript
configureApiMode('graphql')      // GraphQL API使用（デフォルト）
configureApiMode('rest')         // REST API使用
```

### ラベル設定
```javascript
configureExcludeLabels(['exclude-metrics', 'bot'])    // 除外ラベル設定
resetExcludeLabelsConfig()                            // 除外ラベルをデフォルトに戻す
configureIncidentLabels(['incident', 'bug', 'p0'])    // インシデントラベル設定
resetIncidentLabelsConfig()                           // インシデントラベルをデフォルトに戻す
```

### PRサイズ設定
```javascript
// デプロイ用PRを除外（部分一致）
configurePRSizeExcludeBranches(['production', 'staging'])
showPRSizeExcludeBranches()                           // 現在の設定を確認
resetPRSizeExcludeBranchesConfig()                    // 設定をリセット（全PR対象）

// 例: productionブランチへのマージを除外
// - "production" → 除外
// - "production-hotfix" → 除外（部分一致）
// - "main" → 含める
```

### ログ設定
```javascript
configureLogLevel('DEBUG')       // ログレベル: DEBUG
configureLogLevel('INFO')        // ログレベル: INFO（デフォルト）
configureLogLevel('WARN')        // ログレベル: WARN
configureLogLevel('ERROR')       // ログレベル: ERROR
resetLogLevelConfig()            // ログレベルをデフォルト（INFO）に戻す
```

### Slack通知設定
```javascript
configureSlackWebhook('https://hooks.slack.com/...')  // Slack Webhook URL設定
removeSlackWebhook()                                  // Slack通知を無効化

// 週次レポートトリガー（月曜9時）
setupWeeklyReportTrigger()
showWeeklyReportTrigger()
removeWeeklyReportTrigger()
sendWeeklyReport()               // 手動送信（テスト用）

// インシデント日次サマリートリガー（毎日18時）
setupIncidentDailySummaryTrigger()
showIncidentDailySummaryTrigger()
removeIncidentDailySummaryTrigger()
sendIncidentDailySummary()       // 手動送信（テスト用）
```

---

## 💡 よくあるパターン

### エラー調査の流れ
```javascript
// 1. ログレベルをDEBUGに変更
configureLogLevel('DEBUG');

// 2. 問題の関数を実行
syncDevOpsMetrics();

// 3. ログを確認してエラーコードを特定

// 4. Grep tool でエラーコードを検索（例: "GITHUB_RATE_LIMIT"）

// 5. src/utils/errors.ts でエラー詳細を確認
```

### 作業完了チェックリスト
- [ ] 型エラーなし: `bunx tsc --noEmit`
- [ ] Lint通過: `bun run lint`
- [ ] テスト通過: `bun test`
- [ ] ビルド成功: `bun run build`
- [ ] 全チェック通過: `bun run check:all`
- [ ] `/review` 実行済み
- [ ] 必要に応じてドキュメント更新

### 設計判断の記録

| 規模 | 記録先 | 例 |
|------|--------|-----|
| 小（バグ修正、軽微な改善） | コミットメッセージ | "fix: 日付フォーマットのバグを修正" |
| 中（機能追加、リファクタリング） | PR Description | "feat: Slack通知機能の追加" |
| 大（アーキテクチャ変更、技術選定） | [docs/adr/](docs/adr/) | "ADR-0003: スプレッドシート構造の変更" |

**ADR作成手順**: [docs/adr/README.md](docs/adr/README.md)
