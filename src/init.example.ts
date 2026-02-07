/**
 * 初期設定ファイルのテンプレート
 *
 * 使い方:
 * 1. このファイルを src/init.ts にコピー
 * 2. 値を自分の環境に合わせて編集
 * 3. bun run push でデプロイ
 * 4. GASエディタで initConfig を実行
 * 5. 設定完了後、機密情報は削除してOK（PropertiesServiceに保存済み）
 *
 * 認証方式:
 * - Personal Access Token: auth.type = 'token' を使用
 * - GitHub Apps: auth.type = 'github-app' を使用
 *
 * 設定構造:
 * - プロジェクトごとに設定をグループ化
 * - 各プロジェクトは独自のスプレッドシート、リポジトリ、除外設定を持つ
 */

import type { InitConfig } from './config/initializer';
import { initializeFromConfig } from './config/initializer';

/// <reference path="./types/gas-global.d.ts" />

// ===== ここを編集 =====
export const config: InitConfig = {
  // 認証設定（全プロジェクト共通）
  auth: {
    // --- GitHub Apps認証の場合（推奨） ---
    type: 'github-app',
    appId: 'YOUR_APP_ID_HERE', // 例: '123456'
    installationId: 'YOUR_INSTALLATION_ID_HERE', // 例: '12345678'
    privateKey: `YOUR_PRIVATE_KEY_HERE`, // 複数行のまま貼り付けてOK
    // 例:
    // privateKey: `-----BEGIN RSA PRIVATE KEY-----
    // MIIEpAIBAAKCAQEA...
    // ...
    // -----END RSA PRIVATE KEY-----`,

    // --- Personal Access Token認証の場合 ---
    // type: 'token',
    // token: 'ghp_xxxxx', // GitHubのPersonal Access Token
  },

  // プロジェクト設定（プロジェクトごとに設定がまとまる）
  projects: [
    {
      // プロジェクト名（識別用）
      name: 'My Project',

      // このプロジェクトの出力先スプレッドシート
      spreadsheet: {
        id: 'YOUR_SPREADSHEET_ID_HERE',
        sheetName: 'DevOps Metrics', // 省略可（デフォルト: 'DevOps Metrics'）
      },

      // このプロジェクトに含まれるリポジトリ
      repositories: [
        { owner: 'your-org', name: 'your-repo' },
        // 追加するリポジトリをここに列挙
        // { owner: 'your-org', name: 'another-repo' },
      ],

      // このプロジェクト固有の除外設定（部分一致）
      // デプロイ用PRを除外する場合に設定
      excludeBranches: {
        prSize: ['production', 'staging'],
        reviewEfficiency: ['production', 'staging'],
        cycleTime: ['production', 'staging'],
        codingTime: ['production', 'staging'],
        reworkRate: ['production', 'staging'],
      },

      // デプロイワークフローパターン（部分一致）
      deployWorkflowPatterns: ['deploy'],

      // Productionブランチパターン（部分一致、デフォルト: "production"）
      // サイクルタイム計測でどのブランチをProductionとみなすかを指定
      productionBranchPattern: 'production',

      // 例:
      // - "production" → 除外
      // - "production-hotfix" → 除外（部分一致）
      // - "staging-test" → 除外（部分一致）
      // - "main" → 含める
    },

    // 複数プロジェクトを管理する場合は追加
    // {
    //   name: 'Another Project',
    //   spreadsheet: {
    //     id: 'ANOTHER_SPREADSHEET_ID',
    //     sheetName: 'DevOps Metrics',
    //   },
    //   repositories: [
    //     { owner: 'org-name', name: 'repo-name' },
    //   ],
    //   excludeBranches: {
    //     prSize: ['main'],
    //     reviewEfficiency: ['main'],
    //     cycleTime: ['main'],
    //     codingTime: ['main'],
    //     reworkRate: ['main'],
    //   },
    //   deployWorkflowPatterns: ['deploy'],
    //   productionBranchPattern: 'main',  // デフォルト: "production"
    // },
  ],
};
// ======================

/**
 * GAS環境で実行される初期化関数
 * GASエディタで実行してください
 */
function initConfig(): void {
  initializeFromConfig(config);
}

// GASグローバル関数として登録
global.initConfig = initConfig;
