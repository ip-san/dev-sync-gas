# DevSyncGAS - Claude Code開発ガイド

## プロジェクト概要
GitHub複数リポジトリからDevOps指標（DORA metrics）を収集し、Googleスプレッドシートに書き出すGASプロダクト。

## 技術スタック
- **言語**: TypeScript
- **ランタイム**: Bun
- **ビルド**: esbuild + esbuild-gas-plugin
- **デプロイ**: clasp (Google Apps Script CLI)
- **ターゲット**: Google Apps Script

## ディレクトリ構成

詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照。

## 開発コマンド
```bash
bun run build          # TypeScript → GAS用JSにビルド
bun run push           # ビルド＆GASにデプロイ
bun test               # テスト実行
bun run lint           # ESLintチェック
bun run lint:fix       # ESLint自動修正
bun run format         # Prettierフォーマット
bun run format:check   # Prettierチェック（CI用）

# コード品質チェック
bun run check:circular # 循環依存チェック
bun run check:unused   # 未使用コードチェック
bun run check:types    # 型カバレッジチェック（95%以上）
bun run check:all      # 全チェックを一括実行
```

## Claude Code カスタムskill
以下のskillが利用可能です（スラッシュコマンドで実行）：

| コマンド | 説明 |
|----------|------|
| `/review` | コード変更をレビューし、lint/test/型チェックを実行 |
| `/pr-check` | PR作成前のセルフチェック（lint/test/build） |
| `/dora-validate` | DORA metrics計算ロジックの正当性検証 |

詳細は `.claude/skills/` 配下のSKILL.mdを参照。

## GAS固有の注意点
1. **グローバル関数**: GASで実行可能な関数は`global.functionName = functionName`でエクスポート
2. **API呼び出し**: `fetch`ではなく`UrlFetchApp.fetch`を使用
3. **ストレージ**: `PropertiesService.getScriptProperties()`でシークレット管理
4. **型定義**: `@types/google-apps-script`を使用

## 計測思想

本ツールは「Issue作成 = 作業開始の意思表示」という前提に基づき、Issue作成時点からサイクルタイムを計測します。
この設計判断の背景（イシュードリブン開発、AI駆動開発との相性、公式フレームワークとの関係等）については以下を参照してください：

- [docs/MEASUREMENT_PHILOSOPHY.md](docs/MEASUREMENT_PHILOSOPHY.md) - 計測思想・設計判断の詳細

## 現在の機能
- [x] GitHub PR/Workflow/Issue取得
- [x] DORA metrics計算（Deployment Frequency, Lead Time, CFR, MTTR）
- [x] サイクルタイム計測（Issue作成→Productionマージ）
- [x] コーディング時間計測（Issue作成→PR作成）
- [x] 手戻り率計測（追加コミット数・Force Push回数）
- [x] レビュー効率計測（レビュー待ち時間・レビュー時間）
- [x] PRサイズ計測（変更行数・変更ファイル数）
- [x] GitHub Apps認証サポート
- [x] スプレッドシート書き出し
- [x] スキーママイグレーション
- [x] 日次トリガー設定
- [x] プロジェクトグループ（複数スプレッドシート対応）
- [x] 複数リポジトリの横断集計（全体平均）
- [x] GitHub GraphQL API対応（レート制限対策、デフォルト有効）
- [x] リポジトリ別シート構造
- [x] Dashboardシート（全リポジトリ×全指標の俯瞰 + ステータス表示 + 拡張指標 + チャート生成）
- [x] 週次トレンドシート（チャート生成対応）
- [x] 除外ラベル機能（計測から除外するIssue/PRのラベル設定）
- [x] インシデントラベル機能（MTTR計算用のインシデント判定ラベル設定）
- [x] ログレベル制御（DEBUG/INFO/WARN/ERROR）
- [x] 統一エラーハンドリング（カスタムエラークラス・エラーコード体系）
- [x] 拡張指標のリポジトリ別シート対応（Cycle Time、Coding Time、Rework Rate、Review Efficiency、PR Size）
- [x] Dashboard拡張（拡張指標をリポジトリ別シートから自動集計）
- [x] Slack通知連携（日次サマリー）

## TODO / 拡張案
- [x] ダッシュボード用のチャート生成

## 初期設定

### 設定手順

1. **`src/init.example.ts` を `src/init.ts` にコピー**
   ```bash
   cp src/init.example.ts src/init.ts
   ```

2. **`src/init.ts` を編集して自分の環境に合わせる**

   認証方式は **Personal Access Token (PAT)** または **GitHub App** のどちらかを選択できます。

   #### Personal Access Token (PAT) 認証の場合
   ```typescript
   export const config: InitConfig = {
     auth: {
       type: 'token',
       token: 'ghp_xxxxx', // GitHubのPersonal Access Token
     },
     spreadsheet: {
       id: 'your-spreadsheet-id',
     },
     repositories: [
       { owner: 'your-org', name: 'your-repo' },
     ],
   };
   ```

   #### GitHub App 認証の場合
   ```typescript
   export const config: InitConfig = {
     auth: {
       type: 'github-app',
       appId: '123456',
       installationId: '12345678',
       privateKey: `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...
-----END RSA PRIVATE KEY-----`, // 複数行のまま貼り付けてOK
     },
     spreadsheet: {
       id: 'your-spreadsheet-id',
     },
     repositories: [
       { owner: 'your-org', name: 'your-repo' },
     ],
   };
   ```

3. **デプロイ**
   ```bash
   bun run push
   ```

4. **GASエディタで `initConfig` を実行**

5. **（推奨）機密情報を削除**
   設定は PropertiesService に保存されるため、デプロイ後は `src/init.ts` から機密情報を削除しても問題ありません。

## APIモード切替
デフォルトでGraphQL APIを使用（API呼び出し回数削減）。REST APIに戻す場合：
```javascript
configureApiMode('rest');   // REST APIを使用
configureApiMode('graphql'); // GraphQL APIを使用（デフォルト）
showApiMode();              // 現在のモードを確認
```

## リポジトリ別シート構造

リポジトリごとに別シートに分離され、Dashboard・Summaryが自動生成されます。

### シート構造
```
プロジェクトA (スプレッドシート)
├── Dashboard                         # 全リポ×全指標の俯瞰 + ステータス（DORA + 拡張指標）
├── Dashboard - Trend                 # 週次トレンド
├── DevOps Summary                    # リポジトリ比較サマリー
│
├── owner/repo-a                      # DORA指標（リポジトリ別）
├── owner/repo-a/サイクルタイム        # サイクルタイム詳細
├── owner/repo-a/コーディング時間      # コーディング時間詳細
├── owner/repo-a/手戻り率             # 手戻り率詳細
├── owner/repo-a/レビュー効率          # レビュー効率詳細
├── owner/repo-a/PRサイズ             # PRサイズ詳細
│
├── owner/repo-b                      # DORA指標
├── owner/repo-b/サイクルタイム
├── owner/repo-b/コーディング時間
├── owner/repo-b/手戻り率
├── owner/repo-b/レビュー効率
└── owner/repo-b/PRサイズ
```

**拡張指標のシート命名規則**: `{owner/repo}/{指標名}`

### Dashboard表示内容

Dashboardシートには以下のカラムが表示されます（リポジトリ別シートから自動集計）：

**DORA指標**:
- デプロイ頻度
- リードタイム (時間)
- 変更障害率 (%)
- MTTR (時間)

**拡張指標**:
- サイクルタイム (時間) - Issue作成からProductionマージまで
- コーディング時間 (時間) - Issue作成からPR作成まで
- レビュー待ち (時間) - Ready for ReviewからFirst Reviewまで
- レビュー時間 (時間) - First ReviewからApprovedまで
- PRサイズ (行) - 平均変更行数
- 追加コミット数 (平均) - レビュー後の追加コミット
- Force Push回数 (平均) - PR中のForce Push回数

**その他**:
- ステータス - 健全性評価（🟢良好 / 🟡要注意 / 🔴要対応）
- 例: `google/chrome/サイクルタイム`
- 各リポジトリ内で指標ごとにシートが分かれる
- リポジトリ列は不要（シート名で識別）

### 同期
```javascript
syncDevOpsMetrics();        // DORA指標を同期（Dashboard/Summary自動生成）
syncDailyBackfill(30);      // 過去30日分をバックフィル
syncAllProjects();          // 全プロジェクトを同期
```

### チャート生成機能

`syncDevOpsMetrics()` 実行時に、Dashboard・Dashboard - Trendシートへ自動的にチャートが生成されます。

#### 生成されるチャート

**Dashboard - Trendシート**:
- **週次トレンド折れ線グラフ**:
  - デプロイ頻度、リードタイム、変更障害率、サイクルタイムの推移を可視化
  - 週次で集計された値をプロット

**Dashboardシート**:
- **リポジトリ比較棒グラフ（4種類）**:
  - デプロイ頻度の比較
  - リードタイムの比較
  - 変更障害率の比較
  - サイクルタイムの比較（データがある場合のみ）

#### 特徴

- **自動更新**: `syncDevOpsMetrics()` 実行のたびにチャートが再生成
- **データ連動**: スプレッドシートのデータと完全に同期
- **GAS環境専用**: Google Apps Script環境でのみ動作（テスト環境ではモック使用）

#### 注意事項

- チャート生成に失敗してもメイン処理は継続されます（警告ログのみ）
- 既存のチャートは削除されてから新規チャートが追加されます

## 除外ラベル設定

特定のラベルが付いたIssue/PRを計測から除外できます（例: Dependabot、Bot生成PR等）。

### 設定方法
```javascript
// 除外ラベルを設定（デフォルト: 'exclude-metrics'）
configureExcludeLabels(['exclude-metrics', 'dependencies', 'bot']);

// 現在の設定を確認
showExcludeLabels();

// デフォルトに戻す
resetExcludeLabelsConfig();

// 除外しない（空配列）
configureExcludeLabels([]);
```

### 動作
- 設定したラベルが**1つでも**付いているIssue/PRは計測対象外
- 除外されたアイテム数はログに表示
- デフォルト値: `['exclude-metrics']`

## インシデントラベル設定

MTTR（Mean Time To Recovery）計算に使用するインシデント判定ラベルをカスタマイズできます。

### 設定方法
```javascript
// インシデントラベルを設定（デフォルト: 'incident'）
configureIncidentLabels(['incident', 'bug', 'p0']);

// 現在の設定を確認
showIncidentLabels();

// デフォルトに戻す
resetIncidentLabelsConfig();
```

### 動作
- 設定したラベルが**1つでも**付いているIssueをインシデントとして扱う
- MTTR計算に使用される
- デフォルト値: `['incident']`

## Slack通知設定

DevOps指標とインシデント情報をSlackに自動通知できます。

### 基本設定

```javascript
// Slack Incoming Webhook URLを設定
configureSlackWebhook('https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX');

// 現在の設定を確認
showSlackConfig();

// Webhook URLを削除（通知を無効化）
removeSlackWebhook();
```

**Incoming Webhook URLの取得方法:**
1. Slackワークスペースで [Incoming Webhooks](https://api.slack.com/messaging/webhooks) を有効化
2. 通知先チャンネルを選択
3. 発行されたWebhook URLをコピー
4. `configureSlackWebhook()` で設定

### 通知の種類

#### 1. 週次レポート（Weekly Report）

毎週月曜日の朝9時に、先週と今週のDORA指標を比較したレポートを送信します。

**トリガー設定:**
```javascript
// 週次レポートトリガーを設定（毎週月曜9時）
setupWeeklyReportTrigger();

// トリガー状態を確認
showWeeklyReportTrigger();

// トリガーを削除
removeWeeklyReportTrigger();

// 手動送信（テスト用）
sendWeeklyReport();
```

**レポート内容:**
- 今週と先週のDORA指標比較
- 週次トレンド（デプロイ頻度、リードタイム、変更障害率、MTTR）
- 前週比での改善/悪化の傾向
- スプレッドシートへのリンクボタン

#### 2. インシデント日次サマリー（Incident Daily Summary）

毎日18時に、その日発生したインシデント（新規作成・解決）をサマリーで送信します。

**トリガー設定:**
```javascript
// インシデント日次サマリートリガーを設定（毎日18時）
setupIncidentDailySummaryTrigger();

// トリガー状態を確認
showIncidentDailySummaryTrigger();

// トリガーを削除
removeIncidentDailySummaryTrigger();

// 手動送信（テスト用）
sendIncidentDailySummary();
```

**サマリー内容:**
- 新規発生インシデント一覧（Issue番号、タイトル、リポジトリ）
- 解決済みインシデント一覧（Issue番号、タイトル、解決時間）
- インシデント総数
- スプレッドシートへのリンクボタン

**注意:**
- リアルタイム通知は他ツール（PagerDuty/OpsGenie等）が担当
- 本機能は振り返り・レビュー用の日次サマリーのみ提供

### 動作仕様

- Webhook URLが未設定の場合は通知をスキップ（警告ログのみ）
- 通知失敗時もメイン処理は継続（エラーログのみ）
- トリガー設定前にWebhook URLを設定する必要があります

## ログレベル設定

環境に応じてログの出力レベルを制御できます（セキュリティ強化・本番環境での機密情報露出リスク低減）。

### 設定方法
```javascript
// 開発環境：すべてのログを表示
configureLogLevel('DEBUG');

// 本番環境：情報レベル以上のみ表示（デフォルト）
configureLogLevel('INFO');

// 本番環境（厳格）：警告とエラーのみ表示
configureLogLevel('WARN');

// 本番環境（最小）：エラーのみ表示
configureLogLevel('ERROR');

// 現在の設定を確認
showLogLevel();

// デフォルト（INFO）に戻す
resetLogLevelConfig();
```

### ログレベルの優先順位
- `DEBUG` < `INFO` < `WARN` < `ERROR`
- 設定したレベル以上のログのみが出力される
- デフォルト: `INFO`（本番環境想定）

## エラーハンドリング

アプリケーション全体で統一されたエラーハンドリングを提供しています。

### カスタムエラークラス

```typescript
import {
  AppError,
  GitHubAPIError,
  ValidationError,
  ConfigurationError,
  SecretManagerError,
  SpreadsheetError,
  ErrorCode,
  isRetryableError,
  formatErrorMessage,
} from './utils/errors';
```

### エラークラス階層

- **AppError**: すべてのカスタムエラーの基底クラス
  - **GitHubAPIError**: GitHub API関連のエラー
  - **ValidationError**: 入力検証エラー
  - **ConfigurationError**: 設定エラー
  - **SecretManagerError**: Secret Manager関連のエラー
  - **SpreadsheetError**: スプレッドシート関連のエラー

### エラーコード

30以上のエラーコードが定義されており、ドメインごとに分類されています：

- **1000番台**: GitHub API関連（`GITHUB_AUTH_FAILED`、`GITHUB_RATE_LIMIT`等）
- **2000番台**: 検証エラー（`VALIDATION_FAILED`、`INVALID_REPOSITORY`等）
- **3000番台**: 設定エラー（`CONFIG_NOT_INITIALIZED`、`CONFIG_MISSING_TOKEN`等）
- **4000番台**: Secret Manager関連（`SECRET_MANAGER_ACCESS_FAILED`等）
- **5000番台**: スプレッドシート関連（`SPREADSHEET_ACCESS_DENIED`等）
- **9000番台**: その他（`UNKNOWN_ERROR`、`CONTAINER_NOT_INITIALIZED`等）

### 使用例

```typescript
// エラーの生成
throw new ValidationError('Invalid repository format', {
  code: ErrorCode.INVALID_REPOSITORY,
  context: { owner: 'invalid-owner', repo: 'test' },
});

// HTTPステータスコードからエラーを生成
const error = GitHubAPIError.fromStatusCode(429, 'Rate limit exceeded');

// リトライ可能かチェック
if (isRetryableError(error)) {
  // リトライ処理
}

// エラーメッセージのフォーマット
const message = formatErrorMessage(error);
// 出力例: "[GITHUB_RATE_LIMIT] Rate limit exceeded (HTTP 429)"
```

### エラープロパティ

すべてのカスタムエラーは以下のプロパティを持ちます：

- `code`: エラーコード（ErrorCodeType）
- `message`: エラーメッセージ
- `isRetryable`: リトライ可能かどうか
- `statusCode`: HTTPステータスコード（該当する場合）
- `context`: エラーに関する追加情報
- `cause`: 原因となった元のエラー（ES2022互換）

## コードの理解に困ったら

Claude Codeに以下のように質問してください：

```
「src/services/github/graphql/ の設計意図を説明して」
「プロジェクトグループ機能の使い方を教えて」
「このPRで何が変わったか要約して」
「DIコンテナの仕組みを解説して」
「サイクルタイム計測のデータフローを説明して」
```

詳細な設計ドキュメントは以下を参照：
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - 全体構造・データフロー・設計原則
- [docs/DORA_METRICS.md](docs/DORA_METRICS.md) - DORA指標の計算方法
- [docs/EXTENDED_METRICS.md](docs/EXTENDED_METRICS.md) - 拡張指標の計算方法
- [docs/MEASUREMENT_PHILOSOPHY.md](docs/MEASUREMENT_PHILOSOPHY.md) - 計測思想・設計判断の詳細
- [docs/adr/](docs/adr/) - 設計判断の記録（ADR）

## 作業完了時のチェック

コード変更後は以下を確認してください：

```bash
bunx tsc --noEmit      # 型エラーなし
bun run lint           # Lint警告なし（複雑度チェック含む）
bun test               # テスト通過
bun run build          # ビルド成功
bun run check:all      # 全品質チェック実行（推奨）
```

確認項目：
- 未使用のimport/変数がないか
- 新機能にテストを追加したか
- 必要に応じてドキュメントを更新したか
- 複雑度警告が出た場合はリファクタリングを検討

詳細は以下を参照：
- [docs/CODE_QUALITY.md](docs/CODE_QUALITY.md) - コード品質管理
- [docs/REFACTORING_GUIDE.md](docs/REFACTORING_GUIDE.md) - リファクタリングの実践的ガイド

## 設計判断の記録

重要な設計判断をした場合は、規模に応じて記録してください：

| 規模 | 記録先 | 例 |
|------|--------|-----|
| 小 | コミットメッセージ | バグ修正、軽微な改善 |
| 中 | PR Description | 機能追加、リファクタリング |
| 大 | ADR（docs/adr/） | アーキテクチャ変更、技術選定 |

### ADRの作成手順

[docs/adr/README.md](docs/adr/README.md) を参照。

## 新しい指標の追加

新しいDevOps指標を追加する場合は、以下のガイドを参照してください：

- [docs/ADDING_METRICS.md](docs/ADDING_METRICS.md) - 指標追加の手順・チェックリスト
