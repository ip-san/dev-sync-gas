/**
 * DORA Thresholds のユニットテスト
 */

import { describe, it, expect } from "bun:test";
import {
  DEPLOYMENT_FREQUENCY_THRESHOLDS,
  LEAD_TIME_THRESHOLDS,
  CHANGE_FAILURE_RATE_THRESHOLDS,
  MTTR_THRESHOLDS,
  getDeploymentFrequencyLevel,
  getLeadTimeLevel,
  getChangeFailureRateLevel,
  getMTTRLevel,
  getFrequencyCategory,
} from "../../src/config/doraThresholds";

describe("DORA Thresholds Constants", () => {
  it("Deployment Frequency の閾値が正しく設定されている", () => {
    expect(DEPLOYMENT_FREQUENCY_THRESHOLDS.elite).toBe(1);
    expect(DEPLOYMENT_FREQUENCY_THRESHOLDS.high).toBeCloseTo(1 / 7, 5);
    expect(DEPLOYMENT_FREQUENCY_THRESHOLDS.medium).toBeCloseTo(1 / 30, 5);
  });

  it("Lead Time の閾値が正しく設定されている（時間単位）", () => {
    expect(LEAD_TIME_THRESHOLDS.elite).toBe(1); // 1時間
    expect(LEAD_TIME_THRESHOLDS.high).toBe(24); // 1日
    expect(LEAD_TIME_THRESHOLDS.medium).toBe(24 * 7); // 1週間
    // Low は medium 以上なので閾値定数は不要
  });

  it("Change Failure Rate の閾値が正しく設定されている（%）", () => {
    expect(CHANGE_FAILURE_RATE_THRESHOLDS.eliteHigh).toBe(15);
    expect(CHANGE_FAILURE_RATE_THRESHOLDS.medium).toBe(30);
  });

  it("MTTR の閾値が正しく設定されている（時間単位）", () => {
    expect(MTTR_THRESHOLDS.elite).toBe(1); // 1時間
    expect(MTTR_THRESHOLDS.high).toBe(24); // 1日
    expect(MTTR_THRESHOLDS.medium).toBe(24 * 7); // 1週間
  });
});

describe("getDeploymentFrequencyLevel", () => {
  it("1日1回以上はElite", () => {
    expect(getDeploymentFrequencyLevel(1)).toBe("elite");
    expect(getDeploymentFrequencyLevel(5)).toBe("elite");
  });

  it("週1回以上1日1回未満はHigh", () => {
    expect(getDeploymentFrequencyLevel(0.5)).toBe("high"); // 2日に1回
    expect(getDeploymentFrequencyLevel(1 / 7)).toBe("high"); // ちょうど週1回
  });

  it("月1回以上週1回未満はMedium", () => {
    expect(getDeploymentFrequencyLevel(1 / 14)).toBe("medium"); // 2週に1回
    expect(getDeploymentFrequencyLevel(1 / 30)).toBe("medium"); // ちょうど月1回
  });

  it("月1回未満はLow", () => {
    expect(getDeploymentFrequencyLevel(1 / 60)).toBe("low"); // 2ヶ月に1回
    expect(getDeploymentFrequencyLevel(0)).toBe("low");
  });
});

describe("getLeadTimeLevel", () => {
  it("1時間未満はElite", () => {
    expect(getLeadTimeLevel(0.5)).toBe("elite");
    expect(getLeadTimeLevel(0.99)).toBe("elite");
  });

  it("1時間以上24時間未満はHigh", () => {
    expect(getLeadTimeLevel(1)).toBe("high");
    expect(getLeadTimeLevel(23)).toBe("high");
  });

  it("1日以上1週間未満はMedium", () => {
    expect(getLeadTimeLevel(24)).toBe("medium");
    expect(getLeadTimeLevel(24 * 6)).toBe("medium");
  });

  it("1週間以上はLow", () => {
    expect(getLeadTimeLevel(24 * 7)).toBe("low");
    expect(getLeadTimeLevel(24 * 30)).toBe("low");
  });
});

describe("getChangeFailureRateLevel", () => {
  it("15%以下はHigh（Elite/Highは区別不可）", () => {
    expect(getChangeFailureRateLevel(0)).toBe("high");
    expect(getChangeFailureRateLevel(10)).toBe("high");
    expect(getChangeFailureRateLevel(15)).toBe("high");
  });

  it("15%超30%以下はMedium", () => {
    expect(getChangeFailureRateLevel(16)).toBe("medium");
    expect(getChangeFailureRateLevel(25)).toBe("medium");
    expect(getChangeFailureRateLevel(30)).toBe("medium");
  });

  it("30%超はLow", () => {
    expect(getChangeFailureRateLevel(31)).toBe("low");
    expect(getChangeFailureRateLevel(50)).toBe("low");
  });
});

describe("getMTTRLevel", () => {
  it("1時間未満はElite", () => {
    expect(getMTTRLevel(0.5)).toBe("elite");
    expect(getMTTRLevel(0.99)).toBe("elite");
  });

  it("1時間以上24時間未満はHigh", () => {
    expect(getMTTRLevel(1)).toBe("high");
    expect(getMTTRLevel(23)).toBe("high");
  });

  it("1日以上1週間未満はMedium", () => {
    expect(getMTTRLevel(24)).toBe("medium");
    expect(getMTTRLevel(24 * 6)).toBe("medium");
  });

  it("1週間以上はLow", () => {
    expect(getMTTRLevel(24 * 7)).toBe("low");
    expect(getMTTRLevel(24 * 30)).toBe("low");
  });
});

describe("getFrequencyCategory", () => {
  it("1日1回以上はdaily", () => {
    expect(getFrequencyCategory(1)).toBe("daily");
    expect(getFrequencyCategory(10)).toBe("daily");
  });

  it("週1回以上1日1回未満はweekly", () => {
    expect(getFrequencyCategory(0.5)).toBe("weekly");
    expect(getFrequencyCategory(1 / 7)).toBe("weekly");
  });

  it("月1回以上週1回未満はmonthly", () => {
    expect(getFrequencyCategory(1 / 14)).toBe("monthly");
    expect(getFrequencyCategory(1 / 30)).toBe("monthly");
  });

  it("月1回未満はyearly", () => {
    expect(getFrequencyCategory(1 / 60)).toBe("yearly");
    expect(getFrequencyCategory(0)).toBe("yearly");
  });
});
