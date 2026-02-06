/**
 * GitHub GraphQL API - IssueリンクPR取得
 *
 * IssueにリンクされたPR情報の抽出
 */

import type { ApiResponse } from '../../../../types';
import { executeGraphQLWithRetry } from '../client';
import { ISSUE_WITH_LINKED_PRS_QUERY } from '../queries/issues.js';
import type { IssueWithLinkedPRsQueryResponse, CrossReferencedEvent } from '../types';
import { validateSingleResponse } from '../errorHelpers';

/**
 * タイムラインイベントから有効なPRを抽出するかチェック
 */
function isValidLinkedPR(
  source: CrossReferencedEvent['source'],
  owner: string,
  repo: string,
  existingPRNumbers: Set<number>
): boolean {
  if (!source?.number) {
    return false;
  }

  // 同じリポジトリのPRのみ
  const sourceRepo = source.repository?.nameWithOwner;
  if (sourceRepo && sourceRepo !== `${owner}/${repo}`) {
    return false;
  }

  // 重複チェック
  if (existingPRNumbers.has(source.number)) {
    return false;
  }

  return true;
}

/**
 * タイムラインイベントからPR情報を抽出
 */
function extractPRInfo(source: NonNullable<CrossReferencedEvent['source']>): {
  number: number;
  createdAt: string;
  mergedAt: string | null;
  baseRefName: string;
  headRefName: string;
  mergeCommitSha: string | null;
} {
  return {
    number: source.number!,
    createdAt: source.createdAt ?? '',
    mergedAt: source.mergedAt ?? null,
    baseRefName: source.baseRefName ?? '',
    headRefName: source.headRefName ?? '',
    mergeCommitSha: source.mergeCommit?.oid ?? null,
  };
}

/**
 * IssueにリンクされたPR番号を取得（GraphQL版）
 *
 * REST APIのTimeline APIと比較して、
 * PR情報（createdAt, mergedAt, branches）も同時取得。
 */
export function getLinkedPRsForIssueGraphQL(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string
): ApiResponse<
  {
    number: number;
    createdAt: string;
    mergedAt: string | null;
    baseRefName: string;
    headRefName: string;
    mergeCommitSha: string | null;
  }[]
> {
  const result = executeGraphQLWithRetry<IssueWithLinkedPRsQueryResponse>(
    ISSUE_WITH_LINKED_PRS_QUERY,
    {
      owner,
      name: repo,
      number: issueNumber,
    },
    token
  );

  const validationError = validateSingleResponse(result, 'repository.issue');
  if (validationError) {
    return validationError;
  }

  const timeline = result.data!.repository!.issue!.timelineItems.nodes;
  const linkedPRs: {
    number: number;
    createdAt: string;
    mergedAt: string | null;
    baseRefName: string;
    headRefName: string;
    mergeCommitSha: string | null;
  }[] = [];
  const prNumbers = new Set<number>();

  for (const event of timeline) {
    const source = event.source;
    if (isValidLinkedPR(source, owner, repo, prNumbers) && source) {
      const prInfo = extractPRInfo(source);
      linkedPRs.push(prInfo);
      prNumbers.add(prInfo.number);
    }
  }

  return { success: true, data: linkedPRs };
}
