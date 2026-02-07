# DevSyncGAS セットアップガイド

DevSyncGASを組織で利用する際に必要な設定と担当者への依頼事項をまとめたガイドです。

---

## 目次

1. [概要](#概要)
2. [必要な権限と担当者](#必要な権限と担当者)
3. [Google Workspace設定](#google-workspace設定)
4. [GitHub設定](#github設定)

---

## 概要

DevSyncGASは以下の2つのサービスと連携します：

| サービス | 取得データ | 接続方式 |
|----------|-----------|----------|
| **GitHub** | PR情報、デプロイ情報、ワークフロー、Issue | REST API |
| **Google Sheets** | 指標出力先 | GAS API |

```
GitHub  ──(REST API)──▶  Google Apps Script  ──(GAS API)──▶  Google Sheets
                              (DevSyncGAS)
```

### 導入前チェックリスト

| 項目 | 担当者 | 必須/任意 |
|------|--------|----------|
| Google Apps Script API有効化 | GAS利用者 | 必須 |
| Googleスプレッドシート作成 | GAS利用者 | 必須 |
| **GitHub認証（以下いずれか）** | - | **必須** |
| └ PAT発行 | リポジトリ管理者 | 個人/小規模向け |
| └ GitHub App作成 | 組織管理者 | 組織/チーム向け |

---

## 必要な権限と担当者

### 役割別の作業一覧

#### 1. GAS利用者（ツール導入者）

**必要な権限:**
- Googleアカウント
- Google Apps Script API へのアクセス

**作業内容:**
- Apps Script APIの有効化
- claspのインストールとログイン
- スクリプトのデプロイ
- トリガーの設定

#### 2. GitHubリポジトリ管理者（PAT認証の場合）

**必要な権限:**
- 対象リポジトリへのRead権限
- Personal Access Token発行権限

**作業内容:**
- Fine-grained Personal Access Tokenの発行
- 必要なパーミッションの付与

#### 2b. GitHub組織管理者（GitHub Apps認証の場合）

**必要な権限:**
- 組織の管理者権限
- GitHub Appsの作成・インストール権限

**作業内容:**
- GitHub Appの作成と権限設定
- Private Keyの生成と安全な共有
- 対象リポジトリへのAppインストール

---

## Google Workspace設定

### 1. Apps Script APIの有効化

**対象者:** GAS利用者

1. https://script.google.com/home/usersettings にアクセス
2. 「Google Apps Script API」を**オン**に切り替え

```
⚠️ 注意: この設定は個人のGoogleアカウントに対して行います。
組織のGoogle Workspaceを使用している場合は、管理者がAPIアクセスを
許可している必要があります。
```

### 2. Google Workspaceの組織設定（管理者向け）

**対象者:** Google Workspace管理者

組織でGASの利用を制限している場合、以下の設定が必要です：

1. Google管理コンソール (https://admin.google.com) にアクセス
2. **アプリ** → **Google Workspace** → **ドライブとドキュメント**
3. **機能とアプリケーション** → **Apps Script**
4. 「ユーザーがApps Scriptを実行できるようにする」を有効化

### 3. スプレッドシートの準備

**対象者:** GAS利用者

1. 新しいGoogleスプレッドシートを作成
2. URLからスプレッドシートIDを取得

```
https://docs.google.com/spreadsheets/d/【このIDをコピー】/edit
```

### 4. claspのセットアップ

```bash
# claspのログイン
bunx clasp login

# プロジェクトの作成
bunx clasp create --title "DevSyncGAS" --type standalone --rootDir ./dist

# デプロイ
bun run push
```

### 5. GAS実行時のOAuth権限

**対象者:** GAS利用者

GASエディタで関数を初めて実行すると、**OAuth認証ダイアログ**が表示されます。
DevSyncGASが正常に動作するには、以下の権限を**すべて許可**する必要があります。

#### 必要な権限一覧

| 権限 | 用途 | 対応するGASサービス |
|-----|------|-------------------|
| 外部サービスへの接続 | GitHub APIへのリクエスト | `UrlFetchApp` |
| Googleスプレッドシートの表示・編集 | 指標データの書き出し | `SpreadsheetApp` |
| スクリプトプロパティへのアクセス | APIトークン等の設定保存 | `PropertiesService` |
| トリガーの表示・管理 | 日次自動実行の設定 | `ScriptApp` |

#### 認証ダイアログの流れ

1. GASエディタで関数を実行（例: `syncDevOpsMetrics`）
2. 「認証が必要です」ダイアログが表示される
3. 「権限を確認」をクリック
4. Googleアカウントを選択
5. 「このアプリは確認されていません」が表示される場合:
   - 「詳細」をクリック
   - 「（プロジェクト名）に移動」をクリック
6. 要求される権限を確認して「許可」をクリック

```
⚠️ 重要:
- すべての権限を許可しないと、スクリプトは正常に動作しません
- 「キャンセル」や権限の一部拒否をした場合、再認証が必要です
```

#### 権限を拒否してしまった場合の再認証方法

誤って「キャンセル」したり、権限を拒否した場合は、以下の手順で再認証できます。

**方法1: GASエディタから再実行（推奨）**

1. GASエディタで任意の関数を実行
2. 認証ダイアログが再度表示される
3. 今度は「許可」をクリック

**方法2: Googleアカウントから権限をリセット**

認証ダイアログが表示されない場合：

1. https://myaccount.google.com/permissions にアクセス
2. 「サードパーティ製のアプリとサービス」から対象のGASプロジェクトを探す
3. クリックして「アクセス権を削除」
4. GASエディタで関数を再実行（認証ダイアログが表示される）

**方法3: GASプロジェクトのトリガーから確認**

1. GASエディタ → 左サイドバー「トリガー」（時計アイコン）
2. 既存のトリガーがある場合、一度削除
3. 新しいトリガーを追加（実行する関数を選択）
4. 認証ダイアログが表示される

#### プロジェクトのOAuthスコープ確認方法

現在のプロジェクトが要求するOAuthスコープを確認できます：

1. GASエディタ → 左サイドバー「プロジェクトの設定」（歯車アイコン）
2. 下部にある「プロジェクトの OAuth スコープ」セクションを確認

DevSyncGASで使用されるスコープ例：
```
https://www.googleapis.com/auth/spreadsheets    # スプレッドシート
https://www.googleapis.com/auth/script.external_request  # 外部API
https://www.googleapis.com/auth/script.scriptapp  # トリガー管理
```

---

## GitHub設定

### 認証方式の選択

DevSyncGASは2つのGitHub認証方式をサポートしています。組織の状況に応じて選択してください。

| 観点 | PAT（Personal Access Token） | GitHub Apps |
|------|------------------------------|-------------|
| **推奨ケース** | 個人利用、小規模チーム | 組織運用、複数人で共有 |
| **セットアップ** | 簡単（5分程度） | やや複雑（15分程度） |
| **認証主体** | 個人アカウント | アプリケーション |
| **退職時の影響** | トークン無効化が必要 | なし |
| **有効期限** | 設定次第（最大無期限） | 1時間で自動更新 |
| **レート制限** | 5,000 req/hour | 15,000 req/hour |
| **監査ログ** | 個人のアクセスとして記録 | App単位で詳細に記録 |

**選択の目安:**

```
個人で使う / 試しに導入したい → PAT認証（シンプル）
チームで使う / 本格運用 → GitHub Apps（推奨）
セキュリティ要件が厳しい → GitHub Apps（必須）
```

> **組織での運用には GitHub Apps を推奨します。**
> 個人のPATに依存すると、担当者の退職時にトークンが無効になり、運用が止まるリスクがあります。

GitHub Appsの詳細な設定手順は [GitHub Apps 認証ガイド](GITHUB_APPS_AUTH.md) を参照してください。

---

### PAT認証: Fine-grained Personal Access Tokenの発行

**対象者:** GitHubリポジトリ管理者

1. GitHub → **Settings** → **Developer settings**
2. **Personal access tokens** → **Fine-grained tokens**
3. 「Generate new token」をクリック

#### 必要なパーミッション

| カテゴリ | パーミッション | 権限レベル | 用途 |
|---------|---------------|-----------|------|
| Repository permissions | **Metadata** | Read-only | リポジトリ情報取得（必須） |
| Repository permissions | **Pull requests** | Read-only | PR情報取得 |
| Repository permissions | **Actions** | Read-only | ワークフロー実行履歴取得 |
| Repository permissions | **Deployments** | Read-only | デプロイメント情報取得 |
| Repository permissions | **Issues** | Read-only | インシデント計測（オプション） |

```
⚠️ 重要:
- Metadataパーミッションは必須です（他のパーミッションの前提条件）
- Repository accessで対象リポジトリを明示的に選択してください
- 有効期限は90日程度を推奨（期限切れ前に更新を忘れずに）
```

### PAT認証: 組織リポジトリへのアクセス

**対象者:** 組織管理者

組織のリポジトリにアクセスする場合、追加の許可が必要な場合があります：

1. 組織の **Settings** → **Third-party access**
2. **Personal access tokens** → **Settings**
3. 「Allow access via fine-grained personal access tokens」を有効化

### PAT認証: トークンの設定

1. `src/init.ts` を編集：

```typescript
export const config: InitConfig = {
  auth: {
    type: 'token',
    token: 'ghp_xxxxxxxxxxxx',  // GitHub PAT
  },
  spreadsheet: {
    id: 'spreadsheet-id',
  },
  repositories: [
    { owner: 'owner', name: 'repo-name' },
  ],
};
```

2. デプロイして、GASエディタで `initConfig()` を実行

---

### GitHub Apps認証: セットアップ

**対象者:** GitHub組織管理者

GitHub Appsを使用する場合、以下の手順で設定します。詳細は [GitHub Apps 認証ガイド](GITHUB_APPS_AUTH.md) を参照してください。

#### 必要な情報

| 項目 | 取得場所 |
|------|---------|
| App ID | App設定ページの「App ID」 |
| Private Key | ダウンロードした `.pem` ファイルの内容 |
| Installation ID | インストールURLの数字部分 |

#### セットアップ手順

1. `src/init.ts` を編集：

```typescript
export const config: InitConfig = {
  auth: {
    type: 'github-app',
    appId: '123456',
    installationId: '12345678',
    privateKey: `-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----`,
  },
  spreadsheet: {
    id: 'spreadsheet-id',
  },
  repositories: [
    { owner: 'your-org', name: 'repo-name' },
  ],
};
```

2. デプロイして、GASエディタで `initConfig()` を実行

#### 認証方式の切り替え

現在の認証方式を確認するには：

```javascript
showAuthMode();  // => "🔐 Current auth mode: GitHub App"
```

PAT認証に戻す場合は、`src/init.ts` を更新：

```typescript
auth: {
  type: 'token',  // 'github-app' から 'token' に変更
  token: 'ghp_xxxx',
}
```

再デプロイして `initConfig()` を実行してください。

---

## 関連ドキュメント

- [トラブルシューティング](TROUBLESHOOTING.md) - エラー解決方法
- [よくある質問](FAQ.md) - FAQ
- [GitHub Apps 認証ガイド](GITHUB_APPS_AUTH.md) - GitHub Apps認証の設定方法
- [README](../README.md) - プロジェクト概要
