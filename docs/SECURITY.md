# セキュリティガイド

DevSyncGASのセキュリティ機能と、ITGC（IT全般統制）要件への対応について説明します。

---

## 目次

1. [セキュリティ概要](#セキュリティ概要)
2. [実装済みセキュリティ対策](#実装済みセキュリティ対策)
3. [監査ログ](#監査ログ)
4. [入力検証](#入力検証)
5. [機密情報の取り扱い](#機密情報の取り扱い)
6. [残存リスクと推奨対策](#残存リスクと推奨対策)
7. [セキュリティベストプラクティス](#セキュリティベストプラクティス)

---

## セキュリティ概要

DevSyncGASは以下のセキュリティ原則に基づいて設計されています。

| 原則 | 実装状況 |
|------|----------|
| **最小権限の原則** | ✅ GitHub APIはRead-onlyのみ |
| **入力検証** | ✅ 全ての外部入力を検証 |
| **監査証跡** | ✅ 全ての設定変更を記録 |
| **機密情報保護** | ⚠️ PropertiesServiceに平文保存（GASの制限） |
| **エラーハンドリング** | ✅ 機密情報をエラーメッセージから除外 |

---

## 実装済みセキュリティ対策

### 1. 入力検証

全ての外部入力に対して厳格な検証を実施します。

**検証される項目:**
- GitHubリポジトリ名/オーナー名
- スプレッドシートID
- プロジェクト名
- GitHub App ID/Installation ID
- Private Key形式

**例:**
```javascript
// ❌ 不正な入力は拒否される
addRepo('../../../etc', 'passwd');  // Error: Invalid repository name

// ✅ 正しい入力のみ受け入れる
addRepo('your-org', 'your-repo');
```

**検証ルール:**
- リポジトリオーナー: 英数字、ハイフン（1-39文字）
- リポジトリ名: 英数字、ハイフン、アンダースコア、ピリオド（1-100文字）
- スプレッドシートID: 英数字、ハイフン、アンダースコア（20-100文字）
- 危険なパターン（`../`, `<script>`等）を自動ブロック

### 2. 監査ログ

全ての設定変更操作を記録し、誰がいつ何をしたかを追跡可能にします。

**記録される操作:**
- 初期セットアップ（PAT/GitHub Apps）
- リポジトリの追加・削除
- プロジェクトの作成・更新・削除
- GitHub App設定のクリア
- トリガーの作成・削除

**監査ログの形式:**
```json
{
  "timestamp": "2026-01-31T12:34:56.789Z",
  "user": "user@example.com",
  "action": "repository.add",
  "status": "success",
  "details": {
    "owner": "your-org",
    "name": "your-repo",
    "fullName": "your-org/your-repo"
  }
}
```

**使い方:**

```javascript
// 直近10件の監査ログを表示
showAuditLogs();

// 直近100件を表示
showAuditLogs(100);

// スプレッドシートに書き出し（長期保存）
exportAuditLogs();

// 別のスプレッドシートに書き出し
exportAuditLogs('spreadsheet-id-here');
```

**監査ログからの機密情報除外:**
- トークン、Private Key、パスワードは自動的に `[REDACTED]` に置換
- 長い文字列は200文字で切り詰め
- ネストされたオブジェクトも再帰的にサニタイズ

### 3. 機密情報の安全な削除

GitHub App設定を削除する際に、操作を監査ログに記録します。

```javascript
// GitHub App設定をクリア
clearGitHubAppConfig();

// 実行結果:
// ⚠️ Clearing GitHub App configuration...
//    This will remove App ID, Private Key, and Installation ID
//    Make sure to revoke the GitHub App access if no longer needed
// ✅ GitHub App configuration cleared
// [AUDIT] {"timestamp":"...","action":"config.github_app.clear",...}
```

### 4. エラーメッセージからの機密情報除外

APIエラー等で機密情報がログに含まれないよう、自動的にマスクします。

**除外されるパターン:**
- GitHub PAT (`ghp_xxxxx`)
- Fine-grained PAT (`github_pat_xxxxx`)
- Installation Token (`ghs_xxxxx`)
- PEM形式のPrivate Key

**例:**
```javascript
// エラーメッセージは安全化される
// 元: "Failed: ghp_1234567890abcdefghijklmnopqrstuvwxyz"
// 表示: "Failed: [REDACTED]... (truncated)"
```

### 5. トークンキャッシュの安全化

GitHub Apps Installation Tokenをグローバル変数ではなく、PropertiesServiceに保存します。

**メリット:**
- 実行セッション間での意図しないキャッシュ共有を防止
- トークンの有効期限を厳密に管理
- デバッグ時のトークン漏洩リスクを低減

### 6. APIタイムアウト設定

外部API呼び出しにタイムアウトを設定し、長時間のハングを防ぎます。

**設定値:**
- デフォルトタイムアウト: 30秒
- SSL証明書検証: 有効
- リダイレクト追跡: 有効

---

## 監査ログ

### ITGCコンプライアンス

監査ログは以下のITGC要件に対応しています。

| 要件 | 対応状況 |
|------|----------|
| **変更管理** | ✅ 全ての設定変更を記録 |
| **アクセス管理** | ✅ ユーザー情報（メールアドレス）を記録 |
| **監査証跡** | ✅ タイムスタンプ、アクション、詳細を記録 |
| **長期保存** | ✅ スプレッドシートへのエクスポート機能 |

### 監査ログの保存期間

- **GAS実行ログ**: 最大で直近の実行ログのみ（推奨: 定期的にエクスポート）
- **スプレッドシート**: 無期限（ユーザー管理）

### 監査レポートの生成

```javascript
// 月次監査レポート作成の例
function generateMonthlyAuditReport() {
  const spreadsheetId = 'your-audit-log-spreadsheet-id';
  exportAuditLogs(spreadsheetId);
}

// トリガーで毎月1日に実行
ScriptApp.newTrigger('generateMonthlyAuditReport')
  .timeBased()
  .onMonthDay(1)
  .atHour(9)
  .create();
```

---

## 入力検証

### 検証関数

全ての検証関数は `src/utils/validation.ts` に定義されています。

| 関数 | 検証対象 | エラー例 |
|------|----------|----------|
| `validateRepositoryOwner()` | GitHub オーナー名 | "Invalid repository owner" |
| `validateRepositoryName()` | GitHub リポジトリ名 | "Repository name contains invalid characters" |
| `validateProjectName()` | プロジェクト名 | "Project name must be between 1 and 100 characters" |
| `validateSpreadsheetId()` | スプレッドシートID | "Spreadsheet ID format is invalid" |
| `validateGitHubToken()` | GitHub PAT | "GitHub token is too short" |
| `validateGitHubAppId()` | GitHub App ID | "GitHub App ID must be numeric" |
| `validatePrivateKey()` | Private Key | "Private Key must be in PEM format" |

### カスタム検証の追加

独自の検証ルールを追加する場合:

```typescript
// src/utils/validation.ts に追加
export function validateCustomField(value: string): void {
  if (!value.match(/^[A-Z]{3}-\d{4}$/)) {
    throw new Error('Custom field must match format: ABC-1234');
  }
}
```

---

## 機密情報の取り扱い

### PropertiesServiceのセキュリティ

**特徴:**
- ✅ GASプロジェクト単位で暗号化保存
- ✅ APIキーやトークンの保存に適している
- ⚠️ GASプロジェクトへのアクセス権を持つ全員が閲覧可能

**アクセス制御:**
1. GASプロジェクトの共有設定を最小限に
2. 閲覧権限のみのユーザーはPropertiesを見られない
3. 編集権限のユーザーは全てのPropertiesを閲覧可能

### Google Secret Managerの検討

より高度なセキュリティが必要な場合は、Google Secret Managerの利用を推奨します。

**メリット:**
- バージョン管理
- アクセス制御の細分化
- 監査ログの自動記録
- ローテーション機能

**実装例:**
```javascript
// Secret Managerからトークンを取得（要実装）
function getSecretFromSecretManager(secretName) {
  const projectId = 'your-gcp-project-id';
  const url = `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${secretName}/versions/latest:access`;

  // OAuth2認証が必要
  // 実装の詳細は Google Secret Manager API ドキュメントを参照
}
```

### Private Keyの定期ローテーション

**推奨頻度:** 90日ごと

**手順:**
1. GitHub Appの設定ページで新しいPrivate Keyを生成
2. `setupWithGitHubApp()` で新しいキーを設定
3. 古いキーをGitHub側で削除
4. 監査ログで変更を確認

---

## 残存リスクと推奨対策

### リスク1: Private Keyの平文保存

**現状:**
- PropertiesServiceに平文で保存
- GASプロジェクトの編集権限を持つ全員が閲覧可能

**推奨対策:**
1. **最小:** GASプロジェクトの共有を最小限に制限
2. **推奨:** Google Secret Managerへの移行
3. **最良:** KMSによる暗号化 + Secret Manager

### リスク2: スプレッドシートアクセス制御

**現状:**
- スプレッドシートIDの妥当性チェックのみ
- アクセス権がない場合のエラーハンドリングが不十分

**推奨対策:**
```javascript
// スプレッドシートアクセス前の権限確認
function validateSpreadsheetAccess(spreadsheetId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    spreadsheet.getName(); // アクセステスト
    return true;
  } catch (e) {
    throw new Error(
      `Cannot access spreadsheet ${spreadsheetId}. ` +
      'Check if the spreadsheet exists and you have edit permission.'
    );
  }
}
```

### リスク3: レート制限超過

**現状:**
- GitHub APIレート制限超過時のリトライ機構なし

**推奨対策:**
```javascript
// Exponential backoffでリトライ
function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = UrlFetchApp.fetch(url, options);

    if (response.getResponseCode() === 429) {
      const retryAfter = parseInt(response.getHeaders()['Retry-After'] || '60');
      Utilities.sleep(retryAfter * 1000);
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}
```

---

## セキュリティベストプラクティス

### 1. 最小権限の原則

**GitHub権限:**
- ✅ Read-only権限のみを使用
- ❌ Write権限は不要

**GASプロジェクト共有:**
- ✅ 必要最小限のユーザーのみに編集権限
- ✅ 閲覧のみのユーザーには閲覧権限
- ❌ 組織全体への共有は避ける

### 2. 認証方式の選択

| 用途 | 推奨認証方式 | 理由 |
|------|-------------|------|
| 個人利用 | PAT | シンプル、セットアップが簡単 |
| チーム利用（<10人） | PAT | 管理が容易 |
| 組織利用（10人以上） | GitHub Apps | 権限の細分化、監査ログ |
| セキュリティ重視 | GitHub Apps | レート制限緩和、トークン自動更新 |

### 3. 定期的なセキュリティレビュー

**月次チェックリスト:**
- [ ] 監査ログの確認（`showAuditLogs(100)`）
- [ ] 不要なリポジトリ登録の削除
- [ ] GASプロジェクト共有設定の確認
- [ ] GitHub App権限の確認（必要最小限か）

**四半期チェックリスト:**
- [ ] Private Keyのローテーション（GitHub Apps）
- [ ] PATの有効期限確認と再発行
- [ ] 監査ログのスプレッドシートエクスポート
- [ ] アクセス権レビュー

### 4. インシデント対応

**トークン漏洩時の対応:**
1. **即座に無効化**
   - GitHub: Settings → Developer settings → Personal access tokens → Revoke
   - GitHub Apps: Settings → GitHub Apps → Revoke all user tokens
2. **監査ログの確認**
   ```javascript
   showAuditLogs(1000);  // 直近1000件を確認
   ```
3. **新しいトークンで再設定**
   ```javascript
   setup('new-token-here', 'spreadsheet-id');
   ```
4. **影響範囲の調査**
   - どのリポジトリにアクセスされたか
   - 何のデータが取得されたか

---

## 関連ドキュメント

- [GitHub Apps認証ガイド](GITHUB_APPS_AUTH.md) - セキュアな認証設定
- [組織導入ガイド](SETUP_AND_TROUBLESHOOTING.md) - 権限管理と担当者設定
- [クイックスタート](QUICK_START.md) - 基本的なセットアップ手順

---

## セキュリティに関する問い合わせ

セキュリティ上の問題を発見した場合は、公開のIssueではなく、プロジェクトメンテナーに直接連絡してください。

**報告内容:**
- 脆弱性の詳細
- 再現手順
- 影響範囲
- 推奨される修正方法（あれば）
