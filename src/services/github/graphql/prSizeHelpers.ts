/**
 * PRサイズデータ計算のヘルパー関数
 *
 * getPRSizeDataForPRsGraphQL の複雑度削減のため分離
 */

import type { PRSizeData } from '../../../types/index.js';

/**
 * GraphQL PRサイズレスポンスの型定義
 */
export interface GraphQLPRSizeData {
  number: number;
  title: string;
  createdAt: string;
  mergedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
}

/**
 * PR1件分のサイズデータを計算
 */
export function calculatePRSizeData(prData: GraphQLPRSizeData, repoFullName: string): PRSizeData {
  return {
    prNumber: prData.number,
    title: prData.title,
    repository: repoFullName,
    createdAt: prData.createdAt,
    mergedAt: prData.mergedAt,
    additions: prData.additions,
    deletions: prData.deletions,
    linesOfCode: prData.additions + prData.deletions,
    filesChanged: prData.changedFiles,
  };
}
