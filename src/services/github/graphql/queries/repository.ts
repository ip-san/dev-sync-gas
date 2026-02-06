/**
 * GitHub GraphQL クエリ - Repository関連
 *
 * リポジトリ情報の取得に関するクエリ。
 * ワークフロー実行履歴は直接取得できないため、
 * リポジトリの基本情報のみ取得可能。
 */

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
