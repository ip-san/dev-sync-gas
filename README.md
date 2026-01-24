# DevSyncGAS

GitHub複数リポジトリとNotionを連携してDevOps指標（DORA metrics）をGoogleスプレッドシートに書き出すGASプロダクト。

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

### 7. 初期設定の実行

GASエディタで `initConfig` 関数を実行します。これにより設定がScript Propertiesに保存されます。

> **Note**: 一度実行すれば設定は永続化されます。以降は `syncDevOpsMetrics` を実行するだけでOKです。

### 8. トリガー設定（オプション）

```javascript
createDailyTrigger(); // 毎日9時に自動実行
```

## 利用可能な関数

| 関数 | 説明 |
|------|------|
| `initConfig()` | 初期設定を実行（init.tsで定義） |
| `syncDevOpsMetrics()` | 手動でメトリクスを同期 |
| `syncCycleTime(days?, prop?)` | サイクルタイムを計測（Notion連携必須） |
| `syncCodingTime(prop?)` | コーディング時間を計測（Notion + GitHub連携必須） |
| `syncReworkRate(days?)` | 手戻り率を計測（GitHub連携必須） |
| `createDailyTrigger()` | 日次トリガーを設定 |
| `setup(github, spreadsheet, notion?, notionDb?)` | 設定をScript Propertiesに保存 |
| `addRepo(owner, name)` | リポジトリを追加 |
| `removeRepo(fullName)` | リポジトリを削除 |
| `listRepos()` | 登録済みリポジトリ一覧 |
| `cleanup(days)` | 古いデータを削除 |
| `generateSummary()` | サマリーシートを作成 |

## 必要なAPIトークン

### GitHub Personal Access Token

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

- [DORA Metrics 実装ガイド](docs/DORA_METRICS.md) - 4つの主要指標の定義、計算方法、制約事項の解説
- [サイクルタイム実装ガイド](docs/CYCLE_TIME.md) - Notionタスクの着手〜完了時間の計測方法
- [コーディング時間実装ガイド](docs/CODING_TIME.md) - Notion着手〜GitHub PR作成時間の計測方法
- [手戻り率実装ガイド](docs/REWORK_RATE.md) - PR作成後の追加コミット数・Force Push回数の計測方法

## License

MIT
