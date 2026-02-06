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

// Type exports
export type { GetPullRequestsGraphQLParams } from './types';

// PR listing operations
export { getPullRequestsGraphQL } from './listing';

// PR detail operations
export { getPRDetailsGraphQL, getPullRequestWithBranchesGraphQL } from './details';

// Batch operations
export { getReworkDataForPRsGraphQL } from './batchRework';
export { getPRSizeDataForPRsGraphQL } from './batchSize';
export { getReviewEfficiencyDataForPRsGraphQL } from './batchReview';
