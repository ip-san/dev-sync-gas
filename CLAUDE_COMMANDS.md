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

// リポジトリ・プロジェクト一覧
listRepos()                      // 登録リポジトリ一覧
listProjects()                   // プロジェクト一覧
```

---

## 📊 GAS関数（データ同期）

```javascript
// 🚀 一括同期（推奨）※引数で日数指定可能（デフォルト: 30日）
syncAllMetrics()                 // 全指標を一括同期（DORA + 拡張指標全部、履歴データ含む）

// DORA指標のみ同期（通常は syncAllMetrics を使用）
syncDevOpsMetrics()              // DORA指標を同期（Dashboard/チャート自動生成）
```

---

## ⚙️ GAS関数（設定変更）

### 初期設定
```javascript
initConfig()  // src/init.ts の設定を PropertiesService に保存
```

> **📝 Note:** すべての設定（プロジェクト、リポジトリ、API、ラベル、除外ブランチ、ログレベル、Slack Webhook、トリガー等）は `src/init.ts` で設定 → `bun run push` → `initConfig()` で反映。詳細: [init.example.ts](src/init.example.ts)

### Slack通知（手動送信テスト用）
```javascript
sendWeeklyReport()               // 週次レポート
sendIncidentDailySummary()       // 日次サマリー
sendMonthlyReport()              // 月次レポート
checkAndSendAlerts()             // アラート確認
```

> **💡 Tip:** トリガー設定は GAS エディタの「トリガー」メニューから行うか、init.ts で設定してデプロイしてください。

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