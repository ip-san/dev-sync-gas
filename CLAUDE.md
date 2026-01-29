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
bun run build    # TypeScript → GAS用JSにビルド
bun run push     # ビルド＆GASにデプロイ
bun test         # テスト実行
bun run lint     # リント
```

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

## TODO / 拡張案
- [ ] GitHub GraphQL APIに移行（レート制限対策）
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
