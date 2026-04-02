/**
 * デプロイ頻度診断ツール
 *
 * デプロイ頻度の計算結果を診断し、なぜ特定の結果になっているかを詳細に表示します。
 */

import { getDeployWorkflowPatterns } from '../../config/metrics';
import { getGitHubToken } from '../../config/settings';
import { getContainer } from '../../container';
import type { LoggerClient } from '../../interfaces';
import { getDeployments, getWorkflowRuns } from '../../services/github/deployments';
import type { GitHubDeployment, GitHubRepository, GitHubWorkflowRun } from '../../types';
import { calculateDeploymentFrequency } from '../../utils/metrics/dora/deploymentFrequency';
import { ensureContainerInitialized } from '../helpers';

/**
 * デプロイメントデータの診断
 */
function diagnoseDeployments(
  deployments: GitHubDeployment[],
  logger: LoggerClient
): { successCount: number; hasData: boolean } {
  logger.log(`\n📦 Deployments API Data:`);

  if (deployments.length === 0) {
    logger.log(`   ❌ No deployments found via Deployments API`);
    logger.log(`   💡 Make sure your repository uses GitHub Deployments API`);
    logger.log(`   💡 Or ensure workflows are correctly configured (see below)`);
    return { successCount: 0, hasData: false };
  }

  logger.log(`   ✅ Found ${deployments.length} deployment(s)`);

  const successfulDeployments = deployments.filter((d) => d.status === 'success');
  const failedDeployments = deployments.filter(
    (d) => d.status === 'failure' || d.status === 'error'
  );
  const otherDeployments = deployments.filter(
    (d) => d.status !== 'success' && d.status !== 'failure' && d.status !== 'error'
  );

  logger.log(`      Success: ${successfulDeployments.length}`);
  logger.log(`      Failed: ${failedDeployments.length}`);
  if (otherDeployments.length > 0) {
    logger.log(`      Other status: ${otherDeployments.length}`);
  }

  if (successfulDeployments.length > 0) {
    logger.log(`\n   📋 Successful deployments:`);
    for (const deployment of successfulDeployments.slice(0, 5)) {
      logger.log(`      - ${deployment.createdAt}: ${deployment.environment || '(no env)'}`);
    }
    if (successfulDeployments.length > 5) {
      logger.log(`      ... and ${successfulDeployments.length - 5} more`);
    }
  }

  return { successCount: successfulDeployments.length, hasData: true };
}

/**
 * ワークフロー実行データの診断
 */
function logNoMatchingWorkflows(runs: GitHubWorkflowRun[], logger: LoggerClient): void {
  logger.log(`\n   ❌ No workflows match the deploy patterns`);
  logger.log(`   💡 Available workflow names in this period:`);

  const uniqueWorkflowNames = [...new Set(runs.map((r) => r.name))];
  for (const name of uniqueWorkflowNames.slice(0, 10)) {
    logger.log(`      - "${name}"`);
  }
  if (uniqueWorkflowNames.length > 10) {
    logger.log(`      ... and ${uniqueWorkflowNames.length - 10} more`);
  }

  logger.log(`\n   💡 To fix, update deploy patterns with:`);
  logger.log(`      setDeployWorkflowPatterns(["your-workflow-name"])`);
}

function diagnoseWorkflowRuns(
  runs: GitHubWorkflowRun[],
  patterns: string[],
  logger: LoggerClient
): { deployCount: number; hasData: boolean } {
  logger.log(`\n⚙️  Workflow Runs Data:`);

  if (runs.length === 0) {
    logger.log(`   ❌ No workflow runs found`);
    logger.log(`   💡 Check if your repository has GitHub Actions workflows`);
    return { deployCount: 0, hasData: false };
  }

  logger.log(`   ✅ Found ${runs.length} workflow run(s)`);

  const matchingRuns = runs.filter((run) => {
    const nameLower = run.name.toLowerCase();
    return patterns.some((pattern) => nameLower.includes(pattern.toLowerCase()));
  });

  const successfulMatches = matchingRuns.filter((run) => run.conclusion === 'success');
  const failedMatches = matchingRuns.filter((run) => run.conclusion === 'failure');

  logger.log(`\n   🔍 Deploy workflow patterns: [${patterns.map((p) => `"${p}"`).join(', ')}]`);
  logger.log(`      Matching workflows: ${matchingRuns.length}`);
  logger.log(`      Success: ${successfulMatches.length}`);
  logger.log(`      Failed: ${failedMatches.length}`);

  if (matchingRuns.length === 0) {
    logNoMatchingWorkflows(runs, logger);
  } else if (successfulMatches.length > 0) {
    logger.log(`\n   📋 Successful deploy workflows:`);
    for (const run of successfulMatches.slice(0, 5)) {
      logger.log(`      - ${run.createdAt}: "${run.name}"`);
    }
    if (successfulMatches.length > 5) {
      logger.log(`      ... and ${successfulMatches.length - 5} more`);
    }
  }

  return { deployCount: successfulMatches.length, hasData: matchingRuns.length > 0 };
}

/**
 * デプロイ頻度の計算結果を診断
 */
function diagnoseFrequencyResult(
  count: number,
  frequency: number,
  periodDays: number,
  logger: LoggerClient
): void {
  logger.log(`\n📊 Deployment Frequency Calculation:`);
  logger.log(`   Total deploys: ${count}`);
  logger.log(`   Period: ${periodDays} days`);
  logger.log(`   Deployment frequency: ${frequency.toFixed(4)} deploys/day`);

  logger.log(`\n   📐 DORA Performance Levels (reference):`);
  logger.log(`      Elite:   >= 1.0000 deploys/day`);
  logger.log(`      High:    >= 0.1429 deploys/day (≈1/week)`);
  logger.log(`      Medium:  >= 0.0333 deploys/day (≈1/month)`);
  logger.log(`      Low:     <  0.0333 deploys/day`);

  // パフォーマンスレベルを判定して表示
  let level: string;
  let advice: string;

  if (frequency >= 1.0) {
    level = 'Elite';
    advice = '🎉 Excellent! You are deploying at Elite level.';
  } else if (frequency >= 1 / 7) {
    level = 'High';
    const needed = (1 - frequency).toFixed(4);
    advice = `✅ Good! To reach Elite: need ${needed} more deploys/day`;
  } else if (frequency >= 1 / 30) {
    level = 'Medium';
    const needed = (1 / 7 - frequency).toFixed(4);
    advice = `⚠️  To reach High: need ${needed} more deploys/day (≈1/week)`;
  } else {
    level = 'Low';
    const needed = (1 / 30 - frequency).toFixed(4);
    advice = `❌ To reach Medium: need ${needed} more deploys/day (≈1/month)`;
  }

  logger.log(`\n   Performance Level: ${level}`);
  logger.log(`   ${advice}`);
}

/**
 * デプロイ頻度の診断を実行
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param periodDays - 集計期間（日数、デフォルト: 30）
 */
export function debugDeploymentFrequency(
  owner: string,
  repo: string,
  periodDays: number = 30
): void {
  ensureContainerInitialized();
  const { logger } = getContainer();
  const token = getGitHubToken();

  logger.log(`\n🔍 Debugging Deployment Frequency`);
  logger.log(`   Repository: ${owner}/${repo}`);
  logger.log(`   Period: ${periodDays} days`);
  logger.log(`\n─────────────────────────────────────────────────────────`);

  // リポジトリ情報を構築
  const repository: GitHubRepository = {
    owner,
    name: repo,
    fullName: `${owner}/${repo}`,
  };

  // デプロイメントデータを取得
  const sinceDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const deploymentsResult = getDeployments(repository, token, {
    dateRange: { since: sinceDate },
  });

  const deployments: GitHubDeployment[] = deploymentsResult.success
    ? (deploymentsResult.data ?? [])
    : [];

  // ワークフロー実行データを取得
  const runsResult = getWorkflowRuns(repository, token, {
    since: sinceDate,
  });
  const runs: GitHubWorkflowRun[] = runsResult.success ? (runsResult.data ?? []) : [];

  // 設定を取得
  const patterns = getDeployWorkflowPatterns();

  // 診断実行
  const { successCount: deploymentsCount, hasData: hasDeploymentData } = diagnoseDeployments(
    deployments,
    logger
  );
  const { hasData: hasWorkflowData } = diagnoseWorkflowRuns(runs, patterns, logger);

  // 実際の計算を実行
  const { count, frequency } = calculateDeploymentFrequency(deployments, runs, periodDays);

  // 結果の診断
  diagnoseFrequencyResult(count, frequency, periodDays, logger);

  logFinalJudgment(count, deploymentsCount, hasDeploymentData, hasWorkflowData, logger);
}

function logFinalJudgment(
  count: number,
  deploymentsCount: number,
  hasDeploymentData: boolean,
  hasWorkflowData: boolean,
  logger: LoggerClient
): void {
  logger.log(`\n─────────────────────────────────────────────────────────`);
  if (count === 0) {
    logger.log(`\n❌ No deployments detected`);
    if (!hasDeploymentData && !hasWorkflowData) {
      logger.log(`   💡 Neither Deployments API nor Workflow runs found`);
      logger.log(`   💡 Check your GitHub Actions configuration`);
    } else if (!hasDeploymentData) {
      logger.log(`   💡 Deployments API has no data`);
      logger.log(`   💡 Falling back to Workflow runs, but no matching workflows found`);
      logger.log(`   💡 Update deploy patterns with: setDeployWorkflowPatterns([...])`);
    }
  } else {
    logger.log(`\n✅ Diagnostic complete`);
    logger.log(
      `   Using data source: ${deploymentsCount > 0 ? 'Deployments API' : 'Workflow Runs'}`
    );
  }
}
