# DevSyncGAS

GitHub複数リポジトリとNotionを連携してDevOps指標（DORA metrics）をGoogleスプレッドシートに書き出すGASプロダクト。

## なぜこのツールを作ったか

AI駆動開発が当たり前になりつつある今、「本当に生産性は上がっているのか？」という疑問を持っていませんか。

Claude CodeやCopilotなどのAIツールを導入して「コードを書く速度は上がった気がする」。でも、それは本当にチーム全体の生産性向上に繋がっているのでしょうか。

- 速くなったが、バグが増えていないか？
- AIが生成したコードは、レビューしやすいか？
- 手戻りが増えていないか？
- 開発者は楽になったと感じているか？

これらの問いに答えるには、**感覚ではなくデータで判断する**必要があります。

このツールは、以前から業界標準として確立されているDORA指標と、AI時代に特に注視すべき追加指標を組み合わせて計測します。データに基づいて改善サイクルを回し、AIと共に開発プロセスを継続的に進化させていくためのツールです。

### 計測指標の全体像

| カテゴリ | 指標 | 何を見るか |
|---------|------|-----------|
| **スピードと効率** | ★デプロイ頻度、★リードタイム、サイクルタイム、コーディング時間 | AIで実装サイクルが本当に早まっているか |
| **安定性と品質** | ★変更障害率、★MTTR、手戻り率、レビュー効率 | 速さの代償として品質が犠牲になっていないか |
| **開発体験** | PRサイズ、開発者満足度 | コードの肥大化や開発者の疲弊が起きていないか |

> ★ = DORA指標（業界標準の4つの主要指標）

## 機能

- 複数GitHubリポジトリからPR・デプロイメント情報を取得
- DORA 4 Key Metrics を自動計算（[詳細ドキュメント](docs/DORA_METRICS.md)）
  - Deployment Frequency（デプロイ頻度）
  - Lead Time for Changes（変更のリードタイム）
  - Change Failure Rate（変更失敗率）
  - Mean Time to Recovery（平均復旧時間）
- サイクルタイム計測（[詳細ドキュメント](docs/CYCLE_TIME.md)）
  - Notionのタスク着手〜完了までの時間を自動集計
- コーディング時間計測（[詳細ドキュメント](docs/CODING_TIME.md)）
  - Notionのタスク着手〜GitHub PR作成までの時間を自動集計
- レビュー効率計測（[詳細ドキュメント](docs/REVIEW_EFFICIENCY.md)）
  - PRのレビュー待ち時間・レビュー時間・マージ待ち時間を自動集計
- PRサイズ計測（[詳細ドキュメント](docs/PR_SIZE.md)）
  - PRの変更行数・変更ファイル数を自動集計
- 開発者満足度計測（[詳細ドキュメント](docs/DEVELOPER_SATISFACTION.md)）
  - Notionタスク完了時の満足度スコア（★1〜5）を自動集計
- Notionデータベースとの連携
- Googleスプレッドシートへの自動書き出し
- 日次トリガーによる定期実行

## セットアップ

### 1. 依存関係のインストール

```bash
bun install
```

### 2. claspのログイン

```bash
bunx clasp login
```

### 3. Apps Script APIの有効化

https://script.google.com/home/usersettings にアクセスし、「Google Apps Script API」をオンにしてください。

### 4. GASプロジェクトの作成

```bash
bunx clasp create --title "DevSyncGAS" --type standalone --rootDir ./dist
```

作成後、`.clasp.json` が生成されます（このファイルはgit管理外）。

> **Note**: `.clasp.example.json` をコピーして `.clasp.json` を手動作成することもできます。

### 5. 初期設定ファイルの作成

```bash
cp src/init.example.ts src/init.ts
```

`src/init.ts` を編集して、自分の環境に合わせて設定してください：

```typescript
const GITHUB_TOKEN = "your_github_token_here";
const SPREADSHEET_ID = "your_spreadsheet_id_here";

const REPOSITORIES = [
  { owner: "owner1", name: "repo1" },
];
```

> **Note**: `src/init.ts` はgit管理外です。トークンをコミットしないでください。

### 6. ビルド＆デプロイ

```bash
bun run push
```

### 7. GASエディタで初期設定を実行

1. https://script.google.com/ にアクセス
2. デプロイしたプロジェクト「DevSyncGAS」を開く
3. 関数選択ドロップダウンで `initConfig` を選択
4. 「実行」ボタンをクリック
5. 初回実行時は「承認が必要です」と表示されるので、画面の指示に従って権限を許可

> **Note**: 一度実行すれば設定はScript Propertiesに永続化されます。以降は `syncDevOpsMetrics` を実行するだけでOKです。

### 8. 日次トリガーの設定（推奨）

毎日自動でメトリクスを収集するには、トリガーを設定します。

1. GASエディタを開く（手順7から続けて操作する場合は不要）
2. 関数選択ドロップダウンから `createDailyTrigger` を選択
3. 「実行」ボタンをクリック

これで毎日午前9時に `syncDevOpsMetrics` が自動実行されます。

> **Note**: トリガーの確認・削除は、GASエディタの左メニュー「トリガー」（時計アイコン）から行えます。

## 利用可能な関数

| 関数 | 説明 |
|------|------|
| `initConfig()` | 初期設定を実行（init.tsで定義） |
| `syncDevOpsMetrics()` | 手動でメトリクスを同期 |
| `syncCycleTime(days?, prop?)` | サイクルタイムを計測（Notion連携必須） |
| `syncCodingTime(prop?)` | コーディング時間を計測（Notion + GitHub連携必須） |
| `syncReworkRate(days?)` | 手戻り率を計測（GitHub連携必須） |
| `syncReviewEfficiency(days?)` | レビュー効率を計測（GitHub連携必須） |
| `syncPRSize(days?)` | PRサイズを計測（GitHub連携必須） |
| `syncDeveloperSatisfaction(days?)` | 開発者満足度を計測（Notion連携必須） |
| `createDailyTrigger()` | 日次トリガーを設定 |
| `setup(github, spreadsheet, notion?, notionDb?)` | 設定をScript Propertiesに保存（PAT認証） |
| `setupWithGitHubApp(appId, key, instId, spreadsheet, ...)` | GitHub Apps認証で設定 |
| `showAuthMode()` | 現在の認証モードを表示 |
| `addRepo(owner, name)` | リポジトリを追加 |
| `removeRepo(fullName)` | リポジトリを削除 |
| `listRepos()` | 登録済みリポジトリ一覧 |
| `cleanup(days)` | 古いデータを削除 |
| `generateSummary()` | サマリーシートを作成 |
| `previewMigration()` | スキーマ変更のプレビュー（ドライラン） |
| `migrateAllSchemas()` | 全シートのスキーママイグレーション実行 |
| `migrateSheet(sheetName)` | 特定シートのマイグレーション |
| `updateHeadersOnly()` | ヘッダー行のみ最新に更新 |
| `showBackupCleanupHelp()` | バックアップシート削除の手順を表示 |

## 必要なAPIトークン

### GitHub認証（2つの方式から選択）

#### 方式1: Personal Access Token（PAT）- 個人/小規模向け

Fine-grained personal access tokens（推奨）を使用してください。

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**
2. 「Generate new token」をクリック
3. 以下を設定：
   - **Token name**: DevSyncGAS
   - **Expiration**: 任意（90日など）
   - **Repository access**: 対象リポジトリを選択
   - **Permissions**:
     - `Pull requests`: Read-only
     - `Actions`: Read-only
     - `Metadata`: Read-only（必須）

#### 方式2: GitHub Apps - Organization/チーム向け

Organization運用やセキュリティ要件が厳しい環境では、GitHub Apps認証を推奨します。

**メリット:**
- 個人アカウントに依存しない（退職時の影響なし）
- より高いレート制限（15,000 req/hour）
- 詳細な監査ログ

詳細は [GitHub Apps 認証ガイド](docs/GITHUB_APPS_AUTH.md) を参照してください。

### Notion Integration Token（オプション）

Notion連携を使用する場合のみ必要です。

1. https://www.notion.so/my-integrations でインテグレーションを作成
2. 対象データベースにインテグレーションを追加

`setup()` 関数の第3・第4引数にNotion設定を渡してください：

```javascript
setup('github_token', 'spreadsheet_id', 'notion_token', 'notion_database_id');
```

## ディレクトリ構成

```
DevSyncGAS/
├── src/
│   ├── main.ts           # エントリーポイント
│   ├── init.example.ts   # 初期設定テンプレート
│   ├── init.ts           # 初期設定（git管理外）
│   ├── config/
│   │   └── settings.ts   # 設定管理
│   ├── services/
│   │   ├── github.ts     # GitHub API
│   │   ├── notion.ts     # Notion API
│   │   └── spreadsheet.ts # スプレッドシート操作
│   ├── types/
│   │   └── index.ts      # 型定義
│   └── utils/
│       └── metrics.ts    # 指標計算
├── dist/                 # ビルド出力
├── tests/                # テスト
├── package.json
├── tsconfig.json
├── esbuild.config.ts
├── .clasp.example.json   # clasp設定テンプレート
└── .clasp.json           # clasp設定（git管理外）
```

## 開発

```bash
# ビルドのみ
bun run build

# ビルド＆プッシュ
bun run push

# テスト
bun test

# リント
bun run lint
```

## ドキュメント

### スピードと効率
- [DORA Metrics 実装ガイド](docs/DORA_METRICS.md) - デプロイ頻度・リードタイム・変更障害率・MTTRの計測方法
- [サイクルタイム実装ガイド](docs/CYCLE_TIME.md) - Notionタスクの着手〜完了時間の計測方法
- [コーディング時間実装ガイド](docs/CODING_TIME.md) - Notion着手〜GitHub PR作成時間の計測方法

### 安定性と品質
- [手戻り率実装ガイド](docs/REWORK_RATE.md) - PR作成後の追加コミット数・Force Push回数の計測方法
- [レビュー効率実装ガイド](docs/REVIEW_EFFICIENCY.md) - PRのレビュー待ち時間・レビュー時間の計測方法

### 開発体験
- [PRサイズ実装ガイド](docs/PR_SIZE.md) - PRの変更行数・変更ファイル数の計測方法
- [開発者満足度実装ガイド](docs/DEVELOPER_SATISFACTION.md) - タスク完了時の満足度スコアの計測方法

### 導入・運用
- [GitHub Apps 認証ガイド](docs/GITHUB_APPS_AUTH.md) - Organization向けのGitHub Apps認証の設定方法
- [組織導入ガイド＆トラブルシューティング](docs/SETUP_AND_TROUBLESHOOTING.md) - 組織での導入手順、権限設定、トラブル対応

## License

MIT
