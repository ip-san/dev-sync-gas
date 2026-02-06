/**
 * GitHub GraphQL クエリ - Commit関連
 *
 * コミット情報からPRを検索するクエリ。
 * コミットSHAから関連するPull Requestを取得する。
 */

/**
 * コミットSHAからPRを検索
 */
export const COMMIT_ASSOCIATED_PRS_QUERY = `
  query GetCommitAssociatedPRs(
    $owner: String!
    $name: String!
    $oid: GitObjectID!
  ) {
    repository(owner: $owner, name: $name) {
      object(oid: $oid) {
        ... on Commit {
          associatedPullRequests(first: 10) {
            nodes {
              number
              title
              state
              createdAt
              mergedAt
              closedAt
              baseRefName
              headRefName
              mergeCommit {
                oid
              }
              author {
                login
              }
            }
          }
        }
      }
    }
  }
`;
