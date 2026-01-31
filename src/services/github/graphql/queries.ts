/**
 * GitHub GraphQL クエリ定義
 *
 * DORA metrics取得に必要なデータを効率的に取得するクエリ群。
 * REST APIでは複数リクエストが必要なデータを1リクエストで取得可能。
 */

// =============================================================================
// Pull Request クエリ
// =============================================================================

/**
 * Pull Request一覧取得クエリ
 *
 * 取得データ:
 * - 基本情報（number, title, state, createdAt, mergedAt, closedAt）
 * - 作成者情報
 * - ブランチ情報（base, head）
 * - サイズ情報（additions, deletions, changedFiles）
 * - マージコミットSHA
 *
 * コスト: 約 1 + nodes数
 */
export const PULL_REQUESTS_QUERY = `
  query GetPullRequests(
    $owner: String!
    $name: String!
    $first: Int!
    $after: String
    $states: [PullRequestState!]
  ) {
    repository(owner: $owner, name: $name) {
      pullRequests(
        first: $first
        after: $after
        states: $states
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
          mergeCommit {
            oid
          }
          additions
          deletions
          changedFiles
        }
      }
    }
  }
`;

/**
 * PR詳細クエリ（レビュー情報、コミット、タイムライン含む）
 *
 * 取得データ:
 * - 基本情報
 * - レビュー一覧（状態、提出日時、レビュアー）
 * - コミット一覧（SHA、日時）
 * - タイムラインイベント（ready_for_review, force_pushed）
 *
 * コスト: 約 1 + reviews数 + commits数 + timeline数
 */
export const PULL_REQUEST_DETAIL_QUERY = `
  query GetPullRequestDetail(
    $owner: String!
    $name: String!
    $number: Int!
    $reviewsFirst: Int = 50
    $commitsFirst: Int = 100
    $timelineFirst: Int = 100
  ) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
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
        mergeCommit {
          oid
        }
        additions
        deletions
        changedFiles

        reviews(first: $reviewsFirst) {
          nodes {
            state
            submittedAt
            author {
              login
            }
          }
        }

        commits(first: $commitsFirst) {
          nodes {
            commit {
              oid
              committedDate
              authoredDate
            }
          }
        }

        timelineItems(
          first: $timelineFirst
          itemTypes: [READY_FOR_REVIEW_EVENT, HEAD_REF_FORCE_PUSHED_EVENT]
        ) {
          nodes {
            __typename
            ... on ReadyForReviewEvent {
              createdAt
            }
            ... on HeadRefForcePushedEvent {
              createdAt
            }
          }
        }
      }
    }
  }
`;

/**
 * 複数PRの詳細を一括取得（手戻り率・レビュー効率用）
 *
 * 動的にクエリを生成して複数PRの情報を1リクエストで取得
 */
export function buildBatchPRDetailQuery(prNumbers: number[]): string {
  const fragments = prNumbers.map(
    (num, idx) => `
    pr${idx}: pullRequest(number: ${num}) {
      number
      title
      createdAt
      mergedAt

      reviews(first: 50) {
        nodes {
          state
          submittedAt
          author {
            login
          }
        }
      }

      commits(first: 100) {
        nodes {
          commit {
            oid
            committedDate
          }
        }
      }

      timelineItems(
        first: 50
        itemTypes: [READY_FOR_REVIEW_EVENT, HEAD_REF_FORCE_PUSHED_EVENT]
      ) {
        nodes {
          __typename
          ... on ReadyForReviewEvent {
            createdAt
          }
          ... on HeadRefForcePushedEvent {
            createdAt
          }
        }
      }
    }
  `
  );

  return `
    query GetBatchPRDetails($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        ${fragments.join('\n')}
      }
    }
  `;
}

// =============================================================================
// Deployment クエリ
// =============================================================================

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

// =============================================================================
// Issue クエリ
// =============================================================================

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

// =============================================================================
// Workflow Run クエリ
// =============================================================================

/**
 * ワークフロー実行履歴クエリ
 *
 * 注意: GitHub GraphQL APIではワークフロー実行の直接取得はサポートされていない。
 * REST APIを使用するか、デプロイメントで代用する必要がある。
 *
 * 代替として、リポジトリのワークフロー情報のみ取得可能。
 */
export const REPOSITORY_WORKFLOWS_QUERY = `
  query GetRepositoryInfo(
    $owner: String!
    $name: String!
  ) {
    repository(owner: $owner, name: $name) {
      id
      name
      owner {
        login
      }
      defaultBranchRef {
        name
      }
    }
  }
`;

// =============================================================================
// 複合クエリ（一括取得用）
// =============================================================================

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

// =============================================================================
// コミットからPR検索クエリ
// =============================================================================

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
