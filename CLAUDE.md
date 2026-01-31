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
```
src/
├── main.ts              # GASエントリーポイント（グローバル関数をエクスポート）
├── container.ts         # DIコンテナ（サービスの依存性注入）
├── interfaces/
│   └── index.ts         # 抽象インターフェース（HttpClient, SpreadsheetClient等）
├── adapters/
│   └── gas/
│       └── index.ts     # GAS固有API実装
├── config/
│   ├── settings.ts      # スクリプトプロパティ管理
│   └── doraThresholds.ts # DORAパフォーマンスレベル閾値（年次更新）
├── services/
│   ├── github.ts        # GitHub API連携
│   ├── githubAuth.ts    # GitHub認証（PAT/Apps）
│   ├── spreadsheet.ts   # スプレッドシート書き出し
│   └── migration.ts     # スキーママイグレーション
├── schemas/
│   └── index.ts         # スプレッドシートスキーマ定義
├── types/
│   └── index.ts         # 型定義
└── utils/
    └── metrics.ts       # DORA指標計算ロジック
tests/
├── unit/                # ユニットテスト
├── integration/         # 統合テスト
├── mocks/               # モック実装
└── helpers/             # テストヘルパー
```

## 開発コマンド
```bash
bun run build        # TypeScript → GAS用JSにビルド
bun run push         # ビルド＆GASにデプロイ
bun test             # テスト実行
bun run lint         # ESLintチェック
bun run lint:fix     # ESLint自動修正
bun run format       # Prettierフォーマット
bun run format:check # Prettierチェック（CI用）
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

## TODO / 拡張案
- [ ] 複数期間（週次/月次）のサマリー
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
- [docs/adr/](docs/adr/) - 設計判断の記録（ADR）

## 作業完了時のチェック

コード変更後は以下を確認してください：

```bash
bunx tsc --noEmit      # 型エラーなし
bun run lint           # Lint警告なし
bun test               # テスト通過
bun run build          # ビルド成功
```

確認項目：
- 未使用のimport/変数がないか
- 新機能にテストを追加したか
- 必要に応じてドキュメントを更新したか

## 設計判断の記録

重要な設計判断をした場合は、規模に応じて記録してください：

| 規模 | 記録先 | 例 |
|------|--------|-----|
| 小 | コミットメッセージ | バグ修正、軽微な改善 |
| 中 | PR Description | 機能追加、リファクタリング |
| 大 | ADR（docs/adr/） | アーキテクチャ変更、技術選定 |
