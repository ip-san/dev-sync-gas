# DevSyncGAS - コマンドリファレンス

**📌 このドキュメントは:** 日常的に使用する「よく使うコマンド」と「よく使うGAS関数」のクイックリファレンスです。

**🎯 このドキュメントの役割:**
- **開発コマンド** - `bun run build`, `bun test` 等、開発時に頻繁に使うコマンド
- **GAS関数（概要）** - `checkConfig()`, `syncAllMetrics(30)` 等、よく使うGAS関数の概要

**📚 関連ドキュメント:**
- **全GAS関数の詳細:** 引数、戻り値、実行方法は [docs/GAS_FUNCTIONS.md](docs/GAS_FUNCTIONS.md) を参照
- **タスク別フロー:** 機能追加、バグ修正等のフローは [CLAUDE_TASKS.md](CLAUDE_TASKS.md) を参照

**💡 使い分け:**
- 日常的に使うコマンドを確認したい → **このドキュメント**
- GAS関数の詳細な使い方を知りたい → [docs/GAS_FUNCTIONS.md](docs/GAS_FUNCTIONS.md)

---

## 📦 開発コマンド

### ビルド・デプロイ
```bash
bun run build          # TypeScript → GAS用JSにビルド
bun run push           # ビルド + GASにデプロイ
```

### テスト・品質チェック
```bash
bun test                # テスト実行
bun run lint            # Biome lintチェック
bun run lint:fix        # Biome lint自動修正
bun run format          # Biomeフォーマット
bun run check           # Biome check（lint + format一括）
bun run check:fix       # Biome check + 自動修正
bun run check:all       # 全チェックを一括実行（Biome + 循環依存 + knip + 型カバレッジ + tsc）
bun run check:unused    # 未使用コード検出（knip）
bun run cpd             # コピペ検出（jscpd）
```

### ワンコマンド便利スクリプト
```bash
bun run precommit      # コミット前の最小チェック（lint + test）
bun run prepush        # プッシュ前の完全チェック（check:all + test + build）
bun run deploy         # 完全チェック後にデプロイ（prepush + push）
```

---

## 🔧 GAS関数（診断・確認）

```javascript
// 設定診断
checkConfig()                    // 設定診断（リポジトリ・プロジェクト一覧を含む、困ったら最初に実行）
testPermissions()                // GitHub API権限テスト
showAuthMode()                   // 認証方式確認（PAT/GitHub Apps）

// リポジトリ一覧
listRepos()                      // 登録リポジトリ一覧

// プロジェクト別設定の確認
getInitialSyncDaysForRepository('owner', 'repo')    // 初回同期日数
getHealthThresholdsForRepository('owner', 'repo')   // 健全性判定閾値
getExcludeMetricsLabelsForRepository('owner', 'repo') // 除外ラベル

// グローバル設定の確認
getSheetNames()                  // シート名設定（JSON形式）
getAuditLogSheetName()           // 監査ログシート名

// 🔍 メトリクス診断ツール
debugDeploymentFrequency('owner', 'repo')        // デプロイ頻度の診断（なぜyearlyになるのか等）
debugDeploymentFrequency('owner', 'repo', 90)    // 過去90日間で診断
debugCycleTimeForIssue('owner', 'repo', 123)     // Issue #123のサイクルタイム追跡診断
```

---

## 📊 GAS関数（データ同期）

```javascript
// 🚀 メトリクス同期
syncAllMetrics(30)               // 全指標同期（DORA+拡張、過去30日分）
syncAllMetricsIncremental()      // 差分更新（前回同期以降のデータのみ、定期実行用）
syncAllMetricsFromScratch(30)    // 完全再構築（既存シートをクリアして再同期）
```

---

## ⚙️ GAS関数（設定変更）

### 初期設定
```javascript
initConfig()  // src/init.ts の設定を PropertiesService に保存
```

> **📝 Note:** すべての設定（プロジェクト、リポジトリ、API、ラベル、除外ブランチ、ログレベル、Slack Webhook、トリガー等）は `src/init.ts` で設定 → `bun run push` → `initConfig()` で反映。
>
> **カスタマイズ可能な設定:**
> - **プロジェクト別**: 初回同期日数、健全性閾値、除外ラベル、インシデントラベル
> - **グローバル**: シート名（i18n対応）、監査ログシート名
>
> 詳細: [PROJECT_BASED_CONFIGURATION.md](docs/PROJECT_BASED_CONFIGURATION.md), [init.example.ts](src/init.example.ts)

### Slack通知（手動送信テスト用）
```javascript
sendWeeklyReport()               // 週次レポート
sendIncidentDailySummary()       // 日次サマリー
sendMonthlyReport()              // 月次レポート
checkAndSendAlerts()             // アラート確認
```

> **💡 Tip:** トリガー設定は GAS エディタの「トリガー」メニューから行うか、init.ts で設定してデプロイしてください。

---

## 📖 GAS関数 詳細リファレンス

**全グローバル関数の詳細（引数、戻り値、使用例、実行方法）:**
👉 **[docs/GAS_FUNCTIONS.md](docs/GAS_FUNCTIONS.md)** を参照してください。

### 初回セットアップ実行順序

```javascript
initConfig()           // 1. 初期設定を反映
checkConfig()          // 2. 設定確認
syncAllMetrics(30)     // 3. データ同期開始（過去30日分）
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
bun run prepush    # 完全チェック（型チェック、lint、test、build、コード品質）
/review            # コードレビュー実行
```

詳細: [CLAUDE_TASKS.md](CLAUDE_TASKS.md)