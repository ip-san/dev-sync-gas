# GitHub Apps 認証ガイド

GitHub Apps認証を使用すると、Personal Access Token（PAT）に比べて以下のメリットがあります。

## PAT vs GitHub Apps

| 項目 | PAT | GitHub Apps |
|------|-----|-------------|
| 認証主体 | 個人アカウント | アプリケーション |
| 有効期限 | 設定次第（最大無期限） | 1時間で自動失効・自動更新 |
| 権限管理 | ユーザー単位 | リポジトリ/Organization単位で細かく設定 |
| レート制限 | 5,000 req/hour | 15,000 req/hour |
| 退職時の影響 | トークン無効化が必要 | 影響なし |
| 監査ログ | 個人のアクセスとして記録 | App単位で詳細に記録 |

**推奨ケース:**
- 個人/小規模チーム → PAT（シンプル）
- Organization運用、複数人で共有 → GitHub Apps
- セキュリティ要件が厳しい環境 → GitHub Apps

## GitHub App の作成手順

### 1. GitHub App を作成

1. GitHubにログイン
2. **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**
3. 以下を設定:

| 項目 | 値 |
|------|-----|
| GitHub App name | `DevSyncGAS-YourOrg` (一意の名前) |
| Homepage URL | `https://github.com/your-org` (任意) |
| Webhook | **Active をオフ** (不要) |

### 2. 権限を設定

**Repository permissions** で以下を設定:

| 権限 | アクセスレベル | 用途 |
|------|--------------|------|
| **Actions** | Read-only | ワークフロー実行履歴の取得 |
| **Deployments** | Read-only | デプロイメント情報の取得 |
| **Issues** | Read-only | インシデント（MTTR）計測 |
| **Metadata** | Read-only | 基本情報（必須） |
| **Pull requests** | Read-only | PR情報の取得 |

> **注意**: Write権限は不要です。Read-onlyのみで動作します。

### 3. インストール先を設定

**Where can this GitHub App be installed?** で以下を選択:

- **Only on this account** - 自分のアカウント/Orgのみ（推奨）
- **Any account** - 他のアカウントにもインストール可能

### 4. App を作成

**Create GitHub App** をクリックして作成完了。

### 5. Private Key を生成

1. 作成したAppの設定ページを開く
2. **Private keys** セクションで **Generate a private key** をクリック
3. `.pem` ファイルがダウンロードされる

> **重要**: このファイルは安全に保管してください。紛失した場合は再生成が必要です。

### 6. App をリポジトリにインストール

1. 作成したAppの設定ページで **Install App** をクリック
2. インストール先のアカウント/Orgを選択
3. **Only select repositories** で対象リポジトリを選択
4. **Install** をクリック

### 7. Installation ID を取得

インストール後のURLから Installation ID を確認:
```
https://github.com/settings/installations/12345678
                                          ^^^^^^^^
                                          この数字が Installation ID
```

または、App設定ページ → **Install App** → インストール済みアカウントの **Configure** から確認できます。

## DevSyncGAS への設定

### 必要な情報

| 項目 | 取得場所 |
|------|---------|
| App ID | App設定ページの「App ID」 |
| Private Key | ダウンロードした `.pem` ファイルの内容 |
| Installation ID | インストールURLの数字部分 |

### セットアップ手順

**最も簡単な方法です。** Private Keyを複数行のまま貼り付けられます。

#### 1. テンプレートをコピー（初回のみ）

```bash
cp src/init.example.ts src/init.ts
```

#### 2. `src/init.ts` を編集

```typescript
export const config: InitConfig = {
  auth: {
    type: 'github-app',
    appId: '123456',  // あなたのApp ID
    installationId: '12345678',  // あなたのInstallation ID
    // Private Keyは複数行のまま貼り付けてOK
    privateKey: `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...
-----END RSA PRIVATE KEY-----`,
  },
  spreadsheet: {
    id: 'your-spreadsheet-id',
  },
  repositories: [
    { owner: 'your-org', name: 'your-repo' },
    // 複数リポジトリを追加可能
  ],
};
```

#### 3. ビルド＆デプロイ

```bash
bun run push
```

#### 4. GASエディタで実行

GASエディタ（https://script.google.com）で：
- 関数選択ドロップダウンから **`initConfig`** を選択
- 「実行」ボタンをクリック
- 初回は権限承認ダイアログが表示されるので「許可」をクリック

#### 5. 機密情報を削除（推奨）

設定完了後、`src/init.ts` から機密情報を削除してもOKです：

```typescript
export const config: InitConfig = {
  auth: {
    type: 'github-app',
    appId: '',  // 空にしてOK
    installationId: '',
    privateKey: '',
  },
  // ...
};
```

設定はPropertiesServiceに保存されているため、コードから削除しても動作します。

## PAT認証への切り替え

GitHub Apps認証からPAT認証に戻す場合、`src/init.ts` を編集して再デプロイします:

```typescript
export const config: InitConfig = {
  auth: {
    type: 'token',  // 'github-app' から 'token' に変更
    token: 'ghp_xxxx',  // GitHub PAT
  },
  spreadsheet: {
    id: 'your-spreadsheet-id',
  },
  repositories: [
    { owner: 'your-org', name: 'your-repo' },
  ],
};
```

```bash
bun run push  # 再デプロイ
```

GASエディタで `initConfig()` を実行し、認証モードを確認:

```javascript
showAuthMode();  // => "🔐 Current auth mode: Personal Access Token (PAT)"
```

## トラブルシューティング

### "GitHub App authentication failed" エラー

**原因と対処:**

1. **Private Keyの形式が正しくない**
   - 改行が `\n` に正しく置換されているか確認
   - `-----BEGIN RSA PRIVATE KEY-----` と `-----END RSA PRIVATE KEY-----` が含まれているか確認

2. **Installation IDが間違っている**
   - App設定ページ → Install App → Configure で正しいIDを確認

3. **Appがリポジトリにインストールされていない**
   - 対象リポジトリにAppがインストールされているか確認

4. **権限が不足している**
   - App設定ページで必要な権限が設定されているか確認
   - 権限変更後は再インストールが必要な場合あり

### トークンの有効期限

Installation Access Tokenは1時間で失効しますが、DevSyncGASは自動的に新しいトークンを取得します。
キャッシュが残り5分未満になると自動更新されるため、通常は意識する必要はありません。

### レート制限

GitHub Appsは15,000 req/hourのレート制限があります。
多数のリポジトリを監視している場合でも、通常は問題になりません。

現在のレート制限状況はGitHub APIのレスポンスヘッダーで確認できます:
- `X-RateLimit-Limit`: 上限
- `X-RateLimit-Remaining`: 残り回数
- `X-RateLimit-Reset`: リセット時刻（Unix timestamp）

## 組織導入のコツ

### 担当者の明確化

GitHub Appsの運用には以下の役割が必要です。導入前に担当者を決めておきましょう。

| 役割 | 担当作業 | 必要な権限 |
|------|----------|-----------|
| **App管理者** | Appの作成・権限設定・Key管理 | 組織の管理者権限 |
| **運用担当者** | GASの設定・日常運用 | GASプロジェクトへのアクセス |
| **リポジトリ管理者** | Appのインストール承認 | リポジトリの管理者権限 |

> **ポイント**: App管理者と運用担当者は別の人でもOKです。Private Keyを安全に共有する手段を確保してください。

### Private Keyの安全な共有

Private Keyは非常に機密性が高いため、以下の方法で安全に共有してください。

**推奨する方法:**
- 1Password、LastPassなどのパスワードマネージャーのセキュアノート
- 組織の秘密管理システム（HashiCorp Vault等）
- 暗号化されたファイル共有（パスワード付きZIP等）

**避けるべき方法:**
- Slack/Teams等のチャットでの直接送信
- メールでの送信
- Gitリポジトリへのコミット

### 複数環境での運用

開発環境と本番環境で別のAppを使用することを推奨します。

```
DevSyncGAS-YourOrg-Dev   → 開発用リポジトリ
DevSyncGAS-YourOrg-Prod  → 本番用リポジトリ
```

**メリット:**
- 権限の分離（開発者は本番リポジトリにアクセスできない）
- 監査ログの明確化
- 障害時の影響範囲の限定

### 引き継ぎのしやすさ

GitHub Apps認証の最大のメリットは、**担当者が変わっても運用が止まらない**ことです。

**引き継ぎ時のチェックリスト:**
1. [ ] 新担当者をAppの管理者に追加
2. [ ] GASプロジェクトの共有設定を更新
3. [ ] Private Keyの保管場所を共有
4. [ ] 運用ドキュメントを更新

PAT認証の場合は、旧担当者のトークンを無効化して新担当者が再発行する必要がありますが、GitHub Appsではこの作業が不要です。

### 監査対応

GitHub Appsは詳細な監査ログを提供します。

**確認できる情報:**
- いつ、どのリポジトリにアクセスしたか
- どのAPIを呼び出したか
- レート制限の使用状況

**監査ログの確認方法:**
1. Organization → Settings → Audit log
2. `action:integration` でフィルタ
3. App名で絞り込み

---

## セキュリティのベストプラクティス

1. **Private Keyの管理**
   - `.pem` ファイルは安全な場所に保管
   - Script Propertiesに保存されるため、GASプロジェクトへのアクセス権限を適切に管理

2. **権限の最小化**
   - 必要なリポジトリのみにAppをインストール
   - Read-only権限のみを使用（Write権限は不要）

3. **定期的な監査**
   - App設定ページでインストール先を定期的に確認
   - 不要になったリポジトリからはアンインストール

4. **Private Keyのローテーション**
   - 定期的に新しいPrivate Keyを生成
   - 古いKeyは削除

---

## 関連ドキュメント

- [組織導入ガイド＆トラブルシューティング](SETUP_AND_TROUBLESHOOTING.md) - 認証方式の選択、詳細なトラブル対応
- [README](../README.md) - プロジェクト概要
