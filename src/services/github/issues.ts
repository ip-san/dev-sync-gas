/**
 * GitHub Issues 関連モジュール
 *
 * Issue取得、インシデント取得（MTTRサポート）、
 * Issue↔PR リンク取得などを提供。
 */

import type {
  GitHubIncident,
  GitHubRepository,
  ApiResponse,
  GitHubIssue,
  GitHubIssueResponse,
  GitHubTimelineEventResponse,
  GitHubTimelineCrossReferenceEvent,
} from '../../types';
import { getContainer } from '../../container';
import {
  fetchGitHub,
  DEFAULT_MAX_PAGES,
  PER_PAGE,
  type DateRange,
  type IssueDateRange,
} from './api';

// =============================================================================
// 型定義
// =============================================================================

/** インシデント取得オプション */
interface GetIncidentsOptions {
  /** インシデントとして認識するラベル（デフォルト: ["incident"]） */
  labels?: string[];
  dateRange?: DateRange;
  maxPages?: number;
}

// =============================================================================
// インシデント取得（MTTR計測用）
// =============================================================================

/**
 * リポジトリのインシデント（ラベル付きIssue）を取得
 * MTTR計測に使用
 */
export function getIncidents(
  repo: GitHubRepository,
  token: string,
  options: GetIncidentsOptions = {}
): ApiResponse<GitHubIncident[]> {
  const { labels = ['incident'], dateRange, maxPages = DEFAULT_MAX_PAGES } = options;

  const allIncidents: GitHubIncident[] = [];
  let page = 1;
  const labelsParam = labels.join(',');

  while (page <= maxPages) {
    const endpoint = `/repos/${repo.fullName}/issues?labels=${encodeURIComponent(labelsParam)}&state=all&per_page=${PER_PAGE}&page=${page}&sort=created&direction=desc`;
    const response = fetchGitHub<GitHubIssueResponse[]>(endpoint, token);

    if (!response.success || !response.data) {
      if (page === 1) {
        return { success: false, error: response.error };
      }
      break;
    }

    if (response.data.length === 0) {
      break;
    }

    for (const issue of response.data) {
      // PRはスキップ（Issues APIはPRも返す場合がある）
      if (issue.pull_request) {
        continue;
      }

      const createdAt = new Date(issue.created_at);

      // 期間フィルタリング
      if (dateRange?.until && createdAt > dateRange.until) {
        continue;
      }
      if (dateRange?.since && createdAt < dateRange.since) {
        continue;
      }

      allIncidents.push({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        state: issue.state as 'open' | 'closed',
        createdAt: issue.created_at,
        closedAt: issue.closed_at,
        labels: issue.labels.map((l) => l.name),
        repository: repo.fullName,
      });
    }

    page++;
  }

  return { success: true, data: allIncidents };
}

// =============================================================================
// Issue取得（サイクルタイム計測用）
// =============================================================================

/**
 * リポジトリのIssueを取得（PRを除外）
 */
export function getIssues(
  repo: GitHubRepository,
  token: string,
  options?: {
    dateRange?: IssueDateRange;
    labels?: string[];
  }
): ApiResponse<GitHubIssue[]> {
  const { logger } = getContainer();
  const allIssues: GitHubIssue[] = [];
  let page = 1;
  const perPage = 100;

  // クエリパラメータを構築
  const queryParams: string[] = ['state=all', `per_page=${perPage}`];

  if (options?.labels && options.labels.length > 0) {
    queryParams.push(`labels=${options.labels.join(',')}`);
  }

  if (options?.dateRange?.start) {
    queryParams.push(`since=${options.dateRange.start}`);
  }

  logger.log(`  📋 Fetching issues from ${repo.fullName}...`);

  let hasMorePages = true;
  while (hasMorePages) {
    const endpoint = `/repos/${repo.owner}/${repo.name}/issues?${queryParams.join('&')}&page=${page}`;
    const response = fetchGitHub<GitHubIssueResponse[]>(endpoint, token);

    if (!response.success || !response.data) {
      return { success: false, error: response.error };
    }

    if (response.data.length === 0) {
      hasMorePages = false;
      continue;
    }

    for (const item of response.data) {
      // PRはissuesエンドポイントにも含まれるので除外
      if (item.pull_request) {
        continue;
      }

      // 日付範囲チェック（endのみ、sinceはAPIで処理）
      const createdAt = new Date(item.created_at);
      const endDate = options?.dateRange?.end ? new Date(options.dateRange.end) : null;
      if (endDate && createdAt > endDate) {
        continue;
      }

      allIssues.push({
        id: item.id,
        number: item.number,
        title: item.title,
        state: item.state as 'open' | 'closed',
        createdAt: item.created_at,
        closedAt: item.closed_at,
        labels: item.labels.map((l) => l.name),
        repository: repo.fullName,
      });
    }

    if (response.data.length < perPage) {
      hasMorePages = false;
    } else {
      page++;
    }
  }

  logger.log(`  ✅ Found ${allIssues.length} issues`);
  return { success: true, data: allIssues };
}

// =============================================================================
// Issue↔PRリンク取得
// =============================================================================

/**
 * IssueにリンクされたPR番号を取得（Timeline APIを使用）
 */
export function getLinkedPRsForIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string
): ApiResponse<number[]> {
  const prNumbers: number[] = [];
  let page = 1;
  const perPage = 100;

  let hasMorePages = true;
  while (hasMorePages) {
    const endpoint = `/repos/${owner}/${repo}/issues/${issueNumber}/timeline?per_page=${perPage}&page=${page}`;
    const response = fetchGitHub<
      (GitHubTimelineEventResponse | GitHubTimelineCrossReferenceEvent)[]
    >(endpoint, token);

    if (!response.success || !response.data) {
      return { success: false, error: response.error };
    }

    if (response.data.length === 0) {
      hasMorePages = false;
      continue;
    }

    for (const event of response.data) {
      // cross-referencedイベント以外はスキップ
      if (event.event !== 'cross-referenced') {
        continue;
      }

      const crossRefEvent = event as GitHubTimelineCrossReferenceEvent;
      if (!crossRefEvent.source?.issue?.pull_request) {
        continue;
      }

      const prNumber = crossRefEvent.source.issue.number;
      // 同じリポジトリのPRのみ
      const sourceRepo = crossRefEvent.source.issue.repository?.full_name;
      if (sourceRepo === `${owner}/${repo}` && !prNumbers.includes(prNumber)) {
        prNumbers.push(prNumber);
      }
    }

    if (response.data.length < perPage) {
      hasMorePages = false;
    } else {
      page++;
    }
  }

  return { success: true, data: prNumbers };
}
