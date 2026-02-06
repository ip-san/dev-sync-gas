/**
 * GitHub GraphQL クエリ - Issue関連
 *
 * Issue情報の取得に関するクエリ群。
 * サイクルタイム・コーディングタイム計測用。
 * クロスリファレンスからリンクPRも取得可能。
 */

/**
 * Issue一覧取得クエリ
 *
 * サイクルタイム・コーディングタイム計測用。
 * クロスリファレンスからリンクPRも取得可能。
 *
 * コスト: 約 1 + nodes数 + timelineItems数
 */
export const ISSUES_QUERY = `
  query GetIssues(
    $owner: String!
    $name: String!
    $first: Int!
    $after: String
    $labels: [String!]
    $states: [IssueState!]
  ) {
    repository(owner: $owner, name: $name) {
      issues(
        first: $first
        after: $after
        labels: $labels
        states: $states
        orderBy: { field: CREATED_AT, direction: DESC }
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
          closedAt
          labels(first: 10) {
            nodes {
              name
            }
          }
        }
      }
    }
  }
`;

/**
 * Issue詳細クエリ（リンクPR含む）
 *
 * TimelineからクロスリファレンスされたPRを取得
 */
export const ISSUE_WITH_LINKED_PRS_QUERY = `
  query GetIssueWithLinkedPRs(
    $owner: String!
    $name: String!
    $number: Int!
    $timelineFirst: Int = 100
  ) {
    repository(owner: $owner, name: $name) {
      issue(number: $number) {
        id
        number
        title
        state
        createdAt
        closedAt
        labels(first: 10) {
          nodes {
            name
          }
        }
        timelineItems(first: $timelineFirst, itemTypes: [CROSS_REFERENCED_EVENT]) {
          nodes {
            ... on CrossReferencedEvent {
              source {
                ... on PullRequest {
                  number
                  createdAt
                  mergedAt
                  baseRefName
                  headRefName
                  mergeCommit {
                    oid
                  }
                  repository {
                    nameWithOwner
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;
