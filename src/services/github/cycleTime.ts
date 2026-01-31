/**
 * Cycle Time & Coding Time 計測モジュール
 *
 * Issue作成からProductionマージまでのサイクルタイム、
 * Issue作成からPR作成までのコーディングタイムを計測。
 */

import type {
  GitHubRepository,
  ApiResponse,
  PRChainItem,
  IssueCycleTime,
  IssueCodingTime,
} from "../../types";
import { getContainer } from "../../container";
import { type IssueDateRange } from "./api";
import { getIssues, getLinkedPRsForIssue } from "./issues";
import { getPullRequestWithBranches, findPRContainingCommit } from "./pullRequests";

// =============================================================================
// PRチェーン追跡
// =============================================================================

/**
 * PRチェーンを追跡してproductionブランチへのマージを検出
 *
 * feature → main → staging → production のようなPRの連鎖を追跡
 */
export function trackToProductionMerge(
  owner: string,
  repo: string,
  initialPRNumber: number,
  token: string,
  productionPattern: string = "production"
): ApiResponse<{
  productionMergedAt: string | null;
  prChain: PRChainItem[];
}> {
  const { logger } = getContainer();
  const prChain: PRChainItem[] = [];
  const maxDepth = 5;
  let currentPRNumber = initialPRNumber;
  let productionMergedAt: string | null = null;

  for (let depth = 0; depth < maxDepth; depth++) {
    const prResult = getPullRequestWithBranches(
      owner,
      repo,
      currentPRNumber,
      token
    );

    if (!prResult.success || !prResult.data) {
      logger.log(`    ⚠️ Failed to fetch PR #${currentPRNumber}`);
      break;
    }

    const pr = prResult.data;
    prChain.push({
      prNumber: pr.number,
      baseBranch: pr.baseBranch ?? "unknown",
      headBranch: pr.headBranch ?? "unknown",
      mergedAt: pr.mergedAt,
    });

    // productionブランチへのマージを検出
    if (
      pr.baseBranch &&
      pr.baseBranch.toLowerCase().includes(productionPattern.toLowerCase())
    ) {
      if (pr.mergedAt) {
        productionMergedAt = pr.mergedAt;
        logger.log(
          `    ✅ Found production merge: PR #${pr.number} → ${pr.baseBranch} at ${pr.mergedAt}`
        );
      }
      break;
    }

    // マージされていない場合は追跡終了
    if (!pr.mergedAt || !pr.mergeCommitSha) break;

    // マージコミットSHAから次のPRを検索
    const nextPRResult = findPRContainingCommit(
      owner,
      repo,
      pr.mergeCommitSha,
      token
    );

    if (!nextPRResult.success || !nextPRResult.data) break;

    // 同じPRの場合は無限ループを防止
    if (nextPRResult.data.number === currentPRNumber) break;

    currentPRNumber = nextPRResult.data.number;
  }

  return { success: true, data: { productionMergedAt, prChain } };
}

// =============================================================================
// サイクルタイムデータ取得
// =============================================================================

/**
 * 複数リポジトリからサイクルタイムデータを取得
 *
 * サイクルタイム = Issue作成 → Productionマージ
 */
export function getCycleTimeData(
  repositories: GitHubRepository[],
  token: string,
  options: {
    dateRange?: IssueDateRange;
    productionBranchPattern?: string;
    labels?: string[];
  } = {}
): ApiResponse<IssueCycleTime[]> {
  const { logger } = getContainer();
  const productionPattern = options.productionBranchPattern ?? "production";
  const allCycleTimeData: IssueCycleTime[] = [];

  for (const repo of repositories) {
    logger.log(`🔍 Processing ${repo.fullName}...`);

    // Issueを取得
    const issuesResult = getIssues(repo, token, {
      dateRange: options.dateRange,
      labels: options.labels,
    });

    if (!issuesResult.success || !issuesResult.data) {
      logger.log(`  ⚠️ Failed to fetch issues: ${issuesResult.error}`);
      continue;
    }

    const issues = issuesResult.data;
    logger.log(`  📋 Found ${issues.length} issues to process`);

    // 各IssueについてリンクPRとproductionマージを追跡
    for (const issue of issues) {
      logger.log(`  📌 Processing Issue #${issue.number}: ${issue.title}`);

      const linkedPRsResult = getLinkedPRsForIssue(
        repo.owner,
        repo.name,
        issue.number,
        token
      );

      if (
        !linkedPRsResult.success ||
        !linkedPRsResult.data ||
        linkedPRsResult.data.length === 0
      ) {
        logger.log(`    ⏭️ No linked PRs found`);
        allCycleTimeData.push({
          issueNumber: issue.number,
          issueTitle: issue.title,
          repository: repo.fullName,
          issueCreatedAt: issue.createdAt,
          productionMergedAt: null,
          cycleTimeHours: null,
          prChain: [],
        });
        continue;
      }

      logger.log(
        `    🔗 Found ${linkedPRsResult.data.length} linked PRs: ${linkedPRsResult.data.join(", ")}`
      );

      // 最初のリンクPRからproductionマージを追跡
      let bestResult: {
        productionMergedAt: string | null;
        prChain: PRChainItem[];
      } | null = null;

      for (const prNumber of linkedPRsResult.data) {
        const trackResult = trackToProductionMerge(
          repo.owner,
          repo.name,
          prNumber,
          token,
          productionPattern
        );

        if (trackResult.success && trackResult.data) {
          if (trackResult.data.productionMergedAt) {
            if (
              !bestResult ||
              !bestResult.productionMergedAt ||
              new Date(trackResult.data.productionMergedAt) <
                new Date(bestResult.productionMergedAt)
            ) {
              bestResult = trackResult.data;
            }
          } else if (!bestResult) {
            bestResult = trackResult.data;
          }
        }
      }

      const prChain = bestResult?.prChain ?? [];
      const productionMergedAt = bestResult?.productionMergedAt ?? null;

      // サイクルタイム計算
      let cycleTimeHours: number | null = null;
      if (productionMergedAt) {
        const startTime = new Date(issue.createdAt).getTime();
        const endTime = new Date(productionMergedAt).getTime();
        cycleTimeHours =
          Math.round(((endTime - startTime) / (1000 * 60 * 60)) * 10) / 10;
      }

      allCycleTimeData.push({
        issueNumber: issue.number,
        issueTitle: issue.title,
        repository: repo.fullName,
        issueCreatedAt: issue.createdAt,
        productionMergedAt,
        cycleTimeHours,
        prChain,
      });
    }
  }

  logger.log(`✅ Total: ${allCycleTimeData.length} issues processed`);
  return { success: true, data: allCycleTimeData };
}

// =============================================================================
// コーディングタイムデータ取得
// =============================================================================

/**
 * 複数リポジトリからコーディングタイムデータを取得
 *
 * コーディングタイム = Issue作成 → PR作成
 */
export function getCodingTimeData(
  repositories: GitHubRepository[],
  token: string,
  options: {
    dateRange?: IssueDateRange;
    labels?: string[];
  } = {}
): ApiResponse<IssueCodingTime[]> {
  const { logger } = getContainer();
  const allCodingTimeData: IssueCodingTime[] = [];

  for (const repo of repositories) {
    logger.log(`🔍 Processing ${repo.fullName} for coding time...`);

    // Issueを取得
    const issuesResult = getIssues(repo, token, {
      dateRange: options.dateRange,
      labels: options.labels,
    });

    if (!issuesResult.success || !issuesResult.data) {
      logger.log(`  ⚠️ Failed to fetch issues: ${issuesResult.error}`);
      continue;
    }

    const issues = issuesResult.data;
    logger.log(`  📋 Found ${issues.length} issues to process`);

    // 各IssueについてリンクPRを取得してコーディングタイムを計算
    for (const issue of issues) {
      logger.log(`  📌 Processing Issue #${issue.number}: ${issue.title}`);

      const linkedPRsResult = getLinkedPRsForIssue(
        repo.owner,
        repo.name,
        issue.number,
        token
      );

      if (
        !linkedPRsResult.success ||
        !linkedPRsResult.data ||
        linkedPRsResult.data.length === 0
      ) {
        logger.log(`    ⏭️ No linked PRs found`);
        allCodingTimeData.push({
          issueNumber: issue.number,
          issueTitle: issue.title,
          repository: repo.fullName,
          issueCreatedAt: issue.createdAt,
          prCreatedAt: null,
          prNumber: null,
          codingTimeHours: null,
        });
        continue;
      }

      logger.log(
        `    🔗 Found ${linkedPRsResult.data.length} linked PRs: ${linkedPRsResult.data.join(", ")}`
      );

      // 最も早く作成されたPRを使用
      let earliestPR: { prNumber: number; createdAt: string } | null = null;

      for (const prNumber of linkedPRsResult.data) {
        const prResult = getPullRequestWithBranches(
          repo.owner,
          repo.name,
          prNumber,
          token
        );

        if (prResult.success && prResult.data) {
          const pr = prResult.data;
          if (
            !earliestPR ||
            new Date(pr.createdAt) < new Date(earliestPR.createdAt)
          ) {
            earliestPR = { prNumber: pr.number, createdAt: pr.createdAt };
          }
        }
      }

      if (!earliestPR) {
        logger.log(`    ⚠️ Could not fetch any linked PR details`);
        allCodingTimeData.push({
          issueNumber: issue.number,
          issueTitle: issue.title,
          repository: repo.fullName,
          issueCreatedAt: issue.createdAt,
          prCreatedAt: null,
          prNumber: null,
          codingTimeHours: null,
        });
        continue;
      }

      // コーディングタイム計算
      const issueCreatedTime = new Date(issue.createdAt).getTime();
      const prCreatedTime = new Date(earliestPR.createdAt).getTime();
      const codingTimeHours =
        Math.round(
          ((prCreatedTime - issueCreatedTime) / (1000 * 60 * 60)) * 10
        ) / 10;

      logger.log(
        `    ✅ Coding time: ${codingTimeHours}h (Issue → PR #${earliestPR.prNumber})`
      );

      allCodingTimeData.push({
        issueNumber: issue.number,
        issueTitle: issue.title,
        repository: repo.fullName,
        issueCreatedAt: issue.createdAt,
        prCreatedAt: earliestPR.createdAt,
        prNumber: earliestPR.prNumber,
        codingTimeHours,
      });
    }
  }

  logger.log(
    `✅ Total: ${allCodingTimeData.length} issues processed for coding time`
  );
  return { success: true, data: allCodingTimeData };
}
