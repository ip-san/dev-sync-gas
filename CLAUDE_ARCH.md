# DevSyncGAS - アーキテクチャガイド

プロジェクトの全体設計、ディレクトリ構造、設計思想の概要。

---

## 🎯 プロジェクトの本質

### 何を作っているか
GitHub複数リポジトリ → DORA metrics収集 → Googleスプレッドシート出力（GAS）

### 技術的特徴
- **実行環境**: Google Apps Script（GAS）
- **制約**: fetch不可、UrlFetchApp使用必須、PropertiesServiceでストレージ管理
- **計測思想**: Issue作成 = 作業開始（[MEASUREMENT_PHILOSOPHY.md](docs/MEASUREMENT_PHILOSOPHY.md)）
- **API戦略**: GraphQL優先（[ADR-0001](docs/adr/0001-graphql-api-default.md)）
- **アーキテクチャ**: DIコンテナ（[ADR-0002](docs/adr/0002-di-container-for-gas-abstraction.md)）

### 主要機能
- **DORA指標**: Deployment Frequency, Lead Time, Change Failure Rate, MTTR
- **拡張指標**: Cycle Time, Coding Time, Rework Rate, Review Efficiency, PR Size
- **出力**: リポジトリ別シート + Dashboard + チャート自動生成
- **認証**: GitHub PAT / GitHub Apps 両対応
- **通知**: Slack週次レポート、インシデント日次サマリー

---

## 🏗 ディレクトリ構造

```
src/
├── functions/       # GAS公開関数（global.* でエクスポート）
│   ├── index.ts     # syncDevOpsMetrics等
│   ├── setup.ts     # initConfig等
│   └── slack.ts     # Slack通知
│
├── services/        # ビジネスロジック
│   ├── github/      # GitHub API（GraphQL/REST切替可能）
│   ├── metrics/     # DORA指標 + 拡張指標の計算
│   └── spreadsheet/ # スプレッドシート操作、チャート生成
│
├── core/           # コア機能
│   ├── container.ts # DIコンテナ
│   └── config.ts    # 設定管理
│
└── utils/          # ユーティリティ
    ├── errors.ts    # ErrorCode 1000-9000番台
    ├── logger.ts    # ログ管理
    └── types.ts     # 型定義
```

**詳細**: [ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## 🔄 データフロー

```
GitHub API → データ取得 → メトリクス計算 → スプレッドシート出力 → チャート生成 → Slack通知
```

### 主要処理
1. **設定読み込み** (PropertiesService)
2. **DIコンテナ初期化** (GitHub API, MetricsCalculator, SpreadsheetService)
3. **データ取得** (PR/Workflow/Issue/Deployment - 並列実行)
4. **指標計算** (DORA + 拡張指標)
5. **スプレッドシート出力** (リポジトリ別シート + Dashboard + チャート)
6. **Slack通知** (オプション)

---

## 🧩 重要な設計判断

### 計測起点: Issue作成 = 作業開始
- 従来: PR作成 = 作業開始
- DevSyncGAS: Issue作成 = 作業開始
- メリット: 計画・設計フェーズも含めた真のサイクルタイム計測
- **詳細**: [MEASUREMENT_PHILOSOPHY.md](docs/MEASUREMENT_PHILOSOPHY.md)

### API選択: GraphQL優先
- REST API: 5,000リクエスト/時
- GraphQL API: 単一クエリで複数データ取得可能
- 複数リポジトリの同期でレート制限に達しにくい
- **詳細**: [ADR-0001](docs/adr/0001-graphql-api-default.md)

### DIコンテナ採用
- GAS固有API（UrlFetchApp, PropertiesService）を抽象化
- テスト時にモックに差し替え可能
- API実装（GraphQL/REST）の切り替えが容易
- **詳細**: [ADR-0002](docs/adr/0002-di-container-for-gas-abstraction.md)

---

## 🔐 セキュリティ設計

### 認証情報の管理
PropertiesService（GAS標準のストレージ）に保存:
- GITHUB_TOKEN or GITHUB_PRIVATE_KEY
- GITHUB_INSTALLATION_ID (GitHub Apps使用時)
- SPREADSHEET_ID
- SLACK_WEBHOOK_URL (オプション)

**重要**: 機密情報はすべてPropertiesServiceに保存。コードに認証情報を含めない。

### エラーコード体系
- 1000番台: 設定エラー（CONFIG_*）
- 2000番台: GitHub APIエラー（GITHUB_*）
- 3000番台: スプレッドシートエラー（SPREADSHEET_*）
- 4000番台: 計算エラー（CALCULATION_*）
- 5000番台: Slackエラー（SLACK_*）
- 9000番台: その他のエラー（UNKNOWN_ERROR）

**詳細**: [src/utils/errors.ts](src/utils/errors.ts)

---

## 📊 指標計算

### DORA指標
| 指標 | データソース |
|------|------------|
| Deployment Frequency | GitHub Deployments API |
| Lead Time for Changes | Issue + PR + Merge時刻 |
| Change Failure Rate | PRラベル（incident等） |
| MTTR | Issue（インシデントラベル） |

### 拡張指標
| 指標 | データソース | シート構造 |
|------|------------|----------|
| Cycle Time | Issue + PR + Merge | 集約 + 詳細 |
| Coding Time | Issue + PR | 集約 + 詳細 |
| Rework Rate | PR Commits | 集約 + 詳細 |
| Review Efficiency | PR Review Events | 集約 + 詳細 |
| PR Size | PR Diff Stats | 集約 + 詳細 |

**2層構造**: すべての拡張指標はリポジトリ別に2つのシートを生成します。
- **集約シート** (`{repo} - {metric}`): 日付ごとの統計（平均、中央値、最小、最大）
- **詳細シート** (`{repo} - {metric} - Details`): Issue/PR単位の個別レコード

この構造により、トレンド分析（マクロ）とドリルダウン調査（ミクロ）の両方に対応。DORA指標との整合性も向上。

**詳細**: [DORA_METRICS.md](docs/DORA_METRICS.md), [EXTENDED_METRICS.md](docs/EXTENDED_METRICS.md)

---

## 🛠 技術スタック

### 開発環境
- **言語**: TypeScript 5.x
- **ランタイム**: Bun（開発時）、Google Apps Script（本番）
- **ビルド**: esbuild
- **デプロイ**: clasp

### GAS制約への対応
| 制約 | 対応 |
|------|------|
| `fetch` 不可 | `UrlFetchApp.fetch` を使用 |
| モジュールシステム不可 | esbuildで単一ファイルにバンドル |
| Node.js標準ライブラリ不可 | GAS互換のユーティリティを実装 |
| ストレージ | `PropertiesService` を使用 |

### 品質管理
```bash
bun run check:all      # 全品質チェック
bun run check:types    # 型チェック（95%以上）
bun run check:circular # 循環依存チェック
bun run check:unused   # 未使用コードチェック
```

**詳細**: [CODE_QUALITY.md](docs/CODE_QUALITY.md)

---

## 📝 コーディング原則

- ❌ 過剰エンジニアリング禁止（要求された機能のみ実装）
- ❌ 不要な抽象化を作らない（1回限りの処理にヘルパー関数不要）
- ❌ 未使用コードは完全削除（後方互換性ハック不要）
- ✅ 既存パターンを踏襲（Grep/Readで確認）
- ✅ セキュリティ第一（機密情報露出禁止）
- ✅ GAS制約遵守（fetch禁止、UrlFetchApp使用）

---

## 🔗 関連ドキュメント

- **プロジェクト概要**: [CLAUDE.md](CLAUDE.md)
- **コマンド集**: [CLAUDE_COMMANDS.md](CLAUDE_COMMANDS.md)
- **タスクフロー**: [CLAUDE_TASKS.md](CLAUDE_TASKS.md)
- **ナビゲーション**: [CLAUDE_NAV.md](CLAUDE_NAV.md)
- **詳細設計**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
