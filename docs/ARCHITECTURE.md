# 🏗️ DevSyncGAS アーキテクチャ

本ドキュメントはDevSyncGASの設計意図・構造・データフローを説明します。

---

## 📐 全体像

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Google Apps Script                           │
│  ┌───────────────┐                                                  │
│  │   main.ts     │  GASエントリーポイント（グローバル関数）          │
│  └───────┬───────┘                                                  │
│          │                                                          │
│  ┌───────▼───────┐                                                  │
│  │  functions/   │  機能別ビジネスロジック                          │
│  └───────┬───────┘                                                  │
│          │                                                          │
│  ┌───────▼───────────────────────────────────────────────────────┐  │
│  │                      services/                                 │  │
│  │  ┌──────────────┐    ┌────────────────┐    ┌────────────────┐ │  │
│  │  │   github/    │    │  spreadsheet/  │    │  migration.ts  │ │  │
│  │  │  (REST/GQL)  │    │                │    │                │ │  │
│  │  └──────────────┘    └────────────────┘    └────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
│          │                                                          │
│  ┌───────▼───────┐                                                  │
│  │  container.ts │  DIコンテナ（GAS API抽象化）                     │
│  └───────┬───────┘                                                  │
│          │                                                          │
│  ┌───────▼───────┐                                                  │
│  │  adapters/gas │  GAS固有API実装（UrlFetchApp等）                 │
│  └───────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────┘
          │                                      │
          ▼                                      ▼
   ┌─────────────┐                      ┌──────────────┐
   │  GitHub API │                      │ Spreadsheet  │
   │ (REST/GQL)  │                      │              │
   └─────────────┘                      └──────────────┘
```

---

## 📁 ディレクトリ構成と責務

```
src/
├── main.ts                 # GASエントリーポイント
├── container.ts            # DIコンテナ
├── interfaces/             # 抽象インターフェース
│   └── index.ts            #   HttpClient, SpreadsheetClient等
├── adapters/
│   └── gas/                # GAS固有実装
│       └── index.ts        #   UrlFetchApp, SpreadsheetApp等
├── config/
│   ├── settings.ts         # スクリプトプロパティ管理
│   └── doraThresholds.ts   # DORAパフォーマンス閾値
├── functions/              # ビジネスロジック層
│   ├── sync.ts             #   DORA指標同期
│   ├── extendedMetrics.ts  #   拡張指標同期
│   ├── setup.ts            #   初期セットアップ
│   ├── config.ts           #   設定管理
│   ├── migration.ts        #   スキーママイグレーション
│   └── debug.ts            #   デバッグ・確認用
├── services/
│   ├── github/             # GitHub API連携
│   │   ├── api.ts          #   REST API基盤
│   │   ├── graphql/        #   GraphQL API版
│   │   ├── pullRequests.ts #   PR操作
│   │   ├── deployments.ts  #   デプロイメント
│   │   ├── issues.ts       #   Issue操作
│   │   └── cycleTime.ts    #   サイクルタイム計測
│   ├── spreadsheet/        # スプレッドシート書き出し
│   │   ├── repositorySheet.ts  #   リポジトリ別シート
│   │   ├── dashboard.ts    #   Dashboardシート
│   │   ├── metricsSummary.ts   #   Summaryシート
│   │   ├── cycleTime.ts    #   サイクルタイムシート
│   │   └── ...             #   その他指標シート
│   ├── migration.ts        # スキーママイグレーション
│   └── githubAuth.ts       # GitHub認証（PAT/Apps）
├── schemas/
│   └── index.ts            # スプレッドシートスキーマ定義
├── types/                  # 型定義
│   ├── github.ts           #   GitHub関連
│   ├── metrics.ts          #   指標関連
│   └── config.ts           #   設定関連
└── utils/
    └── metrics/            # 指標計算ロジック
        ├── dora.ts         #   DORA指標
        ├── extended.ts     #   拡張指標
        └── aggregate.ts    #   集計
```

---

## 🔄 データフロー

### DORA指標同期（syncDevOpsMetrics）

```
1. 設定読み込み
   config/settings.ts → リポジトリ一覧、認証情報

2. GitHub APIからデータ取得
   services/github/ → PR、デプロイメント、ワークフロー

3. 指標計算
   utils/metrics/dora.ts → Deployment Frequency, Lead Time, CFR, MTTR

4. スプレッドシート書き出し
   services/spreadsheet/repositorySheet.ts → リポジトリ別シート
   services/spreadsheet/dashboard.ts → Dashboard, Trend シート
   services/spreadsheet/metricsSummary.ts → DevOps Summary シート
```

### サイクルタイム計測（syncCycleTime）

```
1. Issue一覧取得
   services/github/issues.ts → 期間内のIssue

2. PRチェーン追跡
   services/github/cycleTime.ts → Issue→PR→マージ先PRを追跡

3. Productionマージ検出
   trackToProductionMerge() → base branchがproductionパターンにマッチ

4. 時間計算・書き出し
   utils/metrics/extended.ts → サイクルタイム計算
   services/spreadsheet/cycleTime.ts → シート書き出し
```

---

## 💡 設計原則

### 1. DIコンテナによるGAS API抽象化

GAS固有のAPI（`UrlFetchApp`、`SpreadsheetApp`等）を直接呼ばず、`interfaces/`で定義した抽象インターフェース経由でアクセスする。

```typescript
// 悪い例: GAS APIを直接呼ぶ
const response = UrlFetchApp.fetch(url);

// 良い例: DIコンテナ経由
const { httpClient } = getContainer();
const response = httpClient.fetch(url);
```

**理由**: テスト時にモック実装を注入できる。

### 2. GraphQL優先（REST APIフォールバック）

デフォルトでGraphQL APIを使用し、API呼び出し回数を削減する。

```typescript
// 設定で切り替え可能
configureApiMode('graphql');  // デフォルト
configureApiMode('rest');     // フォールバック
```

**理由**: REST APIは PR 100件のレビュー効率取得に300リクエスト必要だが、GraphQLなら10リクエストで済む（30倍効率化）。

### 3. プロジェクトグループによる複数スプレッドシート対応

1つのGAS環境で複数プロジェクト（それぞれ異なるスプレッドシート）を管理できる。

```typescript
createProject('ProjectA', 'spreadsheet-id-A');
createProject('ProjectB', 'spreadsheet-id-B');
addRepoToProject('ProjectA', 'org', 'repo1');
syncAllProjects();  // 全プロジェクト一括同期
```

### 4. スキーママイグレーション

スプレッドシートのヘッダー構造変更時、既存データを保持したまま移行できる。

```typescript
previewMigration();   // 変更内容を確認
migrateAllSchemas();  // 実行
```

### 5. リポジトリ別シート構造

リポジトリごとに別シートに分離され、Dashboard・Summaryが自動生成される。

```
プロジェクト (スプレッドシート)
├── Dashboard                    # 全リポ×全指標の俯瞰 + ステータス
├── Dashboard - Trend            # 週次トレンド
├── DevOps Summary               # リポジトリ比較サマリー
├── owner/repo-a                 # リポジトリ別データ
├── owner/repo-b
└── owner/repo-c
```

**メリット**:
- シートタブでリポジトリを即座に切り替え可能
- 問題のあるリポジトリが一目瞭然
- Dashboardでステータス（良好/要注意/要対応）を表示

```typescript
// DORA指標同期（Dashboard/Summary自動生成）
syncDevOpsMetrics();
syncDailyBackfill(30);  // 過去30日分をバックフィル
syncAllProjects();      // 全プロジェクト一括同期
```

---

## ⚠️ 制約事項

### GAS実行時間制限

- 最大6分で強制終了
- 大量リポジトリの場合は分割実行が必要

### GitHub APIレート制限

| API | 制限 |
|-----|------|
| REST | 5,000 req/hour（PAT）、15,000 req/hour（Apps） |
| GraphQL | 5,000 points/hour |

### PRチェーン追跡深度

最大5段階まで。実運用で5段階を超えるケースは稀。

---

## 関連ドキュメント

### 設計思想
- [docs/MEASUREMENT_PHILOSOPHY.md](MEASUREMENT_PHILOSOPHY.md) - 計測思想（なぜIssue作成から計測するか）

### 指標の詳細
- [docs/CYCLE_TIME.md](CYCLE_TIME.md) - サイクルタイム計測の詳細
- [docs/CODING_TIME.md](CODING_TIME.md) - コーディング時間計測の詳細
- [docs/REWORK_RATE.md](REWORK_RATE.md) - 手戻り率計測の詳細
- [docs/REVIEW_EFFICIENCY.md](REVIEW_EFFICIENCY.md) - レビュー効率計測の詳細
- [docs/PR_SIZE.md](PR_SIZE.md) - PRサイズ計測の詳細

### 開発ガイド
- [CLAUDE.md](../CLAUDE.md) - 開発コマンド、skill
