# トラブルシューティング

DevSyncGASで発生する可能性のある問題と解決方法をまとめたガイドです。

---

## 目次

1. [設定診断ツール（checkConfig）](#設定診断ツールcheckconfig)
2. [「メニューが見つからない」は権限不足のサイン](#メニューが見つからないは権限不足のサイン)
3. [設定関連のよくあるエラー](#設定関連のよくあるエラー)
4. [Google Apps Script関連](#google-apps-script関連)
5. [GitHub関連](#github関連)
6. [GitHub Apps認証関連](#github-apps認証関連)
7. [接続テスト](#接続テスト)

---

## 設定診断ツール（checkConfig）

**設定ミスで困ったら、まずこれを実行！**

GASエディタで `checkConfig()` を実行すると、現在の設定状況を診断して問題点と解決方法を表示します。

```javascript
checkConfig();
```

**出力例（設定に問題がある場合）:**
```
=== DevSyncGAS 設定診断 ===

✅ Spreadsheet ID: 設定済み: 1234567890...
❌ GitHub認証: GitHub Apps設定が不完全です（Private Key が未設定）
   → src/init.ts で全ての値を設定して initConfig() を実行してください
⚠️ リポジトリ: リポジトリが登録されていません
   → src/init.ts の repositories 配列にリポジトリを追加するか、addRepo('owner', 'repo-name') を実行してください

❌ エラーがあります。上記のヒントを参考に設定を修正してください。
```

**出力例（設定が正常な場合）:**
```
=== DevSyncGAS 設定診断 ===

✅ Spreadsheet ID: 設定済み: 1234567890...
✅ GitHub認証: GitHub Apps認証
✅ リポジトリ: 3件登録済み: owner/repo1, owner/repo2, owner/repo3

✅ すべての設定が正常です。
```

この診断ツールは以下をチェックします：
- スプレッドシートIDが設定されているか
- GitHub認証（PAT/GitHub Apps）が正しく設定されているか
- GitHub Apps設定が不完全でないか（部分的に設定されていないか）
- PATのトークン形式が正しいか
- リポジトリが登録されているか

---

## 「メニューが見つからない」は権限不足のサイン

設定画面やメニューが見つからない場合、**機能がないのではなく、権限がない**可能性が高いです。
時間を無駄にしないために、まず以下を確認してください。

### GitHub: メニューが見つからない場合

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

### Google Workspace: メニューが見つからない場合

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

用途: GitHubからの指標収集とスプレッドシートへの書き出し
```

---

## 設定関連のよくあるエラー

### エラー: 「SPREADSHEET_ID is not set」

**症状:**
```
Error: SPREADSHEET_ID is not set
→ src/init.ts で設定して initConfig() を実行してください
→ 設定状況を確認するには checkConfig() を実行してください
```

**原因:**
- 初期設定が完了していない
- `initConfig()` が実行されていない

**解決方法:**

`src/init.ts` を編集して認証情報を設定し、再デプロイ後に `initConfig()` を実行：

```typescript
// PAT認証の場合
auth: { type: 'token', token: 'ghp_xxxx' }

// GitHub Apps認証の場合
auth: {
  type: 'github-app',
  appId: 'app-id',
  privateKey: '-----BEGIN RSA PRIVATE KEY-----...',
  installationId: 'installation-id',
}
```

---

### エラー: 「GitHub認証が設定されていません」

**症状:**
```
Error: GitHub認証が設定されていません
→ src/init.ts で認証情報を設定して initConfig() を実行してください
```

**原因:**
- GitHub PATもGitHub Apps認証も設定されていない

**解決方法:**
```javascript
// 設定状況を確認
checkConfig();
```

`src/init.ts` で認証情報を設定して、再デプロイ後に `initConfig()` を実行してください。

---

### エラー: 「GitHub Apps設定が不完全です」

**症状:**
```
Error: GitHub Apps設定が不完全です（Private Key が未設定）
→ src/init.ts で全ての値を設定して initConfig() を実行してください
```

**原因:**
- GitHub Apps認証に必要な3つの値（App ID、Private Key、Installation ID）のうち一部のみが設定されている

**解決方法:**
1. `checkConfig()` で何が未設定か確認
2. `src/init.ts` で全ての値を設定し直す

```javascript
// 設定状況を確認
checkConfig();
```

```typescript
// src/init.ts で全ての値を設定
auth: {
  type: 'github-app',
  appId: '123456',
  privateKey: `-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----`,
  installationId: '12345678',
}
```

再デプロイして `initConfig()` を実行

---

### 警告: 「リポジトリが登録されていません」

**症状:**
```
⚠️ No repositories configured. Add repositories with addRepo()
```

**原因:**
- 監視対象のリポジトリが追加されていない

**解決方法:**
```javascript
// リポジトリを追加
addRepo('owner', 'repo-name');

// 複数追加する場合
addRepo('owner', 'repo1');
addRepo('owner', 'repo2');

// 登録状況を確認
listRepos();
```

---

## Google Apps Script関連

### エラー: 「認証が必要です」が繰り返し表示される

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

### エラー: 「アクセスがブロックされました」

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

### エラー: 「Apps Script API が無効です」

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

### エラー: 「clasp push が失敗する」

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

### エラー: 「スプレッドシートにアクセスできません」

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

## GitHub関連

### エラー: 「GitHub API error: 401」

**症状:**
```
GitHub API error: 401 - Bad credentials
```

**原因:**
- トークンが無効または期限切れ
- トークンの形式が間違っている

**解決方法:**
1. トークンの有効期限を確認
2. 新しいトークンを発行して `src/init.ts` を更新
```typescript
// src/init.ts
auth: { type: 'token', token: 'ghp_新しいトークン' }
```
3. 再デプロイして `initConfig()` を実行

---

### エラー: 「GitHub API error: 403」

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

### エラー: 「GitHub API error: 404」

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

## GitHub Apps認証関連

### エラー: 「GitHub App Private Key is empty」

**症状:**
```
GitHub App Private Key is empty
```

**原因:**
- Private Keyが設定されていない
- `src/init.ts` の `privateKey` が空文字

**解決方法:**
1. Private Keyを再確認
2. `src/init.ts` で正しい値を設定
3. 再デプロイして `initConfig()` を実行

---

### エラー: 「Invalid Private Key format」

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

### エラー: 「Failed to get installation token: 401」

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

### エラー: 「Failed to get installation token: 404」

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

### エラー: 「Failed to get installation token: 403」

**症状:**
```
Failed to get installation token: 403 - Forbidden
Hint: Check if the App has the required permissions (Pull requests, Actions, Metadata).
```

**原因:**
- Appに必要な権限が設定されていない
- 権限変更後にAppの再インストールが必要

**解決方法:**
1. App設定ページで権限を確認（Metadata, Pull requests, Actions, Deployments, Contents）
2. 権限を変更した場合はAppを再インストール

---

### エラー: 「Resource not accessible by integration」（大量発生）

**症状:**
```
⚠️ GraphQL partial error: Resource not accessible by integration
```
同じエラーが1回のリクエストで数十〜数百回繰り返される

**原因:**
- GitHub Appの **Contents権限** が設定されていない
- PRのコミット情報、レビュー情報、タイムラインにアクセスできない

**解決方法:**
1. GitHub App設定ページを開く
2. **Repository permissions** で以下を確認:
   - ✅ **Contents: Read-only**（**これが不足している可能性大**）
   - ✅ **Pull requests: Read-only**
   - ✅ **Actions: Read-only**
   - ✅ **Deployments: Read-only**
   - ✅ **Issues: Read-only**
3. Contents権限を追加後、**Save changes**
4. インストールした組織/リポジトリで権限を承認（Update）
5. GASスクリプトを再実行

**確認方法:**
権限追加後、エラーが消えて正常にPR詳細が取得できるようになります。

> **重要**: Contents権限がないと、PRのコミット一覧やタイムラインイベントにアクセスできず、
> DORA metricsの計算に必要なデータが不足します。

詳細は [GITHUB_APPS_AUTH.md](GITHUB_APPS_AUTH.md#2-権限を設定) を参照。

---

### 問題: 「認証モードがPATのままになっている」

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
```

```typescript
// src/init.ts でGitHub Apps設定を更新
auth: {
  type: 'github-app',
  appId: 'app-id',
  privateKey: `-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----`,
  installationId: 'installation-id',
}
```

再デプロイして `initConfig()` を実行後、再度確認:
```javascript
showAuthMode();  // => "🔐 Current auth mode: GitHub App"
```

> **注意**: GitHub Apps認証が優先されるため、PAT設定が残っていても問題ありません。

---

### 問題: 「デプロイメントが取得できない」

**症状:**
- `syncDevOpsMetrics()` でデプロイメント数が0

**原因:**
- 環境名が一致しない（デフォルトは "production"）
- GitHub Actionsでのデプロイメントが設定されていない

**解決方法:**
1. GitHubリポジトリでデプロイメント環境を確認
2. 環境名が異なる場合はコード側で調整が必要

---

## 接続テスト

### 基本的な権限テスト

GASエディタで以下を実行します：

```javascript
testPermissions();
```

この関数は以下をテストします：
- GitHub APIへの接続
- スプレッドシートへのアクセス

### 個別サービスのテスト

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

## 関連ドキュメント

- [セットアップガイド](SETUP.md) - 初期設定方法
- [よくある質問](FAQ.md) - FAQ
- [README](../README.md) - プロジェクト概要
