/**
 * GitHub GraphQL クエリ - Deployment関連
 *
 * デプロイメント情報の取得に関するクエリ。
 * REST APIでは各デプロイメントのステータスを個別に取得する必要があったが、
 * GraphQLでは1リクエストで全て取得可能。
 */

/**
 * デプロイメント一覧取得クエリ
 *
 * REST APIでは各デプロイメントのステータスを個別に取得する必要があったが、
 * GraphQLでは1リクエストで全て取得可能。
 *
 * コスト: 約 1 + nodes数
 */
export const DEPLOYMENTS_QUERY = `
  query GetDeployments(
    $owner: String!
    $name: String!
    $first: Int!
    $after: String
    $environments: [String!]
  ) {
    repository(owner: $owner, name: $name) {
      deployments(
        first: $first
        after: $after
        environments: $environments
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
            createdAt
          }
        }
      }
    }
  }
`;
