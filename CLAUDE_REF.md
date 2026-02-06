# DevSyncGAS - リファレンスガイド

このファイルは [CLAUDE.md](CLAUDE.md) の詳細版です。必要な時にRead toolで参照してください。

---

## 🔍 クイックナビゲーション（キーワード検索）

### コード理解・実装
- **GitHub API実装**: [ARCHITECTURE.md](docs/ARCHITECTURE.md) - src/services/github/
- **GraphQL vs REST**: [ADR-0001](docs/adr/0001-graphql-api-default.md)
- **DORA指標計算**: [DORA_METRICS.md](docs/DORA_METRICS.md) - Deployment Frequency/Lead Time/CFR/MTTR
- **拡張指標計算**: [EXTENDED_METRICS.md](docs/EXTENDED_METRICS.md) - Cycle Time/Coding Time/Rework/Review/PR Size
- **サイクルタイム**: [CYCLE_TIME.md](docs/CYCLE_TIME.md) - Issue作成→Productionマージ
- **コーディング時間**: [CODING_TIME.md](docs/CODING_TIME.md) - Issue作成→PR作成
- **手戻り率**: [REWORK_RATE.md](docs/REWORK_RATE.md) - 追加コミット/Force Push
- **レビュー効率**: [REVIEW_EFFICIENCY.md](docs/REVIEW_EFFICIENCY.md) - レビュー待ち/レビュー時間
- **PRサイズ**: [PR_SIZE.md](docs/PR_SIZE.md) - 変更行数/ファイル数
- **スプレッドシート操作**: [ARCHITECTURE.md](docs/ARCHITECTURE.md) - src/services/spreadsheet/
- **チャート生成**: src/services/spreadsheet/charts.ts
- **DIコンテナ**: [ADR-0002](docs/adr/0002-di-container-for-gas-abstraction.md) - src/core/container.ts
- **エラーハンドリング**: src/utils/errors.ts - ErrorCode 1000-9000番台

### セットアップ・設定
- **初期設定**: [SETUP_AND_TROUBLESHOOTING.md](docs/SETUP_AND_TROUBLESHOOTING.md) - 認証設定、clasp、初回デプロイ
- **クイックスタート**: [QUICK_START.md](docs/QUICK_START.md) - 5分で動かす
- **GitHub Apps認証**: [GITHUB_APPS_AUTH.md](docs/GITHUB_APPS_AUTH.md) - App作成、Private Key、Installation ID
- **Slack通知**: src/functions/slack.ts - 週次レポート、インシデント日次サマリー
- **トラブルシューティング**: [SETUP_AND_TROUBLESHOOTING.md](docs/SETUP_AND_TROUBLESHOOTING.md) - checkConfig()、エラー解決

### 品質・保守
- **コード品質**: [CODE_QUALITY.md](docs/CODE_QUALITY.md) - check:all、循環依存、未使用コード、型カバレッジ
- **リファクタリング**: [REFACTORING_GUIDE.md](docs/REFACTORING_GUIDE.md) - 複雑度管理、リファクタリング手法
- **新指標追加**: [ADDING_METRICS.md](docs/ADDING_METRICS.md) - 指標追加の手順、チェックリスト
- **設計判断記録**: [docs/adr/](docs/adr/) - ADR作成手順

---

## 📂 ファイルパス逆引き索引

| ファイル/ディレクトリ | 関連ドキュメント | 用途 |
|---------------------|-----------------|------|
| `src/functions/` | [ARCHITECTURE.md](docs/ARCHITECTURE.md) | GAS公開関数（global.*でエクスポート） |
| `src/services/github/` | [ARCHITECTURE.md](docs/ARCHITECTURE.md) | GitHub API実装（GraphQL/REST） |
| `src/services/metrics/` | [DORA_METRICS.md](docs/DORA_METRICS.md), [EXTENDED_METRICS.md](docs/EXTENDED_METRICS.md) | DORA + 拡張指標計算ロジック |
| `src/services/spreadsheet/` | [ARCHITECTURE.md](docs/ARCHITECTURE.md) | スプレッドシート操作、シート生成 |
| `src/services/spreadsheet/charts.ts` | [ARCHITECTURE.md](docs/ARCHITECTURE.md) | チャート自動生成 |
| `src/core/container.ts` | [ADR-0002](docs/adr/0002-di-container-for-gas-abstraction.md) | DIコンテナ、依存性注入 |
| `src/core/config.ts` | [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 設定管理、Secret Manager |
| `src/utils/errors.ts` | src/utils/errors.ts | カスタムエラークラス、ErrorCode |
| `src/utils/logger.ts` | [LOGGING_GUIDELINES.md](docs/LOGGING_GUIDELINES.md) | ログ管理、ログレベル制御 |
| `src/init.ts` | [SETUP_AND_TROUBLESHOOTING.md](docs/SETUP_AND_TROUBLESHOOTING.md) | 初期設定ファイル |

---

## ⚡️ タスク別フロー

### 🆕 新機能実装
```
1. 要件確認
   → 過剰機能を実装しない（要求された機能のみ）

2. 既存パターン確認
   → Grep/Read で類似コード検索
   → 既存の実装パターンを踏襲

3. 実装
   → 必要最小限の変更
   → 抽象化・ヘルパー関数は1回限りの処理には不要

4. テスト追加
   → bun test
   → 新機能に対応するテストケース追加

5. 品質チェック
   → bun run check:all
   → 循環依存、未使用コード、型カバレッジ確認

6. レビュー実行
   → /review
   → lint/test/型チェック自動実行
```

### 🐛 バグ修正
```
1. 再現確認
   → ログ確認: configureLogLevel('DEBUG')
   → エラーメッセージ、スタックトレース確認

2. 原因特定
   → Grep でエラーコード検索
   → src/utils/errors.ts でエラーコード確認

3. 修正
   → 最小限の変更（影響範囲を最小化）

4. テスト
   → 該当テストケース実行
   → リグレッションテスト

5. レビュー実行
   → /review
```

### 📊 新しい指標追加
```
1. 設計
   → [ADDING_METRICS.md](docs/ADDING_METRICS.md) を参照
   → 計算ロジック、データソース、表示形式を設計

2. MetricsCalculator実装
   → src/services/metrics/ に実装
   → 既存の指標計算パターンを参考に

3. スプレッドシート出力
   → src/services/spreadsheet/ に実装
   → シート生成、データ書き込み

4. テスト追加
   → 計算ロジックのユニットテスト
   → 統合テスト

5. 検証
   → /dora-validate 実行
   → DORA公式基準との整合性確認
```

### 🔧 設定変更・トラブルシューティング
```
1. 診断ツール実行
   → checkConfig() をGASエディタで実行
   → 設定状況、エラー原因を確認

2. ドキュメント参照
   → [SETUP_AND_TROUBLESHOOTING.md](docs/SETUP_AND_TROUBLESHOOTING.md)
   → エラーコード別の解決方法を確認

3. エラーコード確認
   → src/utils/errors.ts
   → ErrorCode 1000-9000番台の定義確認

4. 設定変更
   → src/init.ts を更新
   → 再デプロイして initConfig() 実行
```

### 📝 PR作成前
```
1. セルフチェック実行
   → /pr-check
   → lint/test/build自動チェック

2. git操作
   → git add <files>
   → git commit -m "message"

3. 動作確認
   → bun run push
   → GASエディタで実際に関数実行

4. PR作成
   → 変更内容の要約
   → テスト結果の記載
```

---

## 📦 コマンドリファレンス

### 開発コマンド
```bash
# ビルド・デプロイ
bun run build          # TypeScript → GAS用JSにビルド
bun run push           # ビルド + GASにデプロイ

# テスト
bun test               # テスト実行
bun run lint           # ESLintチェック
bun run lint:fix       # ESLint自動修正

# フォーマット
bun run format         # Prettierフォーマット
bun run format:check   # Prettierチェック（CI用）

# 品質チェック
bun run check:circular # 循環依存チェック
bun run check:unused   # 未使用コードチェック
bun run check:types    # 型カバレッジチェック（95%以上）
bun run check:all      # 全チェックを一括実行

# 完了前の必須チェック
bunx tsc --noEmit && bun run lint && bun test && bun run build
```

### GAS関数（診断・確認）
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

### GAS関数（データ同期）
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

### GAS関数（初期設定）
```javascript
// 初回セットアップ
initConfig()                     // src/init.ts の設定を PropertiesService に保存
```

### GAS関数（設定変更）
```javascript
// API設定
configureApiMode('graphql')                           // GraphQL API使用（デフォルト）
configureApiMode('rest')                              // REST API使用

// ラベル設定
configureExcludeLabels(['exclude-metrics', 'bot'])    // 除外ラベル設定
resetExcludeLabelsConfig()                            // 除外ラベルをデフォルトに戻す
configureIncidentLabels(['incident', 'bug', 'p0'])    // インシデントラベル設定
resetIncidentLabelsConfig()                           // インシデントラベルをデフォルトに戻す

// ログ設定
configureLogLevel('DEBUG')                            // ログレベル: DEBUG
configureLogLevel('INFO')                             // ログレベル: INFO（デフォルト）
configureLogLevel('WARN')                             // ログレベル: WARN
configureLogLevel('ERROR')                            // ログレベル: ERROR
resetLogLevelConfig()                                 // ログレベルをデフォルト（INFO）に戻す

// Slack通知設定
configureSlackWebhook('https://hooks.slack.com/...')  // Slack Webhook URL設定
removeSlackWebhook()                                  // Slack通知を無効化
showSlackConfig()                                     // Slack通知設定確認

// Slackトリガー設定
setupWeeklyReportTrigger()                            // 週次レポートトリガー（月曜9時）
showWeeklyReportTrigger()                             // 週次レポートトリガー確認
removeWeeklyReportTrigger()                           // 週次レポートトリガー削除
sendWeeklyReport()                                    // 週次レポート手動送信（テスト用）

setupIncidentDailySummaryTrigger()                    // インシデント日次サマリートリガー（毎日18時）
showIncidentDailySummaryTrigger()                     // インシデント日次サマリートリガー確認
removeIncidentDailySummaryTrigger()                   // インシデント日次サマリートリガー削除
sendIncidentDailySummary()                            // インシデント日次サマリー手動送信（テスト用）
```

---

## 🗂 ドキュメントマトリックス

### セットアップ・設定
| ドキュメント | 内容 | 読むタイミング |
|-------------|------|--------------|
| [SETUP_AND_TROUBLESHOOTING.md](docs/SETUP_AND_TROUBLESHOOTING.md) | 初期設定、認証設定、clasp、初回デプロイ、診断ツール、トラブルシューティング | 初回セットアップ時、エラー発生時 |
| [QUICK_START.md](docs/QUICK_START.md) | 5分で動かす手順 | 初回セットアップ時 |
| [GITHUB_APPS_AUTH.md](docs/GITHUB_APPS_AUTH.md) | GitHub App作成、Private Key、Installation ID | GitHub Apps認証を選択する場合 |

### 設計・アーキテクチャ
| ドキュメント | 内容 | 読むタイミング |
|-------------|------|--------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 全体設計、ディレクトリ構造、データフロー、技術選定 | プロジェクト全体を理解したい時 |
| [MEASUREMENT_PHILOSOPHY.md](docs/MEASUREMENT_PHILOSOPHY.md) | 計測思想、Issue起点の設計判断、イシュードリブン開発 | 計測思想を理解したい時 |
| [docs/adr/](docs/adr/) | 設計判断記録（ADR-0001: GraphQL優先、ADR-0002: DIコンテナ） | 設計判断の背景を知りたい時 |

### 機能・指標
| ドキュメント | 内容 | 読むタイミング |
|-------------|------|--------------|
| [DORA_METRICS.md](docs/DORA_METRICS.md) | DORA指標の計算方法（Deployment Frequency/Lead Time/CFR/MTTR） | DORA指標の実装を理解・修正したい時 |
| [EXTENDED_METRICS.md](docs/EXTENDED_METRICS.md) | 拡張指標の計算方法（Cycle Time/Coding Time/Rework/Review/PR Size） | 拡張指標の実装を理解・修正したい時 |
| [CYCLE_TIME.md](docs/CYCLE_TIME.md) | サイクルタイム計測（Issue作成→Productionマージ） | サイクルタイムの詳細を知りたい時 |
| [CODING_TIME.md](docs/CODING_TIME.md) | コーディング時間計測（Issue作成→PR作成） | コーディング時間の詳細を知りたい時 |
| [REWORK_RATE.md](docs/REWORK_RATE.md) | 手戻り率計測（追加コミット数/Force Push回数） | 手戻り率の詳細を知りたい時 |
| [REVIEW_EFFICIENCY.md](docs/REVIEW_EFFICIENCY.md) | レビュー効率計測（レビュー待ち時間/レビュー時間） | レビュー効率の詳細を知りたい時 |
| [PR_SIZE.md](docs/PR_SIZE.md) | PRサイズ計測（変更行数/ファイル数） | PRサイズの詳細を知りたい時 |
| [ADDING_METRICS.md](docs/ADDING_METRICS.md) | 新しい指標の追加手順、チェックリスト | 新しい指標を追加したい時 |

### 開発・保守
| ドキュメント | 内容 | 読むタイミング |
|-------------|------|--------------|
| [CODE_QUALITY.md](docs/CODE_QUALITY.md) | コード品質基準、チェックツール（循環依存、未使用コード、型カバレッジ） | コード品質を向上させたい時 |
| [REFACTORING_GUIDE.md](docs/REFACTORING_GUIDE.md) | リファクタリング手法、複雑度管理 | リファクタリングを実施したい時 |
| [LOGGING_GUIDELINES.md](docs/LOGGING_GUIDELINES.md) | ログガイドライン、ログレベル制御 | ログ実装・デバッグ時 |
| [SECURITY.md](docs/SECURITY.md) | セキュリティガイドライン | セキュリティ要件を確認したい時 |

---

## 🏗 アーキテクチャ概要

### ディレクトリ構造
```
src/
├── functions/       # GAS公開関数（global.* でエクスポート）
│   ├── index.ts     # メイン関数（syncDevOpsMetrics等）
│   ├── setup.ts     # 初期設定関数（initConfig等）
│   └── slack.ts     # Slack通知関数
│
├── services/        # ビジネスロジック
│   ├── github/      # GitHub API（GraphQL/REST切替可能）
│   │   ├── graphql/ # GraphQL API実装
│   │   └── rest/    # REST API実装
│   ├── metrics/     # DORA指標 + 拡張指標の計算
│   └── spreadsheet/ # スプレッドシート操作（シート生成、チャート）
│
├── core/           # コア機能
│   ├── container.ts # DIコンテナ（依存性注入）
│   └── config.ts    # 設定管理、Secret Manager
│
└── utils/          # ユーティリティ
    ├── errors.ts    # エラークラス、ErrorCode 1000-9000番台
    ├── logger.ts    # ログ管理、ログレベル制御
    └── types.ts     # 型定義
```

### データフロー
```
1. GitHub API
   ↓
2. データ取得（PR/Workflow/Issue/Deployment）
   ↓
3. メトリクス計算（DORA + 拡張指標）
   ↓
4. スプレッドシート出力（リポジトリ別シート + Dashboard）
   ↓
5. チャート自動生成
   ↓
6. Slack通知（オプション）
```

### 重要な設計判断
| テーマ | 判断内容 | 理由 | 参照 |
|--------|---------|------|------|
| 計測起点 | Issue作成 = 作業開始 | イシュードリブン開発、AI駆動開発との相性 | [MEASUREMENT_PHILOSOPHY.md](docs/MEASUREMENT_PHILOSOPHY.md) |
| API選択 | GraphQL優先（デフォルト有効） | レート制限対策（REST: 5,000/h → GraphQL: 複数データを1リクエスト） | [ADR-0001](docs/adr/0001-graphql-api-default.md) |
| DI採用 | DIコンテナによる依存性注入 | GAS環境の抽象化、テスト容易性向上 | [ADR-0002](docs/adr/0002-di-container-for-gas-abstraction.md) |

### 主要機能
- **DORA指標**: Deployment Frequency, Lead Time, Change Failure Rate, MTTR
- **拡張指標**: Cycle Time, Coding Time, Rework Rate, Review Efficiency, PR Size
- **出力**: リポジトリ別シート + Dashboard + 週次トレンド + チャート自動生成
- **認証**: GitHub PAT / GitHub Apps 両対応
- **通知**: Slack週次レポート、インシデント日次サマリー

---

## 💡 よくあるパターン

### エラー調査の流れ
```javascript
// 1. ログレベルをDEBUGに変更
configureLogLevel('DEBUG');

// 2. 問題の関数を実行
syncDevOpsMetrics();

// 3. ログを確認してエラーコードを特定

// 4. Grep tool でエラーコードを検索
// 例: "GITHUB_RATE_LIMIT"

// 5. src/utils/errors.ts でエラー詳細を確認
```

### 設計判断の記録
| 規模 | 記録先 | 例 |
|------|--------|-----|
| 小（バグ修正、軽微な改善） | コミットメッセージ | "fix: 日付フォーマットのバグを修正" |
| 中（機能追加、リファクタリング） | PR Description | "feat: Slack通知機能の追加" |
| 大（アーキテクチャ変更、技術選定） | [docs/adr/](docs/adr/) | "ADR-0003: スプレッドシート構造の変更" |

ADR作成手順: [docs/adr/README.md](docs/adr/README.md)

### 作業完了チェックリスト
- [ ] 型エラーなし: `bunx tsc --noEmit`
- [ ] Lint通過: `bun run lint`
- [ ] テスト通過: `bun test`
- [ ] ビルド成功: `bun run build`
- [ ] 未使用コードなし: `bun run check:unused`
- [ ] 循環依存なし: `bun run check:circular`
- [ ] 型カバレッジ95%以上: `bun run check:types`
- [ ] `/review` 実行済み
- [ ] 必要に応じてドキュメント更新

---

## 🎯 プロジェクトの本質

### 何を作っているか
- GitHub複数リポジトリからDevOps指標（DORA metrics + 拡張指標）を自動収集
- Googleスプレッドシートに可視化（Dashboard、週次トレンド、チャート）
- Slack通知による定期レポート

### 技術的特徴
- **実行環境**: Google Apps Script（GAS）
- **制約**: fetch不可、UrlFetchApp使用必須、PropertiesServiceでストレージ管理
- **計測思想**: Issue作成 = 作業開始（イシュードリブン開発）
- **API戦略**: GraphQL優先（レート制限対策）
- **アーキテクチャ**: DIコンテナによる依存性注入

### Claude Codeへの指示
- ❌ 過剰エンジニアリング禁止（要求された機能のみ実装）
- ❌ 不要な抽象化を作らない（1回限りの処理にヘルパー関数不要）
- ❌ 未使用コードは完全削除（後方互換性ハック不要）
- ✅ 既存パターンを踏襲（Grep/Readで確認）
- ✅ セキュリティ第一（機密情報露出禁止）
- ✅ GAS制約遵守（fetch禁止、UrlFetchApp使用）
