/**
 * 初期設定用テンプレート
 *
 * 使い方:
 * 1. このファイルを src/init.ts にコピー
 * 2. 値を自分の環境に合わせて編集
 * 3. bun run push でデプロイ
 * 4. GASエディタで initConfig を実行
 */

import { setConfig, addRepository } from './config/settings';
import { initializeContainer, isContainerInitialized } from './container';
import { createGasAdapters } from './adapters/gas';

/// <reference path="./types/gas-global.d.ts" />

function initConfig(): void {
  // コンテナ初期化
  if (!isContainerInitialized()) {
    initializeContainer(createGasAdapters());
  }
  // ===== ここを編集 =====
  const GITHUB_TOKEN = 'your_github_token_here';
  const SPREADSHEET_ID = 'your_spreadsheet_id_here';

  // リポジトリ設定
  const REPOSITORIES = [
    { owner: 'owner1', name: 'repo1' },
    // { owner: "owner2", name: "repo2" },
  ];
  // ======================

  // 設定を保存
  setConfig({
    github: { token: GITHUB_TOKEN, repositories: [] },
    spreadsheet: { id: SPREADSHEET_ID, sheetName: 'DevOps Metrics' },
  });
  Logger.log('✅ Configuration saved');

  // リポジトリを追加
  for (const repo of REPOSITORIES) {
    addRepository(repo.owner, repo.name);
    Logger.log(`✅ Added repository: ${repo.owner}/${repo.name}`);
  }

  Logger.log('✅ 初期設定完了');
}

/**
 * GitHub Apps認証用の初期設定
 *
 * 使い方:
 * 1. 下記の値を自分の環境に合わせて編集
 * 2. bun run push でデプロイ
 * 3. GASエディタで initConfigWithGitHubApp を実行
 * 4. 設定完了後、このファイルの機密情報は削除してOK
 *
 * PRIVATE_KEY の記載方法:
 * - バッククォート(``)で囲んで複数行のまま貼り付けてOK
 * - 改行はそのまま使用されます
 */
function initConfigWithGitHubApp(): void {
  // コンテナ初期化
  if (!isContainerInitialized()) {
    initializeContainer(createGasAdapters());
  }

  // ===== ここを編集 =====
  // 重要: 実際の値を設定したら、コミット前に必ずプレースホルダーに戻してください
  const APP_ID = 'YOUR_APP_ID_HERE'; // 例: "123456"
  const INSTALLATION_ID = 'YOUR_INSTALLATION_ID_HERE'; // 例: "12345678"

  // PRIVATE_KEYは複数行のまま貼り付けてOK（バッククォートで囲む）
  const PRIVATE_KEY = `YOUR_PRIVATE_KEY_HERE`;
  // 例:
  // const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
  // MIIEpAIBAAKCAQEA...
  // ...
  // -----END RSA PRIVATE KEY-----`;

  const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

  // リポジトリ設定
  const REPOSITORIES: { owner: string; name: string }[] = [
    // { owner: "your-org", name: "your-repo" },
  ];
  // ======================

  // 設定を保存
  setConfig({
    github: {
      appConfig: {
        appId: APP_ID,
        privateKey: PRIVATE_KEY, // テンプレートリテラルの改行はそのまま使用
        installationId: INSTALLATION_ID,
      },
      repositories: [],
    },
    spreadsheet: { id: SPREADSHEET_ID, sheetName: 'DevOps Metrics' },
  });
  Logger.log('✅ Configuration saved (GitHub App auth)');

  // リポジトリを追加
  for (const repo of REPOSITORIES) {
    addRepository(repo.owner, repo.name);
    Logger.log(`✅ Added repository: ${repo.owner}/${repo.name}`);
  }

  Logger.log('✅ GitHub Apps認証での初期設定完了');
  Logger.log('🔐 認証モード: GitHub App');
}

global.initConfig = initConfig;
global.initConfigWithGitHubApp = initConfigWithGitHubApp;
