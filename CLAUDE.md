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
- [x] Dashboardシート（全リポジトリ×全指標の俯瞰 + ステータス表示）
- [x] 週次トレンドシート
- [x] 除外ラベル機能（計測から除外するIssue/PRのラベル設定）
- [x] インシデントラベル機能（MTTR計算用のインシデント判定ラベル設定）

## TODO / 拡張案
- [ ] 拡張指標（サイクルタイム等）のリポジトリ別シート対応
- [ ] Slack通知連携
- [ ] ダッシュボード用のチャート生成

## APIトークン設定（GASエディタで実行）
```javascript
setup(
  'ghp_xxxx',           // GitHub PAT
  'spreadsheet-id'      // Google Spreadsheet ID
);
addRepo('owner', 'repo-name');
```

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
├── Dashboard                    # 全リポ×全指標の俯瞰 + ステータス
├── Dashboard - Trend            # 週次トレンド
├── DevOps Summary               # リポジトリ比較サマリー
├── owner/repo-a                 # リポジトリ別データ
├── owner/repo-b
└── owner/repo-c
```

### 同期
```javascript
syncDevOpsMetrics();        // DORA指標を同期（Dashboard/Summary自動生成）
syncDailyBackfill(30);      // 過去30日分をバックフィル
syncAllProjects();          // 全プロジェクトを同期
```

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
