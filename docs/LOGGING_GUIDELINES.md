# ログレベルガイドライン

## 概要

本プロジェクトでは、適切なログレベルを使用してログの可読性とデバッグ効率を向上させます。

## ログレベル定義

### ERROR - エラー（最重要）
**用途**: 操作の失敗、エラー状態、ユーザーが対処すべき問題

**使用例**:
```typescript
logger.error('Failed to open spreadsheet: SPREADSHEET_ACCESS_DENIED');
logger.error('GitHub API authentication failed: 401 Unauthorized');
logger.error('Migration failed: Invalid schema');
```

**判定基準**:
- ✅ 処理が失敗した
- ✅ ユーザーの介入が必要
- ✅ データ損失の可能性がある
- ✅ 外部API呼び出しが失敗した

### WARN - 警告
**用途**: 正常動作だが注意が必要な状態、潜在的な問題

**使用例**:
```typescript
logger.warn('Clearing GitHub App configuration - Private Key will be deleted');
logger.warn('Original key is still in PropertiesService after migration');
logger.warn('No audit logs to export');
```

**判定基準**:
- ✅ 処理は継続できるが、ユーザーの注意が必要
- ✅ セキュリティ関連の操作（削除、変更）
- ✅ データが見つからない（エラーではない）
- ✅ 推奨設定と異なる動作

### INFO - 情報（デフォルト）
**用途**: 通常の処理フロー、成功メッセージ、進捗状況

**使用例**:
```typescript
logger.info('✅ Configuration saved (PAT auth)');
logger.info('✅ Added repository: owner/repo');
logger.info('📝 Wrote 10 PR size records');
logger.info('🔑 Fetching new GitHub App Installation Token...');
```

**判定基準**:
- ✅ 処理が成功した
- ✅ 重要な操作の開始/完了
- ✅ ユーザーに見せたい進捗状況
- ✅ 設定変更の確認

### DEBUG - デバッグ
**用途**: 開発・デバッグ時の詳細情報、内部処理の追跡

**使用例**:
```typescript
logger.debug('Processing PR #123 for repository owner/repo');
logger.debug('Excluded 5 PRs by labels: [exclude-metrics, dependencies]');
logger.debug('Cache hit for installation token (expires in 45 minutes)');
logger.debug('GraphQL batch: fetched 100 PRs in 1.2s');
```

**判定基準**:
- ✅ 処理の内部ステップ
- ✅ パフォーマンス計測
- ✅ データ変換の詳細
- ✅ 通常は表示不要だが、問題発生時に役立つ情報

## メッセージフォーマット規則

### 成功メッセージ
- ✅ emoji（`✅`）で開始
- 簡潔に結果を記述
- 例: `✅ Daily trigger created for 9:00 AM`

### 処理開始/進行中
- 📦, 🔑, 🔄 などのemoji使用可
- 例: `🔑 Fetching new GitHub App Installation Token...`

### 警告メッセージ
- ⚠️ emoji（`⚠️`）で開始
- 何に注意すべきか明記
- 例: `⚠️ Clearing GitHub App configuration...`

### エラーメッセージ
- ❌ emoji（`❌`）で開始
- エラーコードまたは原因を含める
- 例: `❌ Migration failed for Dashboard: SHEET_NOT_FOUND`

### 統計・カウント情報
- 📊, 📋 などのemoji使用可
- 数値を含める
- 例: `📊 Writing PR size to 3 repository sheets...`

## 移行パターン

### パターン1: 成功メッセージ → INFO
```typescript
// Before
logger.log('✅ Configuration saved (PAT auth)');

// After
logger.info('✅ Configuration saved (PAT auth)');
```

### パターン2: 警告メッセージ → WARN
```typescript
// Before
logger.log('⚠️ Clearing GitHub App configuration...');

// After
logger.warn('⚠️ Clearing GitHub App configuration...');
```

### パターン3: エラーメッセージ → ERROR
```typescript
// Before
logger.log(`❌ Error: Unknown sheet name: ${sheetName}`);

// After
logger.error(`❌ Error: Unknown sheet name: ${sheetName}`);
```

### パターン4: 処理詳細 → DEBUG
```typescript
// Before
logger.log(`  ℹ️ Excluded ${excludedCount} PRs by labels`);

// After
logger.debug(`  ℹ️ Excluded ${excludedCount} PRs by labels`);
```

### パターン5: 進捗/開始メッセージ → INFO
```typescript
// Before
logger.log(`🔑 Fetching new GitHub App Installation Token...`);

// After
logger.info(`🔑 Fetching new GitHub App Installation Token...`);
```

## 既存コードの分類基準

### ✅ emoji → INFO
- 成功メッセージはすべてINFO

### ⚠️ emoji → WARN
- 警告メッセージはすべてWARN

### ❌ emoji → ERROR
- エラーメッセージはすべてERROR

### 📦📊📋🔑🔄 などの処理emoji → INFO（通常）or DEBUG（詳細）
- ユーザーに見せたい進捗 → INFO
- 内部処理の詳細 → DEBUG

### `  ` で始まるインデント付きメッセージ → DEBUG
- サブ情報、詳細情報はDEBUG

## ファイル別優先度（移行計画）

### 最優先（Phase 1）
セットアップ・設定系（ユーザーが直接実行）:
- `src/functions/setup.ts` - セットアップ関数
- `src/config/auth.ts` - 認証設定
- `src/services/githubAuth.ts` - GitHub認証
- `src/utils/secretManager.ts` - Secret Manager

### 高優先度（Phase 2）
コア機能・マイグレーション:
- `src/services/migration.ts` - スキーママイグレーション（45箇所）
- `src/functions/migration.ts` - マイグレーション関数
- `src/services/spreadsheet/helpers.ts` - スプレッドシート基盤

### 中優先度（Phase 3）
データ書き込み系:
- `src/services/spreadsheet/dashboard.ts`
- `src/services/spreadsheet/reviewEfficiency.ts`
- `src/services/spreadsheet/prSize.ts`
- `src/services/spreadsheet/reworkRate.ts`

### 低優先度（Phase 4）
GitHub API・その他:
- `src/services/github/graphql/*.ts`
- `src/services/github/*.ts`
- その他のサービス層

## 後方互換性

`logger.log()` は引き続き使用可能で、`logger.info()` として扱われます。

```typescript
// 両方とも同じ動作
logger.log('Message');  // 後方互換性のため維持
logger.info('Message'); // 推奨
```

## 実装チェックリスト

- [ ] ✅ emoji → `logger.info()`
- [ ] ⚠️ emoji → `logger.warn()`
- [ ] ❌ emoji → `logger.error()`
- [ ] インデント付きメッセージ → `logger.debug()`
- [ ] 処理開始/進捗 → 重要度に応じて `logger.info()` or `logger.debug()`
- [ ] エラーハンドリング内 → `logger.error()`
