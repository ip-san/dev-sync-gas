# 🔒 セキュリティガイド

DevSyncGASのセキュリティ機能と、ITGC（IT全般統制）要件への対応について説明します。

## 🛡️ セキュリティ概要

DevSyncGASは以下のセキュリティ原則に基づいて設計されています。

| 原則 | 実装状況 |
|------|----------|
| 🔑 最小権限の原則 | GitHub APIはRead-onlyのみ |
| ✅ 入力検証 | 全ての外部入力を検証 |
| 📝 監査証跡 | 全ての設定変更を記録 |
| 🔐 機密情報保護 | Secret Manager統合（PropertiesServiceフォールバック） |
| ⚠️ エラーハンドリング | 機密情報をエラーメッセージから除外 |

## ✨ 実装済みセキュリティ対策

### 1. 🚪 入力検証

**全ての外部入力に対して厳格な検証を実施します。**

**検証される項目:**
- GitHubリポジトリ名/オーナー名
- スプレッドシートID
- プロジェクト名
- GitHub App ID/Installation ID
- Private Key形式

**例:**
```typescript
// src/init.ts での設定
// ❌ 不正な入力は拒否される（initConfig() 実行時にエラー）
repositories: [
  { owner: '../../../etc', name: 'passwd' },  // Error: Invalid repository name
],

// ✅ 正しい入力のみ受け入れる
repositories: [
  { owner: 'your-org', name: 'your-repo' },
],
```

**検証ルール:**
- リポジトリオーナー: 英数字、ハイフン（1-39文字）
- リポジトリ名: 英数字、ハイフン、アンダースコア、ピリオド（1-100文字）
- スプレッドシートID: 英数字、ハイフン、アンダースコア（20-100文字）
- 危険なパターン（`../`, `<script>`等）を自動ブロック

### 2. 📊 監査ログ

**全ての設定変更操作を記録し、誰がいつ何をしたかを追跡可能にします。**

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

### 3. 🗑️ 機密情報の安全な削除

**GitHub App設定を削除する際に、操作を監査ログに記録します。**

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

### 4. 🎭 エラーメッセージからの機密情報除外

**APIエラー等で機密情報がログに含まれないよう、自動的にマスクします。**

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

### 5. 💾 トークンキャッシュの安全化

**GitHub Apps Installation Tokenをグローバル変数ではなく、PropertiesServiceに保存します。**

**メリット:**
- 実行セッション間での意図しないキャッシュ共有を防止
- トークンの有効期限を厳密に管理
- デバッグ時のトークン漏洩リスクを低減

### 6. ⏱️ APIタイムアウト設定

**外部API呼び出しにタイムアウトを設定し、長時間のハングを防ぎます。**

**設定値:**
- デフォルトタイムアウト: 30秒
- SSL証明書検証: 有効
- リダイレクト追跡: 有効

### 7. 🔐 Google Secret Manager統合

**GitHub App Private Keyを安全に保存するため、Google Secret Managerとの統合を実装済みです。**

**機能:**
- Secret Manager APIとの完全統合
- シークレットの自動バージョン管理
- PropertiesServiceへの自動フォールバック
- PropertiesServiceからの移行ヘルパー関数

**セキュリティ改善:**
- Private Keyの暗号化保存（Google管理の鍵で暗号化）
- IAMによる細かいアクセス制御
- Cloud Audit Logsによる操作記録
- バージョン管理とロールバック機能
- 自動ローテーション対応

**使い方:**
```javascript
// Secret Managerを有効化
enableSecretManager('your-gcp-project-id');

// init.tsで設定してinitConfig()を実行すると、
// Private Keyは自動的にSecret Managerに保存されます

// 既存キーの移行
migratePrivateKey();
```

詳細は「[🔑 機密情報の取り扱い](#-機密情報の取り扱い)」セクションを参照。

### 8. 📊 ログレベル制御

**環境に応じてログの出力レベルを制御し、本番環境での機密情報露出リスクを低減します。**

**機能:**
- 4段階のログレベル（DEBUG < INFO < WARN < ERROR）
- PropertiesServiceで設定を永続化
- 設定レベル以上のログのみ出力

**セキュリティ改善:**
- 本番環境でDEBUGログを抑制（機密情報露出リスク低減）
- エラーレベルのみに絞ることで重要な問題に集中
- 開発環境ではDEBUGで詳細なトレース可能

**使い方:**
```javascript
// 本番環境：情報レベル以上のみ表示（デフォルト）
configureLogLevel('INFO');

// 本番環境（厳格）：警告とエラーのみ表示
configureLogLevel('WARN');

// 開発環境：すべてのログを表示
configureLogLevel('DEBUG');

// 現在の設定を確認
checkConfig();
```

**推奨設定:**
- 開発環境: `DEBUG` （全ログで問題をトレース）
- ステージング環境: `INFO` （通常の動作ログ）
- 本番環境: `WARN` または `ERROR` （問題のみに集中）

### 9. 🔍 スプレッドシートアクセス権限検証

**セットアップ時にスプレッドシートへのアクセス権限を事前検証します。**

**機能:**
- スプレッドシートIDの形式検証
- 実際のアクセステスト（SpreadsheetApp.openById）
- エラーの種類に応じた詳細なメッセージ

**セキュリティ改善:**
- アクセス権限不足を早期検出
- 存在しないスプレッドシートを事前に検知
- 明確なエラーメッセージで問題解決を支援

**自動実行:**
```javascript
// 以下の関数で自動的に検証される
initConfig(); // init.tsの設定を使用
addProject({ name: 'project', spreadsheetId: 'id', ... });
```

### 10. 🔄 API レート制限リトライ機構

**GitHub APIのレート制限やサーバーエラーに自動対応します。**

**機能:**
- レート制限（429）の自動リトライ（最大3回）
- Retry-Afterヘッダーの自動認識
- Exponential backoff（1秒、2秒、4秒）
- サーバーエラー（5xx）にも対応

**セキュリティ改善:**
- APIレート制限超過によるデータ取得失敗を防止
- 一時的なサーバーエラーからの自動復旧
- ログ出力によるリトライ状況の可視化

**動作例:**
```
⚠️ Rate limit exceeded (429). Retrying after 60s (attempt 1/3)
⚠️ Server error (503). Retrying after 1s (attempt 1/3)
```

## 📝 監査ログ

### 🏢 ITGCコンプライアンス

監査ログは以下のITGC要件に対応しています。

| 要件 | 対応状況 |
|------|----------|
| 変更管理 | 全ての設定変更を記録 |
| アクセス管理 | ユーザー情報（メールアドレス）を記録 |
| 監査証跡 | タイムスタンプ、アクション、詳細を記録 |
| 長期保存 | スプレッドシートへのエクスポート機能 |

### 💾 監査ログの保存期間

- GAS実行ログ: 最大で直近の実行ログのみ（推奨: 定期的にエクスポート）
- スプレッドシート: 無期限（ユーザー管理）

### 📄 監査レポートの生成

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

## ✅ 入力検証

全ての検証関数は `src/utils/validation.ts` に定義されています。

### 🔧 カスタム検証の追加

独自の検証ルールを追加する場合:

```typescript
// src/utils/validation.ts に追加
export function validateCustomField(value: string): void {
  if (!value.match(/^[A-Z]{3}-\d{4}$/)) {
    throw new Error('Custom field must match format: ABC-1234');
  }
}
```

## 🔑 機密情報の取り扱い

### 🗄️ PropertiesServiceのセキュリティ

**特徴:**
- GASプロジェクト単位で暗号化保存
- APIキーやトークンの保存に適している
- 注意: GASプロジェクトへのアクセス権を持つ全員が閲覧可能

**アクセス制御:**
1. GASプロジェクトの共有設定を最小限に
2. 閲覧権限のみのユーザーはPropertiesを見られない
3. 編集権限のユーザーは全てのPropertiesを閲覧可能

### 🌟 Google Secret Manager統合（推奨）

**組織利用では必須の機密情報保護機能です。Private KeyをSecret Managerで管理できます。**

**メリット:**
- バージョン管理（過去のキーにロールバック可能）
- アクセス制御の細分化（IAMで管理）
- 監査ログの自動記録（Cloud Audit Logs）
- 自動ローテーション機能
- PropertiesServiceの平文保存リスクを解消

**セットアップ手順:**

```javascript
// 1. Secret Managerを有効化
enableSecretManager('your-gcp-project-id');

// 2. init.tsでGitHub Apps認証を設定してinitConfig()を実行
// Private Keyは自動的にSecret Managerに保存されます
initConfig();

// 3. 既存のPrivate Keyを移行する場合
migratePrivateKey();

// 4. Secret Managerの状態を確認
showSecretManagerStatus();
```

**必要な設定:**

1. GCP Consoleで以下を実施:
   - Secret Manager APIを有効化
   - GASサービスアカウントに`Secret Manager Secret Accessor`ロールを付与

2. appsscript.jsonにOAuth2スコープを追加:
```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/cloud-platform"
  ]
}
```

**フォールバック機構:**

Secret Manager取得に失敗した場合、自動的にPropertiesServiceにフォールバックします。

**その他のシークレット管理:**

```javascript
// カスタムシークレットの保存
storeSecret('api-key', 'your-secret-value', { app: 'my-app' });

// シークレットの取得
const apiKey = getSecret('api-key');

// シークレットの削除
deleteSecret('old-api-key');
```

### 🔄 Private Keyの定期ローテーション

**推奨頻度: 90日ごと**

**手順:**
1. GitHub Appの設定ページで新しいPrivate Keyを生成
2. `src/init.ts` を更新して `initConfig()` を実行
3. 古いキーをGitHub側で削除
4. 監査ログで変更を確認

## ⚠️ 残存リスクと推奨対策

### リスク1: Private Keyの平文保存（✅ 対策済み）

**実装状況:**
- Google Secret Manager統合を実装済み
- PropertiesServiceからSecret Managerへの移行機能を提供
- 自動フォールバック機構により互換性を維持

**残存リスク:**
- Secret Managerを有効化していない場合、依然としてPropertiesServiceに平文保存
- Secret Manager APIが利用できない環境（一部のGASプロジェクト制限等）

**推奨対策:**
1. ✨ 必須（組織利用）: `enableSecretManager()` でSecret Managerを有効化
2. 🚀 推奨: `migratePrivateKey()` で既存のキーを移行
3. 🔒 最小（個人利用）: GASプロジェクトの共有を最小限に制限

**実装方法:**
```javascript
// Secret Managerを有効化してリスクを解消
enableSecretManager('your-gcp-project-id');
// init.tsで設定してinitConfig()を実行
initConfig();
```

### リスク2: スプレッドシートアクセス制御（✅ 対策済み）

**実装状況:**
- スプレッドシートアクセス権限の事前検証を実装
- エラーの種類に応じた詳細なメッセージを提供
- initConfig()、addProject() で自動実行

**実装内容:**
- `src/utils/spreadsheetValidator.ts` にvalidateSpreadsheetAccess()を実装
- アクセス権限エラー、存在しないスプレッドシートなどを区別
- セットアップ時に自動的にアクセス権限を検証

**残存リスク:**
- テスト環境ではSpreadsheetApp未定義のためスキップ
- GAS環境でのみ検証が実行される

**動作:**
```javascript
// initConfig()実行時に自動検証される
initConfig(); // アクセス権限を自動検証

// エラー例：
// "Spreadsheet not found: xxxx
//  Check if:
//  1. The spreadsheet ID is correct
//  2. The spreadsheet has not been deleted
//  3. The spreadsheet is in your Google Drive or shared with you"
```

### リスク3: レート制限超過（✅ 対策済み）

**実装状況:**
- GitHub APIレート制限（429）の自動リトライを実装
- Exponential backoffによる段階的な待機
- Retry-Afterヘッダーの自動認識
- サーバーエラー（5xx）にも対応

**実装内容:**
- `src/adapters/gas/index.ts` のGasHttpClientにリトライ機構を実装
- 最大3回まで自動リトライ
- Retry-Afterヘッダーがあればその値を優先
- なければExponential backoff（1秒、2秒、4秒）

**動作:**
```javascript
// 自動的に実行される（設定不要）
// レート制限（429）またはサーバーエラー（5xx）時：
// ⚠️ Rate limit exceeded (429). Retrying after 60s (attempt 1/3)
// ⚠️ Server error (503). Retrying after 1s (attempt 1/3)
```

**残存リスク:**
- 最大リトライ回数（3回）を超えた場合はエラー
- GAS実行時間制限（6分）内に完了する必要がある

## 🌟 セキュリティベストプラクティス

### 1. 🔑 最小権限の原則

**GitHub権限:**
- Read-only権限のみを使用
- Write権限は不要

**GASプロジェクト共有:**
- 必要最小限のユーザーのみに編集権限
- 閲覧のみのユーザーには閲覧権限
- 組織全体への共有は避ける

### 2. 🎯 認証方式の選択

| 用途 | 推奨認証方式 | 理由 |
|------|-------------|------|
| 個人利用 | PAT | シンプル、セットアップが簡単 |
| チーム利用（<10人） | PAT | 管理が容易 |
| 組織利用（10人以上） | GitHub Apps | 権限の細分化、監査ログ |
| セキュリティ重視 | GitHub Apps | レート制限緩和、トークン自動更新 |

### 3. 📅 定期的なセキュリティレビュー

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

### 4. 🚨 インシデント対応

**トークン漏洩時の対応:**
1. **即座に無効化**
   - GitHub: Settings → Developer settings → Personal access tokens → Revoke
   - GitHub Apps: Settings → GitHub Apps → Revoke all user tokens
2. **監査ログの確認**
   ```javascript
   showAuditLogs(1000);  // 直近1000件を確認
   ```
3. **新しいトークンで再設定**
   ```typescript
   // src/init.ts を更新
   auth: { type: 'token', token: 'new-token-here' }
   // 再デプロイしてinitConfig()を実行
   ```
4. **影響範囲の調査**
   - どのリポジトリにアクセスされたか
   - 何のデータが取得されたか

## 📚 関連ドキュメント

- [GitHub Apps認証ガイド](GITHUB_APPS_AUTH.md) - セキュアな認証設定
- [セットアップガイド](SETUP.md) - 権限管理と担当者設定
- [クイックスタート](QUICK_START.md) - 基本的なセットアップ手順

## 🔒 セキュリティに関する問い合わせ

セキュリティ上の問題を発見した場合は、公開のIssueではなく、プロジェクトメンテナーに直接連絡してください。

**報告内容:**
- 脆弱性の詳細
- 再現手順
- 影響範囲
- 推奨される修正方法（あれば）
