/**
 * Internal type definitions for Pull Request operations
 */

import type { GitHubRepository, GitHubPullRequest } from '../../../../types';
import type { DateRange } from '../../api';

/**
 * Pull Requests取得のパラメータ
 */
export interface GetPullRequestsGraphQLParams {
  repo: GitHubRepository;
  token: string;
  state?: 'open' | 'closed' | 'all';
  dateRange?: DateRange;
  maxPages?: number;
}

/**
 * PR手戻りデータ処理のパラメータ
 */
export interface ProcessBatchReworkDataParams {
  batch: GitHubPullRequest[];
  owner: string;
  repo: string;
  token: string;
  logger: { log: (msg: string) => void; warn: (msg: string) => void };
}

/**
 * PRサイズデータ処理のパラメータ
 */
export interface ProcessBatchSizeDataParams {
  batch: GitHubPullRequest[];
  owner: string;
  repo: string;
  repoFullName: string;
  token: string;
  logger: { log: (msg: string) => void; warn: (msg: string) => void };
}

/**
 * PRレビューデータ処理のパラメータ
 */
export interface ProcessBatchReviewDataParams {
  batch: GitHubPullRequest[];
  owner: string;
  repo: string;
  repoFullName: string;
  token: string;
  logger: { log: (msg: string) => void; warn: (msg: string) => void };
}
