# クイックスタート

このガイドでは、DevSyncGASを最短でセットアップして動かすまでを説明します。

---

## 前提条件

- [Bun](https://bun.sh/) がインストールされている
- Googleアカウントを持っている
- GitHubアカウントを持っている（計測したいリポジトリにアクセスできる）

---

## Step 1: プロジェクトを準備する

```bash
git clone https://github.com/your-org/dev-sync-gas.git
cd dev-sync-gas
bun install
```

---

## Step 2: Google Apps Scriptにデプロイする

### 2.1 Apps Script APIを有効化

https://script.google.com/home/usersettings にアクセスし、「Google Apps Script API」を**オン**にします。

### 2.2 claspでログイン

```bash
bunx clasp login
```

ブラウザが開くので、Googleアカウントで認証してください。

### 2.3 GASプロジェクトを作成

```bash
bunx clasp create --title "DevSyncGAS" --type standalone --rootDir ./dist
```

### 2.4 デプロイ

```bash
bun run push
```

---

## Step 3: スプレッドシートを作成する

1. [Google スプレッドシート](https://sheets.google.com/) で新しいスプレッドシートを作成
2. URLからスプレッドシートIDをコピー

```
https://docs.google.com/spreadsheets/d/【ここがID】/edit
```

---

## Step 4: GitHubトークンを取得する（PAT認証）

1. [GitHub Personal Access Tokens](https://github.com/settings/personal-access-tokens/new) にアクセス
2. 以下を設定:
   - **Token name**: DevSyncGAS
   - **Expiration**: 90日（推奨）
   - **Repository access**: 計測したいリポジトリを選択
   - **Permissions**:
     - `Pull requests`: Read-only
     - `Actions`: Read-only
     - `Metadata`: Read-only（自動）
3. 「Generate token」をクリックし、トークンをコピー

> **組織での運用**: GitHub Apps認証を推奨します → [GitHub Apps 認証ガイド](GITHUB_APPS_AUTH.md)

---

## Step 5: GASエディタで初期設定

1. https://script.google.com/ にアクセス
2. 「DevSyncGAS」プロジェクトを開く
3. 以下の関数を実行:

```javascript
// 初期設定
setup('ghp_xxxx', 'spreadsheet-id');

// リポジトリを追加
addRepo('owner', 'repo-name');

// 動作確認
syncDevOpsMetrics();
```

初回実行時は権限の承認が求められます。「許可」をクリックしてください。

---

## Step 6: 動作確認

スプレッドシートを開いて、データが書き込まれていることを確認します。

**作成されるシート:**
- `Dashboard` - 全リポジトリの指標一覧
- `Dashboard - Trend` - 週次トレンド
- `DevOps Summary` - リポジトリ比較
- `owner/repo` - リポジトリ別の詳細データ

---

## 日次自動実行を設定する（オプション）

毎日自動でメトリクスを収集したい場合:

```javascript
createDailyTrigger();
```

これで毎日午前9時に自動実行されます。

---

## 次のステップ

- **[計測思想を理解する](MEASUREMENT_PHILOSOPHY.md)** - なぜこの指標を、この方法で測るのか
- **[組織導入ガイド](SETUP_AND_TROUBLESHOOTING.md)** - チームでの導入、トラブルシューティング
- **[GitHub Apps認証](GITHUB_APPS_AUTH.md)** - 組織向けのセキュアな認証方式

---

## よくある質問

### Q: 「認証が必要です」が繰り返し表示される

一部の権限のみ許可している可能性があります。[トラブルシューティング](SETUP_AND_TROUBLESHOOTING.md#認証が必要ですが繰り返し表示される) を参照してください。

### Q: スプレッドシートにデータが出力されない

`checkConfig()` を実行して設定を確認してください:

```javascript
checkConfig();
```

### Q: 複数のリポジトリを監視したい

`addRepo()` で追加できます:

```javascript
addRepo('your-org', 'frontend');
addRepo('your-org', 'backend');
addRepo('your-org', 'api');
```

### Q: トークンの有効期限が切れた

新しいトークンを発行して、`setup()` を再実行してください:

```javascript
setup('ghp_新しいトークン', 'spreadsheet-id');
```
