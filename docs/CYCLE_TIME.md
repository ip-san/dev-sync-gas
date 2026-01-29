# サイクルタイム（Cycle Time）実装ガイド

GitHub IssueからProductionマージまでのサイクルタイムを計測する機能の解説です。

---

## 目次

- [サイクルタイムとは](#サイクルタイムとは)
- [計測方法](#計測方法)
- [設定](#設定)
- [使い方](#使い方)
- [出力データ](#出力データ)
- [DORA Metricsとの違い](#dora-metricsとの違い)
- [出典・参考資料](#出典参考資料)

---

## サイクルタイムとは

サイクルタイムは、タスクの**着手から完了までの時間**を測定する指標です。

本実装では、GitHubのIssue作成からProductionブランチへのマージまでの時間を計測します。

```
Issue作成 ──────────→ Productionマージ
    ↑                      ↑
  着手日                 完了日

  ←──── サイクルタイム ────→
```

### 公式定義

> **Cycle time** is the time it takes your team to finish work items after they start working on them.
>
> — [Microsoft Azure DevOps](https://learn.microsoft.com/en-us/azure/devops/report/dashboards/cycle-time-and-lead-time)

> **Cycle Time** is the amount of time it takes for a task to move from the "In Progress" state to "Done".
>
> — [Atlassian Jira](https://support.atlassian.com/jira-software-cloud/docs/view-and-understand-your-cycle-time-report/)

### なぜサイクルタイムを計測するのか

- **生産性の可視化**: タスク完了までの実時間を把握
- **ボトルネックの発見**: 時間がかかるタスクの傾向を分析
- **改善効果の測定**: ツール導入やプロセス改善の効果を定量化
- **WIP制限の効果確認**: Kanbanの原則に基づき、WIPを減らすことでサイクルタイムが短縮される

---

## 計測方法

### 本実装の定義

| 開始点 | 終了点 | 計算式 |
|--------|--------|--------|
| GitHub Issue作成日時 | Productionブランチへのマージ日時 | マージ日時 - Issue作成日時 |

### PRチェーン追跡

多段階マージ（feature→main→staging→production）の場合、PRチェーンを追跡してProductionマージを検出します。

```
Issue #123 作成 (着手日)
    ↓
PR1 (feature→main) ← "Fixes #123" でリンク
    ↓ マージコミットSHA
PR2 (main→staging)
    ↓ マージコミットSHA
PR3 (staging→xxx_production) ← このマージ日 = 完了日
```

### 追跡方法

1. **Issue作成日時**: `GET /repos/{owner}/{repo}/issues/{number}` の `created_at`
2. **リンクPR検出**: Timeline APIの `cross-referenced` イベントからPR番号を取得
3. **PRチェーン追跡**: マージコミットSHAを使って次のPRを検索
4. **Production検出**: `base` ブランチ名に設定パターン（デフォルト: `production`）が含まれるPRを検出

### 統計値

| 指標 | 説明 |
|------|------|
| 平均（Average） | 全タスクのサイクルタイムの平均値 |
| 中央値（Median） | ソート後の中央の値。外れ値の影響を受けにくい |
| 最小（Min） | 最も短いサイクルタイム |
| 最大（Max） | 最も長いサイクルタイム |

---

## 設定

### Productionブランチパターン

Productionブランチを識別するパターンを設定します。ブランチ名にこのパターンが含まれていればProductionとみなします。

```javascript
// デフォルト: "production"
// "xxx_production", "production-release" などにマッチ
configureProductionBranch("production");

// "release" ブランチを使用する場合
configureProductionBranch("release");

// 現在の設定を確認
showProductionBranch();

// デフォルトにリセット
resetProductionBranch();
```

### ラベルフィルタ

特定のラベルが付いたIssueのみを計測対象にできます。

```javascript
// "feature" ラベルのIssueのみ計測
configureCycleTimeLabels(["feature"]);

// 複数ラベル（OR条件）
configureCycleTimeLabels(["feature", "bug"]);

// 現在の設定を確認
showCycleTimeLabels();

// 全Issueを対象にリセット
resetCycleTimeLabelsConfig();

// 全設定を一覧表示
showCycleTimeConfig();
```

### IssueとPRのリンク

IssueとPRをリンクするには、PRのdescriptionまたはコミットメッセージに以下のキーワードを含めます：

- `Fixes #123`
- `Closes #123`
- `Resolves #123`

---

## 使い方

### 基本的な使い方

```javascript
// GASエディタで実行

// 過去30日間のサイクルタイムを計測
syncCycleTime();

// 過去90日間のサイクルタイムを計測
syncCycleTime(90);
```

### オプション

```javascript
// タスク詳細をログで確認（デバッグ用）
showCycleTimeDetails(30);
```

### 前提条件

1. **GitHub連携の設定が必要**

```javascript
setup(
  'ghp_xxxx',           // GitHub PAT
  'spreadsheet-id'      // Google Spreadsheet ID
);
```

2. **リポジトリの登録**

```javascript
addRepo('your-org', 'your-repo');
```

3. **IssueとPRのリンク**

PRのdescriptionに `Fixes #123` などのキーワードでIssueをリンク

---

## 出力データ

### スプレッドシート出力

2つのシートが作成されます：

#### 「サイクルタイム」シート（サマリー）

| 期間 | 完了タスク数 | 平均 (時間) | 平均 (日) | 中央値 | 最小 | 最大 | 記録日時 |
|------|-------------|-------------|-----------|--------|------|------|----------|
| 2024-01-01〜2024-01-31 | 15 | 48.5 | 2.0 | 36.0 | 4.0 | 120.0 | 2024-01-31T... |

#### 「サイクルタイム - Details」シート（Issue詳細）

| Issue番号 | タイトル | リポジトリ | Issue作成日時 | Productionマージ日時 | サイクルタイム (時間) | サイクルタイム (日) | PRチェーン |
|-----------|---------|-----------|--------------|---------------------|---------------------|-------------------|-----------|
| #123 | Implement feature X | org/repo | 2024-01-10T10:00 | 2024-01-11T14:00 | 28.0 | 1.2 | #1→#2→#3 |

### ログ出力例

```
⏱️ Calculating Cycle Time for 30 days
   Period: 2024-01-01〜2024-01-31
📥 Fetched 15 issues with cycle time data
📊 Cycle Time Results:
   Completed tasks: 15
   Average: 48.5 hours (2.0 days)
   Median: 36.0 hours
   Min: 4.0 hours
   Max: 120.0 hours
✅ Cycle Time metrics synced
```

---

## DORA Metricsとの違い

### Lead Time for Changes vs Cycle Time

DORAの「Lead Time for Changes」と本実装の「サイクルタイム」は、異なる概念です。

> **Lead Time for Changes** is defined in *Accelerate* as "the time taken to go from code committed to code successfully running in production."
>
> — [Apache DevLake - DORA Metrics](https://devlake.apache.org/docs/Metrics/LeadTimeForChanges/)

| 観点 | Lead Time for Changes (DORA) | Cycle Time (本実装) |
|------|------------------------------|---------------------|
| **視点** | デリバリーパイプライン | タスク管理 |
| **開始点** | コードコミット | Issue作成 |
| **終了点** | 本番デプロイ | Productionマージ |
| **測定対象** | CI/CDの効率 | 開発作業の効率 |
| **データソース** | GitHub (PR, Deployments) | GitHub (Issues, PRs) |

### 指標の関係性

```
Issue作成 ─→ 着手 ─→ コーディング ─→ PR作成 ─→ マージ ─→ Productionマージ ─→ デプロイ
    │                              │                            │
    └──────── Cycle Time (本実装) ─┴──── Lead Time (DORA) ──────┘
```

### 全指標の比較

| 指標 | データソース | 測定対象 | フレームワーク |
|------|-------------|----------|---------------|
| **サイクルタイム** | GitHub Issues/PRs | Issue作成〜Productionマージ | Kanban/Agile |
| Lead Time for Changes | GitHub | コミット〜デプロイ | DORA |
| Deployment Frequency | GitHub | デプロイ回数 | DORA |
| Change Failure Rate | GitHub | デプロイ失敗率 | DORA |
| MTTR | GitHub / Issues | 障害復旧時間 | DORA |

### 使い分け

- **サイクルタイム**: チーム全体の生産性、タスク完了効率、WIP管理
- **Lead Time for Changes**: CI/CDパイプラインの効率、デリバリー速度

---

## 制約事項

1. **PRリンク必須**: IssueとPRが `Fixes #123` などでリンクされている必要あり
2. **API呼び出し回数**: Issue数 × (1 + リンクPR数 + PRチェーン深度)
3. **GAS実行時間制限**: 6分を超える場合は期間を短くするか、ラベルフィルタで対象を絞る
4. **PRチェーン深度**: 最大5段階まで追跡

### 対象外のIssue

以下のIssueはサイクルタイム計算から除外されます：

- PRにリンクされていないIssue
- Productionブランチにマージされていないリンクを持つIssue
- 計測期間外にProductionマージされたIssue

---

## トラブルシューティング

### Issueが取得されない

1. GitHub PAT の権限を確認（Issues: Read-only）
2. リポジトリが正しく登録されているか確認 (`listRepos()`)
3. 計測期間内にProductionマージされたIssueが存在するか確認

### サイクルタイムがnullになる

1. IssueとPRがリンクされているか確認（`Fixes #123` など）
2. PRがProductionブランチにマージされているか確認
3. Productionブランチパターンが正しいか確認 (`showProductionBranch()`)

### PRチェーンが検出されない

1. 各PRがマージ済みか確認
2. マージ方法を確認（squashマージの場合はマージコミットSHAが異なる）

---

## 出典・参考資料

### 公式ドキュメント

1. **Microsoft Azure DevOps - Cycle Time and Lead Time**
   - https://learn.microsoft.com/en-us/azure/devops/report/dashboards/cycle-time-and-lead-time
   - サイクルタイムとリードタイムの公式定義

2. **Atlassian Jira - Cycle Time Report**
   - https://support.atlassian.com/jira-software-cloud/docs/view-and-understand-your-cycle-time-report/
   - Jiraにおけるサイクルタイムの定義と計測方法

3. **Apache DevLake - Lead Time for Changes**
   - https://devlake.apache.org/docs/Metrics/LeadTimeForChanges/
   - DORAのLead Time for Changesの定義

### Kanban/Lean関連

4. **Kanban Tool - Cycle Time**
   - https://kanbantool.com/kanban-guide/cycle-time
   - Kanban文脈でのサイクルタイムの定義とWIPとの関係

### 書籍

5. **Accelerate: The Science of Lean Software and DevOps**
   - Nicole Forsgren, Jez Humble, Gene Kim 著
   - DORA研究の基礎となった書籍

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-01 | GitHub Issue/PRベースの計測方式に変更 |
