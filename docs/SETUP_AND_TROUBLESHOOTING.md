# 組織導入ガイド＆トラブルシューティング

DevSyncGASを組織で利用する際に必要な設定、担当者への依頼事項、およびトラブルシューティングをまとめたガイドです。

---

## 目次

1. [概要](#概要)
2. [必要な権限と担当者](#必要な権限と担当者)
3. [Google Workspace設定](#google-workspace設定)
   - [GAS実行時のOAuth権限](#5-gas実行時のoauth権限)
4. [GitHub設定](#github設定)
5. [Notion設定](#notion設定)
6. [トラブルシューティング](#トラブルシューティング)
   - [「メニューが見つからない」は権限不足のサイン](#メニューが見つからないは権限不足のサイン)
7. [よくある質問](#よくある質問)

---

## 概要

DevSyncGASは以下の3つのサービスと連携します：

| サービス | 取得データ | 接続方式 |
|----------|-----------|----------|
| **GitHub** | PR情報、デプロイ情報、ワークフロー | REST API |
| **Notion** | タスク情報、コーディング時間、満足度 | REST API |
| **Google Sheets** | 指標出力先 | GAS API |

```
GitHub / Notion  ──(REST API)──▶  Google Apps Script  ──(GAS API)──▶  Google Sheets
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
| Notion Integration作成 | Notionワークスペースオーナー | 任意 |
| Notionデータベース接続許可 | データベース管理者 | 任意 |

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

#### 3. Notionワークスペースオーナー

**必要な権限:**
- ワークスペースの管理者権限

**作業内容:**
- Internal Integrationの作成
- Integration Tokenの発行

#### 4. Notionデータベース管理者

**必要な権限:**
- 対象データベースの編集権限

**作業内容:**
- Integrationへのデータベース接続許可
- 必要なプロパティの追加

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
| 外部サービスへの接続 | GitHub/Notion APIへのリクエスト | `UrlFetchApp` |
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
3. `createDailyTrigger()` を再実行
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

GASエディタで以下を実行：

```javascript
setup(
  'ghp_xxxxxxxxxxxx',  // GitHub PAT
  'spreadsheet-id'      // スプレッドシートID
);

// リポジトリを追加
addRepo('owner', 'repo-name');
```

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

#### GASエディタでの設定

```javascript
setupWithGitHubApp(
  '123456',                               // App ID
  '-----BEGIN RSA PRIVATE KEY-----\n...', // Private Key（改行は\nで）
  '12345678',                             // Installation ID
  'spreadsheet-id'                        // スプレッドシートID
);

// リポジトリを追加
addRepo('your-org', 'repo-name');

// 認証モードを確認
showAuthMode();  // => "🔐 Current auth mode: GitHub App"
```

#### 認証方式の切り替え

現在の認証方式を確認するには：

```javascript
showAuthMode();
```

PAT認証に戻す場合：

```javascript
setup('ghp_xxxx', 'spreadsheet-id');
```

> **注意**: `setup()` を実行するとPAT認証に切り替わります。GitHub Apps設定は残りますが、PATが優先されます。

---

## Notion設定

### 1. Internal Integrationの作成

**対象者:** Notionワークスペースオーナー

1. **Settings** → **Connections** → **Develop or manage integrations**
2. または https://www.notion.so/my-integrations にアクセス
3. 「+ New integration」をクリック
4. 以下を設定：
   - **Name**: DevSyncGAS（任意の名前）
   - **Associated workspace**: 対象ワークスペースを選択
   - **Type**: Internal integration

### 2. 必要なCapabilities

| Capability | 必要性 | 用途 |
|------------|--------|------|
| Read content | 必須 | タスクデータの取得 |
| Read user information | 任意 | 担当者名の取得 |

### 3. データベースへの接続許可

**対象者:** Notionデータベース管理者

1. 対象のデータベースを開く
2. 右上の **•••** → **Add connections**
3. 作成したIntegrationを検索して追加

```
⚠️ 注意:
- Integrationは明示的に接続されたページ/データベースのみアクセス可能
- 子ページへのアクセスは親ページへの接続で継承されます
- Enterprise Planでは管理者がIntegration接続を制限できます
```

### 4. 必要なデータベースプロパティ

以下のプロパティが必要です（名前は代替名も対応）：

| プロパティ | 型 | 対応する名前 | 用途 |
|-----------|------|-------------|------|
| タイトル | Title | （任意） | タスク名 |
| ステータス | Status/Select | Status, ステータス | タスク状態 |
| 着手日 | Date | Date Started, Started, 着手日, 開始日 | サイクルタイム開始 |
| 完了日 | Date | Date Done, Completed, 完了日, Done | サイクルタイム終了 |
| 担当者 | People | Assignee, 担当者 | 担当者名 |
| PR URL | URL | PR URL, PR, Pull Request, GitHub PR | コーディング時間計測 |
| 満足度 | Select/Number | 満足度, Satisfaction, 満足度スコア, Score | 開発者満足度 |

#### 満足度プロパティの設定例

**Select型（推奨）:**
```
選択肢: ★1, ★2, ★3, ★4, ★5
```

**Number型:**
```
数値範囲: 1〜5
```

### 5. トークンの設定

GASエディタで以下を実行：

```javascript
setup(
  'ghp_xxxxxxxxxxxx',    // GitHub PAT
  'spreadsheet-id',       // スプレッドシートID
  'secret_xxxxxxxxxxxx', // Notion Token
  'database-id'           // NotionデータベースID
);
```

---

## トラブルシューティング

### 「メニューが見つからない」は権限不足のサイン

設定画面やメニューが見つからない場合、**機能がないのではなく、権限がない**可能性が高いです。
時間を無駄にしないために、まず以下を確認してください。

#### GitHub: メニューが見つからない場合

| 見つからないもの | 必要な権限 | 確認方法 |
|-----------------|-----------|---------|
| Settings → Developer settings | GitHubアカウント | 個人アカウントでログインしているか確認 |
| Fine-grained tokens | GitHubアカウント | 組織アカウントではなく個人でアクセス |
| Repository access で特定リポジトリが出ない | リポジトリへのアクセス権 | リポジトリのCollaboratorに追加されているか確認 |
| 組織のリポジトリ全体が出ない | 組織のメンバーシップ | 組織管理者にメンバー追加を依頼 |

**確認コマンド:**
```bash
# 自分がアクセスできるリポジトリ一覧
gh repo list

# 特定リポジトリへのアクセス確認
gh repo view owner/repo
```

#### Notion: メニューが見つからない場合

| 見つからないもの | 必要な権限 | 確認方法 |
|-----------------|-----------|---------|
| Settings → Connections | ワークスペースへのアクセス | 正しいワークスペースにいるか確認 |
| Develop or manage integrations | ワークスペースオーナー権限 | オーナーに作成を依頼 |
| データベースの「Add connections」 | データベースの編集権限 | 「Can edit」以上の権限があるか確認 |
| 接続一覧に自分のIntegrationがない | Integrationが未作成 | ワークスペースオーナーに作成を依頼 |

**権限確認方法:**
1. データベース右上の「Share」をクリック
2. 自分のアカウントの権限レベルを確認
3. 「Can edit」未満なら管理者に依頼

#### Google Workspace: メニューが見つからない場合

| 見つからないもの | 必要な権限 | 確認方法 |
|-----------------|-----------|---------|
| script.google.com/home/usersettings | Googleアカウント | ログイン状態を確認 |
| 「Apps Script API」トグル | 組織ポリシーで許可 | 管理者に確認 |
| clasp loginが403エラー | 組織のAPI制限 | IT管理者にApps Script API許可を依頼 |

**組織で制限されている場合の依頼テンプレート:**

```
件名: Google Apps Script API の利用許可申請

IT管理者様

DevOps指標の自動収集ツール導入のため、
Google Apps Script APIの利用許可をお願いいたします。

必要な設定:
1. Google管理コンソール → アプリ → Google Workspace → ドライブとドキュメント
2. 機能とアプリケーション → Apps Script → 有効化

用途: GitHub/Notionからの指標収集とスプレッドシートへの書き出し
```

---

### Google Apps Script関連

#### エラー: 「認証が必要です」が繰り返し表示される

**症状:**
- 関数を実行するたびに認証ダイアログが表示される
- 「許可」を押しても再度表示される

**原因:**
- 一部の権限のみ許可している
- ブラウザのポップアップブロックが干渉している

**解決方法:**
1. https://myaccount.google.com/permissions にアクセス
2. 対象のGASプロジェクトを見つけて「アクセス権を削除」
3. ブラウザのポップアップブロックを一時的に無効化
4. GASエディタで関数を再実行し、すべての権限を許可

---

#### エラー: 「アクセスがブロックされました」

**症状:**
```
このアプリはブロックされています
```

**原因:**
- 組織のGoogle Workspaceポリシーで外部アプリが制限されている

**解決方法:**
1. IT管理者に連絡し、GASプロジェクトの許可を依頼
2. または、管理コンソールで以下を確認：
   - **セキュリティ** → **アクセスとデータ管理** → **APIコントロール**
   - 「内部アプリのみ」設定が有効になっていないか確認

---

#### エラー: 「Apps Script API が無効です」

**症状:**
```
Error: User has not enabled the Apps Script API
```

**原因:**
- Apps Script APIが有効化されていない

**解決方法:**
1. https://script.google.com/home/usersettings にアクセス
2. 「Google Apps Script API」をオンに切り替え
3. `clasp login` を再実行

---

#### エラー: 「clasp push が失敗する」

**症状:**
```
Push failed. Errors:
Could not find valid Apps Script project
```

**原因:**
- `.clasp.json` が存在しない
- スクリプトIDが無効

**解決方法:**
```bash
# .clasp.json を確認
cat .clasp.json

# 存在しない場合は作成
bunx clasp create --title "DevSyncGAS" --type standalone --rootDir ./dist
```

---

#### エラー: 「スプレッドシートにアクセスできません」

**症状:**
```
Exception: You do not have permission to access the requested document
```

**原因:**
- スプレッドシートIDが間違っている
- GASを実行しているアカウントにスプレッドシートへのアクセス権がない

**解決方法:**
1. スプレッドシートIDを確認
2. スプレッドシートの共有設定で実行アカウントに編集権限を付与

---

### GitHub関連

#### エラー: 「GitHub API error: 401」

**症状:**
```
GitHub API error: 401 - Bad credentials
```

**原因:**
- トークンが無効または期限切れ
- トークンの形式が間違っている

**解決方法:**
1. トークンの有効期限を確認
2. 新しいトークンを発行して再設定
```javascript
setup('ghp_新しいトークン', 'spreadsheet-id');
```

---

#### エラー: 「GitHub API error: 403」

**症状:**
```
GitHub API error: 403 - Resource not accessible by personal access token
```

**原因:**
- 必要なパーミッションが付与されていない
- 組織のポリシーでアクセスが制限されている

**解決方法:**
1. トークンのパーミッションを確認（Metadata, Pull requests, Actions, Deployments）
2. 組織管理者に Fine-grained PAT の許可を依頼

---

#### エラー: 「GitHub API error: 404」

**症状:**
```
GitHub API error: 404 - Not Found
```

**原因:**
- リポジトリが存在しない
- リポジトリへのアクセス権がない
- リポジトリ名のtypo

**解決方法:**
```javascript
// 登録済みリポジトリを確認
listRepos();

// 正しいリポジトリ名で再登録
removeRepo('wrong/repo');
addRepo('correct-owner', 'correct-repo');
```

---

### GitHub Apps認証関連

#### エラー: 「GitHub App Private Key is empty」

**症状:**
```
GitHub App Private Key is empty
```

**原因:**
- Private Keyが設定されていない
- `setupWithGitHubApp()` の引数が空文字

**解決方法:**
1. Private Keyを再確認
2. 正しい引数で `setupWithGitHubApp()` を再実行

---

#### エラー: 「Invalid Private Key format」

**症状:**
```
Invalid Private Key format. Expected PEM format with BEGIN/END markers.
```

**原因:**
- Private Keyの形式が正しくない
- 改行が `\n` に置換されていない
- PEMヘッダー/フッターが欠けている

**解決方法:**
1. `.pem` ファイルの内容を確認
2. 改行を `\n` に置換
   ```bash
   cat your-private-key.pem | tr '\n' '\\n' | sed 's/\\n$//'
   ```
3. `-----BEGIN RSA PRIVATE KEY-----` と `-----END RSA PRIVATE KEY-----` が含まれているか確認

---

#### エラー: 「Failed to get installation token: 401」

**症状:**
```
Failed to get installation token: 401 - Unauthorized
Hint: Check if the App ID and Private Key are correct.
```

**原因:**
- App IDが間違っている
- Private Keyが間違っている（別のAppのKeyを使用している等）
- Private Keyが期限切れ（revoke済み）

**解決方法:**
1. App設定ページでApp IDを確認
2. Private Keyを再生成して設定し直す

---

#### エラー: 「Failed to get installation token: 404」

**症状:**
```
Failed to get installation token: 404 - Not Found
Hint: Check if the Installation ID is correct and the App is installed on the repository.
```

**原因:**
- Installation IDが間違っている
- Appがリポジトリにインストールされていない
- Appがアンインストールされた

**解決方法:**
1. GitHub → Settings → Applications → Installed GitHub Apps で確認
2. Installation IDを確認（URLの数字部分）
3. 必要に応じてAppを再インストール

---

#### エラー: 「Failed to get installation token: 403」

**症状:**
```
Failed to get installation token: 403 - Forbidden
Hint: Check if the App has the required permissions (Pull requests, Actions, Metadata).
```

**原因:**
- Appに必要な権限が設定されていない
- 権限変更後にAppの再インストールが必要

**解決方法:**
1. App設定ページで権限を確認（Metadata, Pull requests, Actions, Deployments）
2. 権限を変更した場合はAppを再インストール

---

#### 問題: 「認証モードがPATのままになっている」

**症状:**
- `showAuthMode()` が "Personal Access Token (PAT)" を表示する
- GitHub Apps設定したはずなのに反映されない

**原因:**
- 以前設定したPATが残っている
- GitHub Apps設定が不完全（3つの値がすべて必要）

**解決方法:**
```javascript
// 認証モードを確認
showAuthMode();

// GitHub Apps設定を再実行
setupWithGitHubApp(
  'app-id',
  '-----BEGIN RSA PRIVATE KEY-----\n...',
  'installation-id',
  'spreadsheet-id'
);

// 再度確認
showAuthMode();  // => "🔐 Current auth mode: GitHub App"
```

> **注意**: GitHub Apps認証が優先されるため、PAT設定が残っていても問題ありません。

---

#### 問題: 「デプロイメントが取得できない」

**症状:**
- `syncDevOpsMetrics()` でデプロイメント数が0

**原因:**
- 環境名が一致しない（デフォルトは "production"）
- GitHub Actionsでのデプロイメントが設定されていない

**解決方法:**
1. GitHubリポジトリでデプロイメント環境を確認
2. 環境名が異なる場合はコード側で調整が必要

---

### Notion関連

#### エラー: 「Notion API error: 401」

**症状:**
```
Notion API error: 401 - Unauthorized
```

**原因:**
- Integration Tokenが無効
- トークンの形式が間違っている（`secret_` で始まる必要がある）

**解決方法:**
1. Notion Integrationページでトークンを再取得
2. 正しい形式で設定（`secret_`で始まる必要があります）
```javascript
setup('ghp_xxxx', 'spreadsheet-id', 'secret_正しいトークン', 'database-id');
```

---

#### エラー: 「Notion API error: 403」

**症状:**
```
Notion API error: 403 - Forbidden
```

**原因:**
- Integrationがデータベースに接続されていない

**解決方法:**
1. Notionでデータベースを開く
2. 右上の **•••** → **Add connections**
3. Integrationを検索して追加

---

#### エラー: 「Notion API error: 404」

**症状:**
```
Notion API error: 404 - Not found
```

**原因:**
- データベースIDが間違っている
- データベースが削除された

**解決方法:**
1. NotionでデータベースURLを確認
```
https://www.notion.so/【ワークスペース名】/【このIDをコピー】?v=...
```
2. 正しいIDで再設定

---

#### 問題: 「サイクルタイムが計測されない」

**症状:**
- `syncCycleTime()` でタスク数が0

**原因:**
- 着手日または完了日が未設定
- プロパティ名が認識されていない

**解決方法:**
1. Notionデータベースのプロパティ名を確認
2. 以下のいずれかの名前を使用：
   - 着手日: `Date Started`, `Started`, `着手日`, `開始日`
   - 完了日: `Date Done`, `Completed`, `完了日`, `Done`

---

#### 問題: 「満足度が取得できない」

**症状:**
- `syncDeveloperSatisfaction()` でタスク数が0

**原因:**
- 満足度プロパティが未設定
- Select型の選択肢に数字が含まれていない

**解決方法:**
1. プロパティ名を確認（`満足度`, `Satisfaction`, `満足度スコア`, `Score`）
2. Select型の場合、選択肢に数字を含める（例: `★1`, `★2`, ...）
3. Number型の場合、1〜5の範囲で入力

---

### 接続テスト

#### 基本的な権限テスト

GASエディタで以下を実行します：

```javascript
testPermissions();
```

この関数は以下をテストします：
- GitHub APIへの接続
- スプレッドシートへのアクセス

#### 個別サービスのテスト

各指標の取得関数を少ない日数で実行して、接続を確認できます：

```javascript
// GitHub接続テスト（DORA指標）
syncHistoricalMetrics(7);  // 過去7日分で軽くテスト

// サイクルタイム接続テスト（GitHub Issue/PR）
syncCycleTime(7);  // 過去7日分で軽くテスト

// リポジトリ一覧確認
listRepos();
```

エラーが発生した場合は、ログメッセージを確認してください。

---

## よくある質問

### Q: 複数のリポジトリを監視できますか？

**A:** はい、`addRepo()` で複数のリポジトリを追加できます。

```javascript
addRepo('owner', 'repo1');
addRepo('owner', 'repo2');
addRepo('other-owner', 'repo3');
```

---

### Q: トークンの有効期限が切れたらどうなりますか？

**A:** 認証方式によって異なります。

**PAT認証の場合:**
API呼び出しが401エラーで失敗します。新しいトークンを発行して再設定してください。

```javascript
// GitHub PATのみ更新する場合
setup('ghp_新しいトークン', 'spreadsheet-id');

// Notion連携も使用している場合
setup('ghp_新しいトークン', 'spreadsheet-id', 'secret_xxxx', 'database-id');
```

**GitHub Apps認証の場合:**
Installation Access Tokenは1時間で失効しますが、**自動的に新しいトークンが取得される**ため、通常は対応不要です。

Private Keyには有効期限がないため、明示的に無効化（revoke）しない限り使い続けられます。
セキュリティのため、定期的なKeyローテーションを推奨します。

---

### Q: PATとGitHub Apps、どちらを選ぶべきですか？

**A:** 以下を目安にしてください。

| ケース | 推奨 |
|--------|------|
| 個人で試しに使ってみたい | PAT |
| 小規模チーム（2〜3人） | PAT（シンプル） or GitHub Apps（退職対策） |
| 組織での本格運用 | **GitHub Apps** |
| セキュリティ監査がある | **GitHub Apps** |
| 多数のリポジトリを監視 | **GitHub Apps**（レート制限3倍） |

組織での運用では、**PAT発行者の退職時にトークンが無効になるリスク**を考慮して、GitHub Appsを推奨します。

---

### Q: 過去のデータを取得できますか？

**A:** はい、各関数に日数を指定できます。

```javascript
syncHistoricalMetrics(90);  // 過去90日のDORA指標
syncCycleTime(60);           // 過去60日のサイクルタイム
syncReworkRate(90);          // 過去90日の手戻り率
```

---

### Q: 日次で自動実行したいのですが？

**A:** `createDailyTrigger()` を一度実行すると、毎日9時に自動実行されます。

```javascript
createDailyTrigger();
```

---

### Q: プライベートリポジトリでも使えますか？

**A:** はい、トークンに対象リポジトリへのアクセス権があれば使用できます。Fine-grained PATの場合、Repository accessで対象リポジトリを選択してください。

---

## 関連ドキュメント

- [README](../README.md) - プロジェクト概要
- [GitHub Apps 認証ガイド](GITHUB_APPS_AUTH.md) - GitHub Apps認証の設定方法
- [DORA Metrics](DORA_METRICS.md) - DORA指標の詳細
- [サイクルタイム](CYCLE_TIME.md) - サイクルタイム計測
- [コーディング時間](CODING_TIME.md) - コーディング時間計測
- [手戻り率](REWORK_RATE.md) - 手戻り率計測
- [レビュー効率](REVIEW_EFFICIENCY.md) - レビュー効率計測
- [PRサイズ](PR_SIZE.md) - PRサイズ計測
- [開発者満足度](DEVELOPER_SATISFACTION.md) - 開発者満足度計測

---

## 外部リンク

### 公式ドキュメント

- [GitHub REST API - Fine-grained PAT permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- [GitHub - Managing PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Notion - Build your first integration](https://developers.notion.com/docs/create-a-notion-integration)
- [Notion - Add and manage connections](https://www.notion.com/help/add-and-manage-connections-with-the-api)
- [Google Apps Script - clasp](https://developers.google.com/apps-script/guides/clasp)

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-01 | 初版作成 |
