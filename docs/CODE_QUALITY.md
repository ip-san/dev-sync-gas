# コード品質管理

DevSyncGASプロジェクトで実施している自動品質チェックの仕組みについて説明します。

## 概要

本プロジェクトでは、生成AI（Claude Code）と従来のプログラムベースチェックを組み合わせて、コード品質を多層的に担保しています。

### 品質チェックの全体像

```
┌─────────────────────┐
│  開発者がコード記述  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Pre-commit Hook    │  ← 自動実行（コミット前）
│  - ESLint --fix     │
│  - Prettier --write │
│  - Type Check       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Pre-push Hook      │  ← 自動実行（プッシュ前）
│  - Test Suite       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  GitHub Actions CI  │  ← 自動実行（PR/Push時）
│  - Lint             │
│  - Format Check     │
│  - Type Coverage    │
│  - Circular Deps    │
│  - Unused Code      │
│  - Tests            │
│  - Build            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Claude Code Skills │  ← 手動実行（PR作成前）
│  /pr-check          │
│  /review            │
└─────────────────────┘
```

## 自動チェック一覧

### Phase 1: 即座に効果が出る施策

#### 1. TypeScript 型安全性の強化

**ファイル**: [tsconfig.json](../tsconfig.json)

```json
{
  "noFallthroughCasesInSwitch": true,  // switch文の抜け漏れ防止
  "allowUnusedLabels": false,          // 未使用ラベルの禁止
  "allowUnreachableCode": false        // 到達不可能コードの禁止
}
```

**効果**: switch文のbreak忘れ、デッドコードを自動検出

#### 2. コード複雑度チェック

**ファイル**: [.eslintrc.json](../.eslintrc.json)

```json
{
  "complexity": ["warn", 10],              // Cyclomatic複雑度
  "max-depth": ["warn", 3],               // ネストの深さ
  "max-lines-per-function": ["error", 50], // 関数の行数（2026-02-01時点で警告0件）
  "max-params": ["warn", 4]               // 引数の数（2026-02-01時点で警告2件）
}
```

**効果**: 複雑で保守困難なコードを早期に警告

**現状**（2026-02-01時点）:
- `max-lines-per-function`: 警告0件（完全解消済み）
- `max-params`: 警告2件（オブジェクト引数パターンへの移行推奨）

#### 3. Pre-commit/Pre-push フック

**ファイル**:
- [.husky/pre-commit](../.husky/pre-commit)
- [.husky/pre-push](../.husky/pre-push)
- [.lintstagedrc.json](../.lintstagedrc.json)

**仕組み**:
- **Pre-commit**: 変更されたファイルに対して自動フォーマット・Lint・型チェック
- **Pre-push**: テスト実行（全テストがパスしないとプッシュできない）

**効果**: 品質基準を満たさないコードがリポジトリに入らない

### Phase 2: 中長期的な品質向上

#### 4. 循環依存の検出

**コマンド**: `bun run check:circular`

**ツール**: [madge](https://github.com/pahen/madge)

**効果**: モジュール間の循環参照を検出し、設計の健全性を維持

**結果例**:
```
✓ No circular dependency found!
```

#### 5. 未使用コードの検出

**コマンド**: `bun run check:unused`

**ツール**: [ts-prune](https://github.com/nadeesha/ts-prune)

**効果**: デッドコードを可視化し、コードベースを整理

**結果例**:
```
src/container.ts:32 - resetContainer
src/config/settings.ts:321 - clearGitHubAppConfig
...
```

#### 6. 型カバレッジの測定

**コマンド**: `bun run check:types`

**ツール**: [type-coverage](https://github.com/plantain-00/type-coverage)

**設定**: 95%以上の型カバレッジを要求

**効果**: 型の恩恵を最大限に活用し、any型の乱用を防止

**結果例**:
```
(16522 / 16524) 99.98%
type-coverage success.
```

## 実行コマンド

### 個別実行

```bash
# Lint
bun run lint

# フォーマットチェック
bun run format:check

# 型チェック
bunx tsc --noEmit

# 循環依存チェック
bun run check:circular

# 未使用コードチェック
bun run check:unused

# 型カバレッジチェック
bun run check:types
```

### 一括実行

```bash
# 全チェックを実行
bun run check:all
```

## GitHub Actions CI

**ファイル**: [.github/workflows/ci.yml](../.github/workflows/ci.yml)

PRやmainへのプッシュ時に自動実行されるチェック:

1. ESLint（複雑度チェック含む）
2. Prettierフォーマットチェック
3. TypeScript型チェック
4. 循環依存チェック
5. 未使用コードチェック
6. 型カバレッジチェック
7. テスト実行
8. ビルド実行

## Claude Code Skills

生成AIによる高度なレビュー:

### `/review`
コード変更をレビューし、lint/test/型チェックを実行

### `/pr-check`
PR作成前のセルフチェック（lint/test/build）

### `/dora-validate`
DORA metrics計算ロジックの正当性検証

## チェック結果の解釈

### 警告（Warning）が出た場合

ESLintの複雑度チェックは**警告レベル**に設定されています。これは以下の理由によります:

1. **既存コードの互換性**: 既存の複雑な処理を一度に修正するのは困難
2. **段階的な改善**: 新規コードでは警告に従い、既存コードは徐々にリファクタリング
3. **文脈依存**: 複雑度は必ずしも悪ではなく、ドメインロジックの本質的な複雑さを反映する場合もある

### エラー（Error）が出た場合

型エラーや構文エラーは**エラーレベル**に設定されており、ビルド・コミット・CIが失敗します。

## ベストプラクティス

### 1. コミット前に確認

Pre-commitフックが自動的にチェックしますが、手動でも確認できます:

```bash
bunx tsc --noEmit      # 型エラーなし
bun run lint           # Lint警告なし
bun test               # テスト通過
bun run build          # ビルド成功
```

### 2. 複雑度警告への対応

複雑度警告が出た場合の対処法:

- **関数分割**: 50行を超える関数は小さな関数に分割（Extract Methodパターン）
- **早期リターン**: ネストを減らすために早期リターンパターンを活用
- **引数オブジェクト化**: 4つ以上の引数はオブジェクトにまとめる
- **複雑なロジックの抽出**: 複雑な条件式は別関数に抽出

#### Extract Methodパターンの実践例

詳細な実践例は [docs/REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md) を参照してください。

**代表的なリファクタリング実績**:
- 重複ロジックの抽出（PR #113: ページネーション結果構築）
- 責務の分離（PR #114: サマリー行データ構築）
- 結果オブジェクト構築の統一（PR #115: マイグレーション結果）

### 3. 未使用コード警告への対応

未使用コードが検出された場合:

- **本当に未使用か確認**: GASグローバル関数など、動的に参照される場合は無視
- **削除可能な場合は削除**: 不要なコードは保守コストを増やすため削除
- **将来使う予定の場合**: 明確な計画がない限り削除（必要になったら復元）

## トラブルシューティング

### Pre-commitフックが動作しない

```bash
# フックを再インストール
bunx husky
```

### 型カバレッジが95%未満

```bash
# 詳細を確認
bunx type-coverage --detail
```

### 循環依存が見つかった

```bash
# グラフィカル表示
bun run check:circular --image deps-graph.svg
```

## 今後の拡張案

### Phase 3: 長期的な保守性向上

以下の施策は今後の検討対象です:

- **コミットメッセージ規約** (commitlint): Conventional Commits形式の強制
- **ライセンスチェック** (license-checker): 依存パッケージのライセンス管理
- **セキュリティ監査** (bun pm audit): 定期的な脆弱性チェック

## 参考資料

- [TypeScript Compiler Options](https://www.typescriptlang.org/tsconfig)
- [ESLint Rules](https://eslint.org/docs/latest/rules/)
- [Husky Documentation](https://typicode.github.io/husky/)
- [Cyclomatic Complexity](https://en.wikipedia.org/wiki/Cyclomatic_complexity)
