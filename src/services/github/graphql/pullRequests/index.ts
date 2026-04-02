/**
 * GitHub GraphQL API - Pull Request 操作
 *
 * REST APIからの移行:
 * - getPullRequests: 100件取得に1リクエスト → 同じ（ただしサイズ情報も含む）
 * - getPRDetails: 各PRに1リクエスト → バッチ取得で大幅削減
 * - getReworkDataForPRs: PR数×3リクエスト → バッチ取得で削減
 * - getReviewEfficiencyDataForPRs: PR数×3リクエスト → バッチ取得で削減
 *
 * @module services/github/graphql/pullRequests
 */

export { getReviewEfficiencyDataForPRsGraphQL } from './batchReview';
// Batch operations
export { getReworkDataForPRsGraphQL } from './batchRework';
export { getPRSizeDataForPRsGraphQL } from './batchSize';
// PR detail operations
export { getPRDetailsGraphQL, getPullRequestWithBranchesGraphQL } from './details';
// PR listing operations
export { getPullRequestsGraphQL } from './listing';
// PR Cycle Time operations
export { getPRCycleTimeDataGraphQL } from './prCycleTime';
// Type exports
export type { GetPullRequestsGraphQLParams } from './types';
