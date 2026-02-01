# リファクタリングガイド

本ドキュメントは、DevSyncGASプロジェクトでの実践的なリファクタリング経験から得られた教訓とベストプラクティスをまとめたものです。

## 目次

- [関数の長さ制限対応](#関数の長さ制限対応)
- [Extract Method パターンの実践](#extract-method-パターンの実践)
- [段階的リファクタリングのアプローチ](#段階的リファクタリングのアプローチ)
- [品質保証の実践](#品質保証の実践)

---

## 関数の長さ制限対応

### 背景

ESLintの `max-lines-per-function` ルール（上限50行）に違反する関数が20件検出されました。これらを段階的に解消するプロセスで得られた知見を記録します。

### 実践結果

**実績:**
- 対応PR数: 9件（#107〜#115）
- 解消した警告: 20件 → 0件
- テスト通過率: 100%（全199テスト）
- 期間: 1日

### 関数分割の判断基準

関数を分割すべきかどうかの判断基準：

#### 分割すべきケース

1. **重複ロジックの存在**
   - 同じコードが2回以上出現している
   - 類似パターンが複数箇所にある

   例: [PR #113](https://github.com/ip-san/dev-sync-gas/pull/113) - ページネーション結果構築ロジック
   ```typescript
   // Before: paginateAPI と paginateAndReduce で重複
   // After: buildPaginationResponse, buildReduceResponse に抽出
   ```

2. **明確な責務の分離**
   - 関数内で異なる責務が混在している
   - 「〜して、その後〜する」という2段階処理

   例: [PR #115](https://github.com/ip-san/dev-sync-gas/pull/115) - マイグレーション結果構築
   ```typescript
   // Before: updateSheetHeadersOnly内で4パターンの結果オブジェクト構築
   // After: 各パターンを専用のbuilder関数に抽出
   ```

3. **条件分岐ごとの処理が長い**
   - if/else の各ブロックが10行以上
   - switch の各caseが複雑

   例: [PR #107](https://github.com/ip-san/dev-sync-gas/pull/107) - バッチ処理の条件分岐

4. **データ変換のステップが複数**
   - 入力 → 中間形式 → 最終形式 のような多段変換

   例: [PR #114](https://github.com/ip-san/dev-sync-gas/pull/114) - 集計データから行データへの変換

#### 分割すべきでないケース

1. **単純な連続処理**
   - ステップが明確で、各ステップが3-5行程度
   - 処理フローが直線的

2. **密結合な処理**
   - 多数のローカル変数を共有
   - 分割すると引数が5個以上必要になる場合

3. **一度しか呼ばれないロジック**
   - 分割しても再利用性がない
   - 読みやすさが向上しない

---

## Extract Method パターンの実践

### 基本方針

関数を抽出する際の命名と設計の原則：

#### 1. 命名規則

**動詞 + 目的語 の形式**
```typescript
// ✅ Good
function buildPaginationResponse(...) { }
function calculateRepositorySummary(...) { }
function formatSummarySheet(...) { }

// ❌ Bad
function pagination(...) { }  // 動詞がない
function data(...) { }        // 不明瞭
function process(...) { }     // 抽象的すぎる
```

**具体性のレベル**
- Helper関数: 汎用的な名前（build, format, validate）
- Domain関数: ドメイン用語を含む（Repository, Metrics, Review）

#### 2. 関数シグネチャ設計

**パラメータの順序**
```typescript
// ✅ Good: 主要データ → 設定 → 依存性
function processBatchData(
  batch: GitHubPullRequest[],    // 主要データ
  owner: string,                  // 設定
  repo: string,                   // 設定
  token: string,                  // 設定
  logger: { log: (msg: string) => void }  // 依存性
): PRData[] { }

// ❌ Bad: 順序が不統一
function processBatchData(
  logger: any,
  batch: GitHubPullRequest[],
  token: string,
  owner: string,
  repo: string
) { }
```

**型の明示性**
```typescript
// ✅ Good: 明示的な型定義
function buildSummaryRows(
  aggregated: ReturnType<typeof aggregateMultiRepoMetrics>,
  totalMetricsCount: number
): (string | number)[][] { }

// ❌ Bad: any型の使用
function buildSummaryRows(aggregated: any, total: any): any { }
```

#### 3. 関数の配置

**抽出した関数の配置ルール**
```typescript
// ファイル内の順序:
// 1. Import文
// 2. 型定義
// 3. 定数定義
// 4. Helper関数（private相当）
// 5. Public API関数
// 6. Export文

// ✅ Good: Helper関数をPublic関数の前に配置
function buildPaginationResponse<R>(...) { }  // Helper
function buildReduceResponse<A>(...) { }      // Helper

export function paginateAPI<T, R>(...) { }    // Public API
export function paginateAndReduce<T, R, A>(...) { }  // Public API
```

#### 4. JSDocコメント

抽出した関数にも適切なドキュメントを付与：

```typescript
/**
 * ページネーション結果のレスポンスを構築
 *
 * 部分失敗時は警告付きで成功レスポンスを返す。
 */
function buildPaginationResponse<R>(
  results: R[],
  pagesRetrieved: number,
  pagesFailed: number,
  partialFailureError: string | undefined
): ApiResponse<R[]> {
  // ...
}
```

---

## 段階的リファクタリングのアプローチ

### 実践した手法

#### 1. 警告数の可視化

```bash
# 初回実行
$ bun run lint | grep "max-lines-per-function"
# 20 problems (20 errors, 0 warnings)

# PR作成後
$ bun run lint | grep "max-lines-per-function"
# 17 problems (17 errors, 0 warnings)
# → 3件解消を確認
```

**学び:** 数値で進捗を可視化することで、モチベーション維持と完遂の確実性が向上。

#### 2. 1PR = 1ファイル or 密接な関連ファイル群

**基本ルール:**
- 1つのPRで扱う範囲は1ファイル、または密接に関連する2-3ファイル
- 1PRで解消する警告数は2-4件程度
- レビューが容易な粒度を維持

**実例:**
- [PR #107](https://github.com/ip-san/dev-sync-gas/pull/107): 1ファイル、3警告解消
- [PR #108](https://github.com/ip-san/dev-sync-gas/pull/108): 1ファイル、3警告解消
- [PR #113](https://github.com/ip-san/dev-sync-gas/pull/113): 1ファイル、2警告解消

**例外:**
- 最終PR（#115）は1警告のみだが、複雑度が高いため単独で実施

#### 3. コミット前の品質確認

```bash
# 各PR作成前に実行
bun run lint           # Lint通過確認
bun test               # テスト通過確認（199 tests）
bunx tsc --noEmit      # 型チェック通過確認
bun run build          # ビルド成功確認
```

**学び:** これらのチェックを自動化（GitHub Actions等）することで、品質を保証しながら高速に進められる。

#### 4. マージ後の即座な最新化

各PR作成前に必ず実施：
```bash
git checkout main
git pull origin main
git checkout -b refactor/target-feature
```

**学び:** コンフリクトを防ぎ、常に最新の状態で作業することで、手戻りを最小化。

---

## 品質保証の実践

### テスト駆動リファクタリング

#### 原則

1. **既存テストを壊さない**
   - 全199テストが全PR通過
   - 関数シグネチャの変更時は、呼び出し側も同時に修正

2. **リファクタリング時はテスト追加不要**
   - 振る舞いを変えないため、既存テストで十分
   - 新機能追加とリファクタリングは分離

3. **型安全性の維持**
   - `bunx tsc --noEmit` で型エラーゼロを維持
   - any型の使用を避ける

#### 実際に遭遇した型エラーと対処

**ケース1: バージョンパラメータの型不一致**

```typescript
// ❌ Error: Type 'number' is not assignable to type 'string'
function createSheetNotFoundResult(
  sheetName: string,
  version: number,  // ← MigrationResult.toVersion は string型
  duration: number
): MigrationResult { }

// ✅ Fix: 型定義を確認して修正
function createSheetNotFoundResult(
  sheetName: string,
  version: string,
  duration: number
): MigrationResult { }
```

**学び:** Helper関数作成時は、戻り値の型定義を確認してパラメータ型を決定する。

### Lintルールの遵守

#### 対応したルール

```json
{
  "max-lines-per-function": ["error", 50],
  "complexity": ["warn", 10],
  "max-params": ["warn", 4]
}
```

**実績:**
- `max-lines-per-function`: 20 → 0 ✅
- `complexity`: 警告なし
- `max-params`: 2件の警告は残存（許容範囲）

#### max-params 警告の判断

```typescript
// ⚠️ Warning: processBatchReviewData has 5 parameters
function processBatchReviewData(params: ProcessBatchReviewDataParams): PRReviewData[]
```

**判断:** オブジェクト引数パターンに変更済み（interfaceで型定義）のため、実質1パラメータとして許容。

---

## まとめ

### 成功要因

1. **段階的アプローチ**: 1日で9PR、20警告解消を達成
2. **品質保証の自動化**: Lint/Test/TypeCheckの徹底
3. **明確な命名規則**: 抽出関数の役割が一目瞭然
4. **テスト維持**: 全199テスト通過を維持

### 今後のリファクタリングで活用すべき原則

1. **DRY（Don't Repeat Yourself）**: 重複コードを見つけたら即座に抽出
2. **Single Responsibility**: 各関数は1つの責務のみ持つ
3. **型安全性**: TypeScriptの型システムを最大限活用
4. **可読性優先**: 短くするだけでなく、意図が明確になるように命名

---

## 参考資料

- [docs/CODE_QUALITY.md](./CODE_QUALITY.md) - コード品質ガイドライン
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) - アーキテクチャ設計
- Martin Fowler『リファクタリング』- Extract Method パターン
- Clean Code by Robert C. Martin - 関数設計の原則
