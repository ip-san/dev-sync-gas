/**
 * GitHub GraphQL クエリ - Pull Request関連
 *
 * Pull Requestの取得に関するクエリ群。
 * 一覧取得、詳細取得（レビュー/コミット/タイムライン含む）、
 * 複数PRの一括取得をサポート。
 */

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
          labels(first: 20) {
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
