/**
 * 初期設定用テンプレート
 *
 * 使い方:
 * 1. このファイルを src/init.ts にコピー
 * 2. 値を自分の環境に合わせて編集
 * 3. bun run push でデプロイ
 * 4. GASエディタで initConfig を実行
 */

declare const global: any;

function initConfig(): void {
  // ===== ここを編集 =====
  const GITHUB_TOKEN = "your_github_token_here";
  const SPREADSHEET_ID = "your_spreadsheet_id_here";

  // リポジトリ設定
  const REPOSITORIES = [
    { owner: "owner1", name: "repo1" },
    // { owner: "owner2", name: "repo2" },
  ];
  // ======================

  // 設定を保存
  setup(GITHUB_TOKEN, SPREADSHEET_ID);

  // リポジトリを追加
  for (const repo of REPOSITORIES) {
    addRepo(repo.owner, repo.name);
  }

  Logger.log("✅ 初期設定完了");
}

global.initConfig = initConfig;
