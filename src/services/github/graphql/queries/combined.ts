/**
 * GitHub GraphQL クエリ - 複合クエリ
 *
 * 複数のデータを一括取得するための複合クエリ。
 * PR、デプロイメント、Issueを1リクエストで取得することで、
 * REST APIでは最低3リクエスト必要だったものを1リクエストに削減。
 */

/**
 * リポジトリの全データを一括取得（DORA metrics計算用）
 *
 * PR、デプロイメント、Issueを1リクエストで取得。
 * REST APIでは最低3リクエスト必要だったものを1リクエストに削減。
 *
 * コスト: 約 3 + 各nodes数の合計
 */
export const REPOSITORY_METRICS_QUERY = `
  query GetRepositoryMetrics(
    $owner: String!
    $name: String!
    $prFirst: Int = 100
    $prAfter: String
    $deployFirst: Int = 100
    $deployAfter: String
    $deployEnvironments: [String!]
  ) {
    repository(owner: $owner, name: $name) {
      pullRequests(
        first: $prFirst
        after: $prAfter
        states: [MERGED, OPEN, CLOSED]
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          number
          title
          state
          createdAt
          mergedAt
          closedAt
          author {
            login
          }
          baseRefName
          headRefName
          additions
          deletions
          changedFiles
        }
      }

      deployments(
        first: $deployFirst
        after: $deployAfter
        environments: $deployEnvironments
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          environment
          createdAt
          updatedAt
          commit {
            oid
          }
          state
          latestStatus {
            state
          }
        }
      }
    }

    rateLimit {
      limit
      remaining
      resetAt
      cost
    }
  }
`;
