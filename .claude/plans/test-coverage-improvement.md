# テストカバレッジ向上計画

## 概要

現在のカバレッジ（53.28%）を向上させ、特にGraphQL API統合テストとエッジケースのテストを追加する。

## 現状分析

### カバレッジ統計（2026-02-01）
- **総カバレッジ**: 関数 53.28%、行 52.78%
- **既存テスト数**: 244テスト

### 低カバレッジファイル（優先度順）

#### 最優先（Phase 1）: GraphQL API関連
1. **`src/services/github/graphql/pullRequests.ts`** - 26.23%
   - バッチ処理のエッジケース未テスト
   - エラーハンドリング未テスト
   - ラベル除外フィルタリング未テスト

2. **`src/services/github/graphql/issues.ts`** - 20.39%
   - Issue取得の統合テスト不足
   - リンクされたPR検出未テスト

3. **`src/services/github/graphql/errorHelpers.ts`** - 52.17%
   - エラーサニタイズ未テスト
   - GraphQLエラー変換未テスト

4. **`src/services/github/graphql/reviewEfficiencyHelpers.ts`** - 1.41%
   - レビュー効率計算ロジック未テスト
   - 時間計算エッジケース未テスト

5. **`src/services/github/graphql/reworkHelpers.ts`** - 6.00%
   - Force Push検出未テスト
   - 追加コミット計算未テスト

#### 高優先度（Phase 2）: Spreadsheet書き込み系
6. **`src/services/spreadsheet/reviewEfficiency.ts`** - 20.65%
7. **`src/services/spreadsheet/prSize.ts`** - 18.37%
8. **`src/services/spreadsheet/reworkRate.ts`** - 17.15%
9. **`src/services/spreadsheet/codingTime.ts`** - 17.21%
10. **`src/services/spreadsheet/cycleTime.ts`** - 17.13%

#### 中優先度（Phase 3）: Dashboard・集計系
11. **`src/services/spreadsheet/dashboard.ts`** - 4.93%
12. **`src/services/spreadsheet/metricsSummary.ts`** - 8.52%

## Phase 1: GraphQL API統合テスト（最優先）

### 1. `tests/integration/graphql-pullRequests.test.ts`（新規）

```typescript
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { LoggerClient, GraphQLClient } from '../../src/interfaces';
import {
  fetchAllPRsGraphQL,
  processBatchReworkData,
  processBatchSizeData,
  processBatchReviewData,
} from '../../src/services/github/graphql/pullRequests';

describe('GraphQL Pull Requests Integration', () => {
  describe('fetchAllPRsGraphQL', () => {
    it('should handle empty repository', async () => {
      // リポジトリにPRが0件の場合
    });

    it('should handle pagination correctly', async () => {
      // 100件以上のPR取得（ページネーション）
    });

    it('should filter PRs by exclude labels', async () => {
      // exclude-metricsラベルのPRを除外
    });

    it('should handle GraphQL rate limit error', async () => {
      // レート制限エラーの処理
    });

    it('should handle partial failures in batch processing', async () => {
      // 一部のPRデータ取得失敗時の処理
    });
  });

  describe('processBatchReworkData', () => {
    it('should detect force pushes correctly', () => {
      // Force Push検出ロジック
    });

    it('should calculate additional commits after PR creation', () => {
      // PR作成後の追加コミット数計算
    });

    it('should handle PRs with no commits', () => {
      // コミット0件のPR（エッジケース）
    });
  });

  describe('processBatchSizeData', () => {
    it('should handle PRs with 0 additions and deletions', () => {
      // 変更なしPR（エッジケース）
    });

    it('should handle very large PRs (>10000 lines)', () => {
      // 巨大PR（1万行以上）
    });

    it('should warn on failed size data fetch', () => {
      // サイズデータ取得失敗時の警告
    });
  });

  describe('processBatchReviewData', () => {
    it('should handle PRs with no reviews', () => {
      // レビューなしPR
    });

    it('should find first review correctly', () => {
      // 初回レビュー検出
    });

    it('should find approval correctly', () => {
      // 承認検出
    });

    it('should handle multiple reviews from same author', () => {
      // 同一レビュアーの複数レビュー
    });
  });
});
```

### 2. `tests/unit/graphql-helpers.test.ts`（新規）

```typescript
import { describe, it, expect } from 'bun:test';
import {
  calculateReviewEfficiency,
  findFirstReview,
  findApproval,
} from '../../src/services/github/graphql/reviewEfficiencyHelpers';
import {
  detectForcePushes,
  countAdditionalCommits,
} from '../../src/services/github/graphql/reworkHelpers';
import { calculatePRSize } from '../../src/services/github/graphql/prSizeHelpers';

describe('GraphQL Helper Functions', () => {
  describe('Review Efficiency Helpers', () => {
    it('should calculate time to first review', () => {
      const readyAt = '2024-01-01T10:00:00Z';
      const firstReviewAt = '2024-01-01T12:00:00Z';
      // expect: 2時間
    });

    it('should return null when no first review', () => {
      // レビューなしの場合
    });

    it('should calculate review duration', () => {
      const firstReviewAt = '2024-01-01T10:00:00Z';
      const approvedAt = '2024-01-01T14:00:00Z';
      // expect: 4時間
    });

    it('should calculate time to merge', () => {
      const approvedAt = '2024-01-01T10:00:00Z';
      const mergedAt = '2024-01-01T10:30:00Z';
      // expect: 0.5時間
    });

    it('should handle timezone differences correctly', () => {
      // UTCとJSTの混在
    });
  });

  describe('Rework Helpers', () => {
    it('should detect force pushes from refUpdateEvents', () => {
      const events = [
        { forced: true, createdAt: '2024-01-01T10:00:00Z' },
        { forced: false, createdAt: '2024-01-01T11:00:00Z' },
        { forced: true, createdAt: '2024-01-01T12:00:00Z' },
      ];
      expect(detectForcePushes(events)).toBe(2);
    });

    it('should count additional commits after PR creation', () => {
      const prCreatedAt = '2024-01-01T10:00:00Z';
      const commits = [
        { committedDate: '2024-01-01T09:00:00Z' }, // Before PR
        { committedDate: '2024-01-01T10:30:00Z' }, // After PR
        { committedDate: '2024-01-01T11:00:00Z' }, // After PR
      ];
      expect(countAdditionalCommits(commits, prCreatedAt)).toBe(2);
    });

    it('should handle empty commit list', () => {
      expect(countAdditionalCommits([], '2024-01-01T10:00:00Z')).toBe(0);
    });
  });

  describe('PR Size Helpers', () => {
    it('should calculate total lines changed', () => {
      expect(calculatePRSize({ additions: 100, deletions: 50 })).toBe(150);
    });

    it('should handle zero changes', () => {
      expect(calculatePRSize({ additions: 0, deletions: 0 })).toBe(0);
    });
  });
});
```

### 3. `tests/unit/graphql-errors.test.ts`（新規）

```typescript
import { describe, it, expect } from 'bun:test';
import {
  sanitizeGitHubError,
  isRateLimitError,
  extractRateLimitInfo,
} from '../../src/services/github/graphql/errorHelpers';

describe('GraphQL Error Handling', () => {
  describe('sanitizeGitHubError', () => {
    it('should remove sensitive tokens', () => {
      const error = 'Authentication failed: ghp_1234567890abcdef';
      expect(sanitizeGitHubError(error)).not.toContain('ghp_');
    });

    it('should handle GraphQL error format', () => {
      const graphqlError = {
        message: 'Field error',
        type: 'INVALID_QUERY',
      };
      // エラーメッセージの変換
    });
  });

  describe('isRateLimitError', () => {
    it('should detect primary rate limit', () => {
      const error = { type: 'RATE_LIMITED' };
      expect(isRateLimitError(error)).toBe(true);
    });

    it('should detect secondary rate limit', () => {
      const error = { message: 'secondary rate limit' };
      expect(isRateLimitError(error)).toBe(true);
    });
  });

  describe('extractRateLimitInfo', () => {
    it('should extract reset time from error', () => {
      const error = {
        message: 'rate limit exceeded',
        extensions: { cost: 1000, resetAt: '2024-01-01T10:00:00Z' },
      };
      // resetAtの抽出
    });
  });
});
```

## Phase 2: Spreadsheet書き込み系テスト

### 4. `tests/unit/spreadsheet-write.test.ts`（新規）

```typescript
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import {
  writeReviewEfficiencyToSheet,
  writeReviewEfficiencyToRepositorySheet,
} from '../../src/services/spreadsheet/reviewEfficiency';
import {
  writePRSizeToSheet,
  writePRSizeToRepositorySheet,
} from '../../src/services/spreadsheet/prSize';
import {
  writeReworkRateToSheet,
  writeReworkRateToRepositorySheet,
} from '../../src/services/spreadsheet/reworkRate';

describe('Spreadsheet Write Operations', () => {
  describe('writeReviewEfficiencyToRepositorySheet', () => {
    it('should write new records successfully', () => {
      // 新規レコード書き込み
    });

    it('should skip duplicate PRs when skipDuplicates=true', () => {
      // 重複スキップ
    });

    it('should overwrite when skipDuplicates=false', () => {
      // 重複上書き
    });

    it('should handle empty details array', () => {
      // 空配列の場合
    });

    it('should throw SpreadsheetError on write failure', () => {
      // 書き込み失敗時のエラー
    });
  });

  describe('writePRSizeToRepositorySheet', () => {
    it('should format integer columns correctly', () => {
      // 整数列のフォーマット
    });

    it('should handle very large numbers (>1M lines)', () => {
      // 巨大数値の処理
    });
  });

  describe('writeReworkRateToRepositorySheet', () => {
    it('should write force push counts correctly', () => {
      // Force Push回数の書き込み
    });

    it('should handle PRs with 0 additional commits', () => {
      // 追加コミット0件のPR
    });
  });
});
```

## Phase 3: Dashboard・集計系テスト

### 5. `tests/unit/dashboard.test.ts`（新規）

```typescript
import { describe, it, expect } from 'bun:test';
import {
  aggregateRepositoryMetrics,
  calculateWeeklyTrends,
} from '../../src/services/spreadsheet/dashboard';

describe('Dashboard Aggregation', () => {
  describe('aggregateRepositoryMetrics', () => {
    it('should aggregate metrics from multiple repositories', () => {
      // 複数リポジトリの集計
    });

    it('should handle repositories with missing metrics', () => {
      // メトリクスが一部欠けている場合
    });

    it('should calculate cross-repository averages', () => {
      // 全体平均の計算
    });
  });

  describe('calculateWeeklyTrends', () => {
    it('should group metrics by week', () => {
      // 週次グルーピング
    });

    it('should handle weeks with no data', () => {
      // データなし週の処理
    });
  });
});
```

## エッジケースリスト

### GraphQL API関連
- [ ] 空リポジトリ（PR 0件）
- [ ] 巨大リポジトリ（PR 1000件以上、ページネーション）
- [ ] レート制限エラー
- [ ] ネットワークタイムアウト
- [ ] 不正なトークン
- [ ] Force Pushのみ（通常コミットなし）
- [ ] レビューなしPR
- [ ] 承認なしPR
- [ ] マージなしPR
- [ ] 変更0行のPR
- [ ] 変更10000行以上のPR
- [ ] コミット0件のPR
- [ ] 同一レビュアーの複数レビュー
- [ ] タイムゾーン混在（UTC/JST/PST）
- [ ] 除外ラベル複数付与
- [ ] インシデントラベル複数付与

### Spreadsheet関連
- [ ] 空のメトリクスデータ
- [ ] 重複PR書き込み（skipDuplicates=true/false）
- [ ] シート作成失敗
- [ ] スプレッドシートアクセス拒否
- [ ] 非常に長いPRタイトル（100文字以上）
- [ ] 特殊文字含むリポジトリ名
- [ ] 数値フォーマットエラー
- [ ] NULL値/undefined混在

### 時間計算関連
- [ ] 負の時間差（時計のずれ）
- [ ] 極端に長い時間（1年以上）
- [ ] 0時間（同時刻）
- [ ] ミリ秒単位の精度

## 目標カバレッジ

| カテゴリ | 現在 | Phase 1後 | Phase 2後 | Phase 3後（最終） |
|---------|------|-----------|-----------|------------------|
| GraphQL API | 26-52% | 75%+ | 75%+ | 80%+ |
| Spreadsheet | 17-20% | 20% | 70%+ | 75%+ |
| Dashboard | 4-8% | 4-8% | 8% | 60%+ |
| **全体** | **53%** | **62%** | **70%** | **75%** |

## 実装順序

### Step 1: GraphQL Helpersテスト（最小範囲）
- `tests/unit/graphql-helpers.test.ts` 作成
- reviewEfficiencyHelpers, reworkHelpers, prSizeHelpers のテスト
- 影響範囲: 小（ヘルパー関数のみ）

### Step 2: GraphQL エラーハンドリングテスト
- `tests/unit/graphql-errors.test.ts` 作成
- errorHelpers のテスト
- 影響範囲: 小

### Step 3: GraphQL 統合テスト
- `tests/integration/graphql-pullRequests.test.ts` 作成
- バッチ処理、ページネーション、エラー処理のテスト
- 影響範囲: 中（モック準備が必要）

### Step 4: Spreadsheet書き込みテスト
- `tests/unit/spreadsheet-write.test.ts` 作成
- reviewEfficiency, prSize, reworkRate のテスト
- 影響範囲: 中

### Step 5: Dashboardテスト
- `tests/unit/dashboard.test.ts` 作成
- 集計ロジックのテスト
- 影響範囲: 中

## 検証方法

### 1. カバレッジ確認
```bash
bun test --coverage
```

### 2. テスト実行
```bash
bun test                    # 全テスト
bun test tests/unit/        # ユニットテストのみ
bun test tests/integration/ # 統合テストのみ
```

### 3. 型チェック
```bash
bunx tsc --noEmit
```

### 4. Lint
```bash
bun run lint
```

## リスクと緩和策

| リスク | 影響 | 緩和策 |
|--------|------|--------|
| モック準備の複雑化 | 中 | 既存のテストヘルパーを活用 |
| テスト実行時間増加 | 低 | 統合テストは別ディレクトリに分離 |
| テストメンテナンスコスト | 中 | DRY原則でヘルパー関数共通化 |
| 既存テストの破壊 | 低 | 既存244テストを維持 |

## 完了条件

- [ ] Phase 1-3 完了
- [ ] 全テスト成功（244 → 300+）
- [ ] 総カバレッジ 75%以上
- [ ] GraphQL API カバレッジ 80%以上
- [ ] Spreadsheet カバレッジ 75%以上
- [ ] 型チェック成功
- [ ] Lint成功
- [ ] ビルド成功

## Next Steps

1. Phase 1から順次実装
2. 各Phase完了ごとにカバレッジ確認
3. PR作成・マージ
4. 最終的に300+テスト、75%カバレッジを達成
