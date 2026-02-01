# ログレベル制御移行計画

## 概要

既存の `logger.log()` 呼び出し（173箇所）を適切なログレベル（DEBUG/INFO/WARN/ERROR）に移行する。

## 現状分析

### 統計情報
- **総数**: 173箇所の `logger.log()` 呼び出し
- **レベル指定済み**: 1箇所のみ（`helpers.ts` の `logger.error()`）
- **対象ファイル**: 29ファイル

### ファイル別内訳（Top 10）
1. `src/services/migration.ts` - 45箇所（最多）
2. `src/services/github/graphql/pullRequests.ts` - 6箇所
3. `src/utils/secretManager.ts` - 6箇所
4. `src/config/auth.ts` - 4箇所
5. `src/services/spreadsheet/*.ts` - 各4箇所
6. `src/functions/migration.ts` - 11箇所
7. 他23ファイル - 1-3箇所ずつ

## 分類基準（ガイドライン参照）

### ERROR (エラー)
**パターン**:
- `❌` emojiで始まる
- try-catchのcatch内
- API呼び出し失敗
- 設定エラー

**例**:
```typescript
logger.error(`❌ Migration failed for ${schema.sheetName}: ${errorMessage}`);
logger.error('Failed to open spreadsheet: SPREADSHEET_ACCESS_DENIED');
```

### WARN (警告)
**パターン**:
- `⚠️` emojiで始まる
- セキュリティ関連操作の通知
- データが見つからない（エラーではない）
- 非推奨パターンの使用

**例**:
```typescript
logger.warn('⚠️ Clearing GitHub App configuration...');
logger.warn('Original key is still in PropertiesService');
logger.warn('No audit logs to export');
```

### INFO (情報 - デフォルト)
**パターン**:
- `✅` emojiで始まる（成功）
- `🔑📦🔄📋` などの処理開始/進捗
- ユーザーに見せたい重要な状態変化

**例**:
```typescript
logger.info('✅ Configuration saved (PAT auth)');
logger.info('✅ Added repository: owner/repo');
logger.info('🔑 Fetching new GitHub App Installation Token...');
logger.info('📊 Writing PR size to 3 repository sheets...');
```

### DEBUG (デバッグ)
**パターン**:
- インデント付き（`  ` で始まる）
- `ℹ️` emojiで始まる詳細情報
- 内部処理ステップ
- 除外/スキップされた件数

**例**:
```typescript
logger.debug('  ℹ️ Excluded 5 PRs by labels');
logger.debug('  📦 Fetched 100 PRs via GraphQL');
logger.debug('  ⚠️ Failed to fetch batch PR details');
```

## Phase 1: セットアップ・認証系（最優先）

### 対象ファイル
- `src/functions/setup.ts` (1箇所)
- `src/config/auth.ts` (4箇所)
- `src/services/githubAuth.ts` (2箇所)
- `src/utils/secretManager.ts` (6箇所)

### 理由
- ユーザーが直接実行する関数
- エラーメッセージの重要度が高い
- セキュリティ関連の警告が多い

### 変更内容例

#### `src/config/auth.ts`
```typescript
// Line 16-18: WARN（セキュリティ警告）
logger.warn('⚠️ Clearing GitHub App configuration...');
logger.warn('   This will remove App ID, Private Key, and Installation ID');
logger.warn('   Make sure to revoke the GitHub App access if no longer needed');

// Line 30: INFO（成功）
logger.info('✅ GitHub App configuration cleared');
```

#### `src/services/githubAuth.ts`
```typescript
// Line 173: INFO（成功）
logger.info('✅ GitHub App Installation Token obtained successfully');

// Line 220: INFO（処理開始）
logger.info('🔑 Fetching new GitHub App Installation Token...');
```

#### `src/utils/secretManager.ts`
```typescript
// Line 111, 116: INFO（成功）
logger.info(`✅ Created secret: ${secretId}`);
logger.info(`✅ Stored secret version: ${secretId}`);

// Line 319: INFO（成功）
logger.info(`✅ Deleted secret: ${secretId}`);

// Line 354: INFO（成功）
logger.info('✅ Migrated Private Key to Secret Manager');

// Line 355-356: WARN（警告）
logger.warn('⚠️ Original key is still in PropertiesService');
logger.warn('   Run clearGitHubAppConfig() to remove it after verifying the migration');
```

#### `src/functions/setup.ts`
```typescript
// Line 195: INFO（成功）
logger.info('✅ Daily trigger created for 9:00 AM');
```

### Phase 1 統計
- **ERROR**: 0箇所
- **WARN**: 5箇所
- **INFO**: 8箇所
- **DEBUG**: 0箇所
- **合計**: 13箇所

## Phase 2: マイグレーション系（高優先）

### 対象ファイル
- `src/services/migration.ts` (45箇所)
- `src/functions/migration.ts` (11箇所)

### 理由
- 最も logger.log() が多い（56箇所）
- マイグレーション失敗はクリティカル
- 詳細な進捗表示が必要

### 変更内容例

#### `src/services/migration.ts`
```typescript
// Line 227: INFO（成功）
logger.info(`📋 Backup created: ${backupName}`);

// Line 230-231: DEBUG（詳細情報）
logger.debug(
  `   Full backup includes: ${Object.keys(backup).join(', ')}`
);

// Line 253: INFO（成功）
logger.info(`🔄 Restored from backup`);

// Line 371: INFO（成功）
logger.info(`✅ Migrated: ${schema.sheetName}`);

// Line 405: ERROR（失敗）
logger.error(`❌ Migration failed for ${schema.sheetName}: ${errorMessage}`);

// Line 410: INFO（復元成功）
logger.info(`🔄 Restored ${schema.sheetName} from backup`);

// Line 468: DEBUG（詳細）
logger.debug(`   Backup available: ${backup.backupName}`);

// Line 612: INFO（成功）
logger.info(`✅ Headers updated: ${schema.sheetName}`);

// Line 682-697: INFO（プレビュー情報）
logger.info(`\nSheet: ${preview.sheetName}`);
// ... 以下、プレビュー表示はすべてINFO
```

#### `src/functions/migration.ts`
```typescript
// Line 31-32: INFO（プレビュー開始）
logger.info('=== Schema Migration Preview ===');
logger.info('This is a dry run. No changes will be made.\n');

// Line 39: INFO（案内）
logger.info('\nTo apply migrations, run: migrateAllSchemas()');

// Line 51: INFO（マイグレーション開始）
logger.info('=== Starting Schema Migration ===\n');

// Line 54: INFO（進捗）
logger.info(`Migrating: ${schema.sheetName}...`);

// Line 73: ERROR（エラー）
logger.error(`❌ Error: Unknown sheet name: ${sheetName}`);

// Line 74-75: INFO（利用可能シート一覧）
logger.info('Available sheets:');
ALL_SCHEMAS.forEach((s) => logger.info(`  - ${s.sheetName}`));

// Line 93: INFO（ヘッダー更新開始）
logger.info('=== Updating Headers Only ===\n');

// Line 96: INFO（進捗）
logger.info(`Updating headers: ${schema.sheetName}...`);
```

### Phase 2 統計
- **ERROR**: 2箇所
- **WARN**: 0箇所
- **INFO**: 48箇所
- **DEBUG**: 6箇所
- **合計**: 56箇所

## Phase 3: Spreadsheet書き込み系（中優先）

### 対象ファイル
- `src/services/spreadsheet/reviewEfficiency.ts` (4箇所)
- `src/services/spreadsheet/prSize.ts` (4箇所)
- `src/services/spreadsheet/reworkRate.ts` (4箇所)
- `src/services/spreadsheet/dashboard.ts` (4箇所)
- `src/services/spreadsheet/codingTime.ts` (4箇所)
- `src/services/spreadsheet/cycleTime.ts` (4箇所)

### 変更パターン（共通）

すべてのスプレッドシート書き込み関数で同じパターン:

```typescript
// 成功メッセージ → INFO
logger.info(`📝 Wrote review efficiency metrics to repository sheets`);
logger.info(`📝 Wrote PR size metrics to repository sheets`);
logger.info(`📝 Wrote rework rate metrics to repository sheets`);

// 詳細（リポジトリ別） → INFO
logger.info(`✅ [${repository}] Wrote ${detailsToWrite.length} review efficiency records`);

// 統計情報 → INFO
logger.info(`📊 Writing review efficiency to ${grouped.size} repository sheets...`);
logger.info(`✅ Total: ${totalWritten} written, ${totalSkipped} skipped across ${grouped.size} repositories`);
```

### Phase 3 統計
- **ERROR**: 0箇所
- **WARN**: 0箇所
- **INFO**: 24箇所
- **DEBUG**: 0箇所
- **合計**: 24箇所

## Phase 4: GitHub API・その他（低優先）

### 対象ファイル
- `src/services/github/graphql/pullRequests.ts` (6箇所)
- `src/config/metrics.ts` (2箇所)
- `src/utils/auditLog.ts` (3箇所)
- その他 (残り約30箇所)

### 変更内容例

#### `src/services/github/graphql/pullRequests.ts`
```typescript
// Line 115: DEBUG（除外数）
logger.debug(`  ℹ️ Excluded ${excludedCount} PRs by labels`);

// Line 163: INFO（取得成功）
logger.info(`  📦 Fetched ${allPRs.length} PRs via GraphQL`);

// Line 293, 416, 504: WARN（バッチ失敗）
logger.warn(`  ⚠️ Failed to fetch batch PR details: ${result.error}`);
logger.warn(`  ⚠️ Failed to fetch batch PR size: ${result.error}`);
logger.warn(`  ⚠️ Failed to fetch batch PR reviews: ${result.error}`);
```

#### `src/config/metrics.ts`
```typescript
// Line 64: WARN（検証警告）
logger.warn(`⚠️ Property ${key} is not a valid string array`);

// Line 66: DEBUG（詳細）
logger.debug(`   Resetting to default: ${JSON.stringify(defaultValue)}`);
```

#### `src/utils/auditLog.ts`
```typescript
// Line 91: DEBUG（監査ログ出力）
logger.debug(logMessage);

// Line 195: WARN（ログなし）
logger.warn('No audit logs to export');

// Line 226: INFO（エクスポート成功）
logger.info(`✅ Exported ${logs.length} audit log entries to "${sheetName}"`);
```

### Phase 4 統計
- **ERROR**: 0箇所
- **WARN**: 7箇所
- **INFO**: 3箇所
- **DEBUG**: 10箇所
- **合計**: 20箇所

## 全体統計（Phase 1-4合計）

| ログレベル | 箇所数 | 割合 |
|-----------|-------|------|
| ERROR | 2 | 2% |
| WARN | 12 | 11% |
| INFO | 83 | 73% |
| DEBUG | 16 | 14% |
| **合計** | **113** | **100%** |

※ 残り60箇所は個別ファイルで少数（1-3箇所ずつ）のため、Phase 4でまとめて対応

## 実装戦略

### Step 1: Phase 1実装（最優先）
- ファイル数: 4ファイル
- 変更箇所: 13箇所
- リスク: 低
- 影響: セットアップ・認証系のみ

### Step 2: Phase 2実装（高優先）
- ファイル数: 2ファイル
- 変更箇所: 56箇所
- リスク: 中（マイグレーション機能）
- 影響: スキーママイグレーション実行時のログのみ

### Step 3: Phase 3実装（中優先）
- ファイル数: 6ファイル
- 変更箇所: 24箇所
- リスク: 低
- 影響: データ書き込み時のログのみ

### Step 4: Phase 4実装（低優先）
- ファイル数: 17ファイル
- 変更箇所: 20箇所
- リスク: 低
- 影響: GitHub API呼び出し、その他

### Step 5: 残りの対応
- ファイル数: 残り全て
- 変更箇所: 約60箇所
- 個別に適切なログレベルを判断

## 検証方法

### 1. 型チェック
```bash
bunx tsc --noEmit
```

### 2. Lint
```bash
bun run lint
```

### 3. ビルド
```bash
bun run build
```

### 4. 手動テスト
各Phaseごとに実際の関数を実行してログ出力を確認:

**Phase 1**:
```javascript
setup('token', 'spreadsheet-id');
clearGitHubAppConfig();
```

**Phase 2**:
```javascript
previewAllMigrations();
migrateAllSchemas();
```

**Phase 3**:
```javascript
syncDevOpsMetrics();
```

**Phase 4**:
```javascript
fetchAllPRs('owner', 'repo');
```

## リスク管理

| リスク | 影響 | 緩和策 |
|--------|------|--------|
| ログの見落とし | 低 | 各Phase完了後にGrep検索で確認 |
| 誤った分類 | 低 | ガイドライン文書で判断基準明確化 |
| ビルドエラー | 低 | LoggerClient interfaceは既に定義済み |
| 後方互換性破壊 | なし | logger.log()は維持 |

## 完了条件

- [ ] Phase 1-4 完了
- [ ] 全テスト成功
- [ ] 型チェック成功
- [ ] Lint成功
- [ ] ビルド成功
- [ ] ガイドライン文書完成
- [ ] 各Phaseで手動テスト実施
- [ ] logger.log() 残存箇所が意図的であることを確認

## Next Steps

1. Phase 1から順次実装
2. 各Phase完了ごとにPR作成
3. 段階的マージ
4. 最終的に全173箇所を適切なログレベルに移行
