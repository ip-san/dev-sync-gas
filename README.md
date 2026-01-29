# DevSyncGAS

GitHub複数リポジトリからDevOps指標（DORA metrics）を収集し、Googleスプレッドシートに書き出すGASプロダクト。

## 目次

- [なぜこのツールを作ったか](#なぜこのツールを作ったか)
- [機能](#機能)
- [セットアップ](#セットアップ)
- [利用可能な関数](#利用可能な関数)
- [必要なAPIトークン](#必要なapiトークン)
- [ディレクトリ構成](#ディレクトリ構成)
- [開発](#開発)
- [ドキュメント](#ドキュメント)

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
| **開発体験** | PRサイズ | コードの肥大化が起きていないか |

> ★ = DORA指標（業界標準の4つの主要指標）

## 機能

- 複数GitHubリポジトリからPR・デプロイメント情報を取得
- DORA 4 Key Metrics を自動計算
  - Deployment Frequency（デプロイ頻度）
  - Lead Time for Changes（変更のリードタイム）
  - Change Failure Rate（変更失敗率）
  - Mean Time to Recovery（平均復旧時間）
- サイクルタイム計測（[詳細ドキュメント](docs/CYCLE_TIME.md)）
  - GitHub Issue作成〜Productionマージまでの時間を自動集計
- コーディング時間計測（[詳細ドキュメント](docs/CODING_TIME.md)）
  - GitHub Issue作成〜PR作成までの時間を自動集計
- レビュー効率計測（[詳細ドキュメント](docs/REVIEW_EFFICIENCY.md)）
  - PRのレビュー待ち時間・レビュー時間・マージ待ち時間を自動集計
- PRサイズ計測（[詳細ドキュメント](docs/PR_SIZE.md)）
  - PRの変更行数・変更ファイル数を自動集計
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

### 5. スプレッドシートの作成

1. [Google スプレッドシート](https://sheets.google.com/) で新しいスプレッドシートを作成
2. URLからスプレッドシートIDを取得

```
https://docs.google.com/spreadsheets/d/【この部分がSPREADSHEET_ID】/edit
```

> **Note**: シートは自動作成されるため、空のスプレッドシートのままでOKです。

### 6. 初期設定ファイルの作成

```bash
cp src/init.example.ts src/init.ts
```

`src/init.ts` を編集して、自分の環境に合わせて設定してください：

```typescript
const GITHUB_TOKEN = "your_github_token_here";
const SPREADSHEET_ID = "your_spreadsheet_id_here";  // 手順5で取得したID

// 計測対象のリポジトリを追加（複数可）
const REPOSITORIES = [
  { owner: "your-org", name: "frontend" },
  { owner: "your-org", name: "backend" },
  { owner: "your-org", name: "api-server" },
];
```

> **Note**: `src/init.ts` はgit管理外です。トークンをコミットしないでください。
>
> **Tip**: リポジトリは `init.ts` で事前に定義しておくか、デプロイ後にGASエディタで `addRepo()` を使って追加できます（手順9参照）。

### 7. ビルド＆デプロイ

```bash
bun run push
```

### 8. GASエディタで初期設定を実行

1. https://script.google.com/ にアクセス
2. デプロイしたプロジェクト「DevSyncGAS」を開く
3. 関数選択ドロップダウンで `initConfig` を選択
4. 「実行」ボタンをクリック
5. 初回実行時は権限の承認が必要です（以下の手順で許可）

#### 権限の承認手順

初回実行時に「承認が必要です」というダイアログが表示されます。

1. 「権限を確認」をクリック
2. Googleアカウントを選択
3. 「このアプリは Google で確認されていません」と表示されたら：
   - 「詳細」をクリック
   - 「DevSyncGAS（安全ではないページ）に移動」をクリック
4. 「DevSyncGAS が Google アカウントへのアクセスをリクエストしています」と表示されたら「許可」をクリック

> **Note**: 「確認されていません」の警告は、自分で作成したスクリプトでは正常な動作です。Googleの審査を受けていないだけで、危険ではありません。
>
> 一度承認すれば設定はScript Propertiesに永続化されます。以降は `syncDevOpsMetrics` を実行するだけでOKです。

### 9. リポジトリの登録（init.tsで設定済みの場合はスキップ可）

手順6で `init.ts` にリポジトリを設定した場合、`initConfig` 実行時に自動登録されます。

追加・変更が必要な場合は、GASエディタで以下の関数を実行してください。

```javascript
// リポジトリを追加（owner と name を指定）
addRepo('your-org', 'repo-name');

// 複数リポジトリを追加する場合は、それぞれ実行
addRepo('your-org', 'frontend');
addRepo('your-org', 'backend');
addRepo('your-org', 'api-server');

// 登録済みリポジトリの確認
listRepos();

// リポジトリを削除する場合
removeRepo('your-org/repo-name');
```

> **Note**: リポジトリは何個でも追加できます。追加したリポジトリすべてのメトリクスが1つのスプレッドシートに集約されます。

### 10. 動作確認

セットアップが完了したら、手動でメトリクス収集を実行して動作確認します。

1. 関数選択ドロップダウンで `syncDevOpsMetrics` を選択
2. 「実行」ボタンをクリック
3. 実行ログで「✅ Synced metrics for X repositories」と表示されれば成功
4. スプレッドシートを開いて「DevOps Metrics」シートにデータが書き込まれていることを確認

> **出力されるシート**: DevOps Metrics, DevOps Metrics - Summary, サイクルタイム, コーディング時間, 手戻り率, レビュー効率, PRサイズ（各メトリクス収集関数を実行すると対応するシートが作成されます）

### 11. 日次トリガーの設定（推奨）

毎日自動でメトリクスを収集するには、トリガーを設定します。

1. GASエディタを開く（手順10から続けて操作する場合は不要）
2. 関数選択ドロップダウンから `createDailyTrigger` を選択
3. 「実行」ボタンをクリック

これで毎日午前9時に `syncDevOpsMetrics` が自動実行されます。

> **Note**: トリガーの確認・削除は、GASエディタの左メニュー「トリガー」（時計アイコン）から行えます。

## 利用可能な関数

### 初期設定・認証

| 関数 | 説明 |
|------|------|
| `initConfig()` | 初期設定を実行（init.tsで定義） |
| `setup(github, spreadsheet)` | 設定をScript Propertiesに保存（PAT認証） |
| `setupWithGitHubApp(appId, key, instId, spreadsheet)` | GitHub Apps認証で設定 |
| `showAuthMode()` | 現在の認証モードを表示 |
| `addRepo(owner, name)` | リポジトリを追加 |
| `removeRepo(fullName)` | リポジトリを削除 |
| `listRepos()` | 登録済みリポジトリ一覧 |

### メトリクス収集

| 関数 | 説明 |
|------|------|
| `syncDevOpsMetrics()` | 手動でメトリクスを同期 |
| `syncCycleTime(days?)` | サイクルタイムを計測 |
| `syncCodingTime(days?)` | コーディング時間を計測 |
| `syncReworkRate(days?)` | 手戻り率を計測 |
| `syncReviewEfficiency(days?)` | レビュー効率を計測 |
| `syncPRSize(days?)` | PRサイズを計測 |
| `syncHistoricalMetrics(days)` | 過去データを一括収集 |
| `syncLast30Days()` | 過去30日分を収集 |
| `syncLast90Days()` | 過去90日分を収集 |

### 設定（サイクルタイム）

| 関数 | 説明 |
|------|------|
| `configureProductionBranch(pattern)` | productionブランチパターンを設定 |
| `showProductionBranch()` | 現在のパターンを表示 |
| `resetProductionBranch()` | パターンをデフォルトにリセット |
| `configureCycleTimeLabels(labels)` | 対象Issueラベルを設定 |
| `showCycleTimeLabels()` | 現在のラベル設定を表示 |
| `resetCycleTimeLabelsConfig()` | ラベル設定をリセット |
| `showCycleTimeConfig()` | 全設定を表示 |

### 設定（コーディング時間）

| 関数 | 説明 |
|------|------|
| `configureCodingTimeLabels(labels)` | 対象Issueラベルを設定 |
| `showCodingTimeLabels()` | 現在のラベル設定を表示 |
| `resetCodingTimeLabelsConfig()` | ラベル設定をリセット |
| `showCodingTimeConfig()` | 全設定を表示 |

### プロジェクトグループ（複数スプレッドシート対応）

複数のスプレッドシートにリポジトリ群を分けて出力できます。例えば、チームごとやプロダクトごとに別のスプレッドシートで管理したい場合に便利です。

| 関数 | 説明 |
|------|------|
| `createProject(name, spreadsheetId, sheetName?)` | プロジェクトグループを作成 |
| `modifyProject(name, spreadsheetId?, sheetName?)` | プロジェクトの設定を変更 |
| `deleteProject(name)` | プロジェクトグループを削除 |
| `listProjects()` | プロジェクト一覧を表示 |
| `addRepoToProject(projectName, owner, repoName)` | プロジェクトにリポジトリを追加 |
| `removeRepoFromProject(projectName, fullName)` | プロジェクトからリポジトリを削除 |
| `syncAllProjects()` | 全プロジェクトのメトリクスを収集 |
| `syncProject(projectName)` | 特定プロジェクトのメトリクスを収集 |
| `syncAllProjectsHistorical(days)` | 全プロジェクトの過去データを収集 |
| `generateAllProjectSummaries()` | 全プロジェクトのサマリーシートを生成 |

#### 使用例

```javascript
// プロジェクトを作成（チームAはspreadsheet-aに出力）
createProject('TeamA', 'spreadsheet-id-a', 'DevOps Metrics');

// プロジェクトにリポジトリを追加
addRepoToProject('TeamA', 'your-org', 'frontend');
addRepoToProject('TeamA', 'your-org', 'backend');

// 別のプロジェクトを作成（チームBはspreadsheet-bに出力）
createProject('TeamB', 'spreadsheet-id-b', 'DevOps Metrics');
addRepoToProject('TeamB', 'your-org', 'mobile-app');
addRepoToProject('TeamB', 'your-org', 'api-gateway');

// プロジェクト一覧を確認
listProjects();

// 全プロジェクトのメトリクスを収集
syncAllProjects();

// 特定プロジェクトのみ収集
syncProject('TeamA');

// 全プロジェクトのサマリーシートを生成
generateAllProjectSummaries();
```

> **Note**: プロジェクトグループが設定されていない場合は、従来の単一スプレッドシートモードで動作します（後方互換性あり）。

### 運用・メンテナンス

| 関数 | 説明 |
|------|------|
| `createDailyTrigger()` | 日次トリガーを設定 |
| `generateSummary()` | サマリーシートを作成 |
| `cleanup(days)` | 古いデータを削除 |
| `testPermissions()` | 権限テスト（初回実行で承認ダイアログ表示） |

### スキーママイグレーション

ツールのバージョンアップでスプレッドシートの列構成が変わった場合に使用します。

| 関数 | 説明 |
|------|------|
| `previewMigration()` | 変更内容をプレビュー（データ変更なし） |
| `migrateAllSchemas()` | 全シートのマイグレーションを実行 |
| `migrateSheet(sheetName)` | 特定シートのみマイグレーション |
| `updateHeadersOnly()` | ヘッダー行のみ更新（データ並べ替えなし） |
| `showBackupCleanupHelp()` | バックアップシートの削除手順を表示 |

> **マイグレーションの安全機能**: マイグレーション実行時は自動的にバックアップシート（`_backup_シート名_日時`）が作成されます。マイグレーション失敗時は自動でロールバックされます。成功後、不要になったバックアップシートは手動で削除してください。

## 必要なAPIトークン

### GitHub認証（2つの方式から選択）

#### 方式1: Personal Access Token（PAT）- 個人/小規模向け

Fine-grained personal access tokens（推奨）を使用してください。

1. [GitHub Personal Access Tokens](https://github.com/settings/personal-access-tokens/new) にアクセス
2. 以下を設定：
   - **Token name**: DevSyncGAS
   - **Expiration**: 任意（90日など、最長1年）
   - **Resource owner**: 自分のアカウントまたはOrganizationを選択
   - **Repository access**: 「Only select repositories」で対象リポジトリを選択
   - **Permissions** → **Repository permissions**:
     - `Pull requests`: Read-only
     - `Actions`: Read-only
     - `Metadata`: Read-only（自動で設定されます）
3. 「Generate token」をクリックし、表示されたトークンをコピー（再表示不可）

#### 方式2: GitHub Apps - Organization/チーム向け

Organization運用やセキュリティ要件が厳しい環境では、GitHub Apps認証を推奨します。

**メリット:**
- 個人アカウントに依存しない（退職時の影響なし）
- より高いレート制限（15,000 req/hour）
- 詳細な監査ログ

詳細は [GitHub Apps 認証ガイド](docs/GITHUB_APPS_AUTH.md) を参照してください。

## ディレクトリ構成

```
DevSyncGAS/
├── src/
│   ├── main.ts           # エントリーポイント
│   ├── init.example.ts   # 初期設定テンプレート
│   ├── init.ts           # 初期設定（git管理外）
│   ├── container.ts      # DIコンテナ
│   ├── config/
│   │   ├── settings.ts   # 設定管理
│   │   └── doraThresholds.ts # DORAレベル閾値
│   ├── services/
│   │   ├── github.ts     # GitHub API
│   │   ├── githubAuth.ts # GitHub認証（PAT/Apps）
│   │   ├── spreadsheet.ts # スプレッドシート操作
│   │   └── migration.ts  # スキーママイグレーション
│   ├── schemas/
│   │   └── index.ts      # スプレッドシートスキーマ定義
│   ├── types/
│   │   └── index.ts      # 型定義
│   └── utils/
│       └── metrics.ts    # 指標計算
├── dist/                 # ビルド出力
├── tests/                # テスト
├── docs/                 # ドキュメント
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
- [サイクルタイム実装ガイド](docs/CYCLE_TIME.md) - GitHub Issue作成〜Productionマージの計測方法
- [コーディング時間実装ガイド](docs/CODING_TIME.md) - GitHub Issue作成〜PR作成時間の計測方法

### 安定性と品質
- [手戻り率実装ガイド](docs/REWORK_RATE.md) - PR作成後の追加コミット数・Force Push回数の計測方法
- [レビュー効率実装ガイド](docs/REVIEW_EFFICIENCY.md) - PRのレビュー待ち時間・レビュー時間の計測方法

### 開発体験
- [PRサイズ実装ガイド](docs/PR_SIZE.md) - PRの変更行数・変更ファイル数の計測方法

### 導入・運用
- [GitHub Apps 認証ガイド](docs/GITHUB_APPS_AUTH.md) - Organization向けのGitHub Apps認証の設定方法
- [組織導入ガイド＆トラブルシューティング](docs/SETUP_AND_TROUBLESHOOTING.md) - 組織での導入手順、権限設定、トラブル対応

## License

MIT
