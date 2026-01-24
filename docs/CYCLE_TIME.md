# サイクルタイム（Cycle Time）実装ガイド

Notionのタスク管理データを使用して、サイクルタイムを計測する機能の解説です。

---

## 目次

- [サイクルタイムとは](#サイクルタイムとは)
- [公式定義との比較](#公式定義との比較)
- [計測方法](#計測方法)
- [Notionの設定](#notionの設定)
- [使い方](#使い方)
- [出力データ](#出力データ)
- [DORA Metricsとの違い](#dora-metricsとの違い)
- [出典・参考資料](#出典参考資料)

---

## サイクルタイムとは

サイクルタイムは、タスクの**着手から完了までの時間**を測定する指標です。

```
着手（Date Started）───────────→ 完了（Date Done）
        ↑                              ↑
   作業開始                      タスク完了

   ←──────── サイクルタイム ────────→
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

## 公式定義との比較

各ツール・フレームワークでのサイクルタイムの定義と、本実装との対応を示します。

### 本実装の定義

| 開始点 | 終了点 | 計算式 |
|--------|--------|--------|
| Notionの着手日（Date Started） | Notionの完了日（Date Done） | 完了日時 - 着手日時 |

### 各ツールの定義

| ソース | 開始点 | 終了点 | 本実装との一致度 |
|--------|--------|--------|-----------------|
| **Azure DevOps** | 作業開始（In Progress） | 完了（Done） | ✅ 一致 |
| **Atlassian Jira** | In Progress状態 | Done状態 | ✅ 一致 |
| **Kanban/Lean** | in-progress列 | done列 | ✅ 一致 |
| **GitLab** | MRでのIssue参照 | Issueクローズ | ⚠️ 異なる（コード中心） |

### Kanban/Leanにおけるサイクルタイム

トヨタ生産方式（TPS）を起源とするKanbanでは、サイクルタイムはWIP（仕掛品）と密接に関連しています：

> The larger the count of "in progress" items, the longer the cycle time. That is one of the reasons why Kanban seeks to limit WIP.
>
> — [Kanban Tool](https://kanbantool.com/kanban-guide/cycle-time)

本実装は、**Kanban/Agile文脈でのサイクルタイム**（着手〜完了）を採用しています。

---

## 計測方法

### データソース

Notionデータベースから以下のフィールドを取得します：

| フィールド | Notionプロパティ名 | 説明 |
|-----------|-------------------|------|
| 着手日 | `Date Started` / `Started` / `着手日` / `開始日` | サイクルタイムの開始点 |
| 完了日 | `Date Done` / `Completed` / `完了日` / `Done` | サイクルタイムの終了点 |

### 計算式

```
サイクルタイム = 完了日時 - 着手日時
```

### 統計値

| 指標 | 説明 |
|------|------|
| 平均（Average） | 全タスクのサイクルタイムの平均値 |
| 中央値（Median） | ソート後の中央の値。外れ値の影響を受けにくい |
| 最小（Min） | 最も短いサイクルタイム |
| 最大（Max） | 最も長いサイクルタイム |

---

## Notionの設定

### 必要なプロパティ

Notionデータベースに以下のDateプロパティを追加してください：

| プロパティ名 | タイプ | 説明 |
|-------------|--------|------|
| `Date Started` | Date | タスクに着手した日時 |
| `Date Done` | Date | タスクが完了した日時 |

> **Note**: 日本語名（`着手日`、`完了日`）でも認識されます。

### 推奨: 数式プロパティ

Notion上でサイクルタイムを自動計算する数式を追加することもできます：

```
// Cycle Time (days)
if(and(prop("Date Started"), prop("Date Done")),
  dateBetween(prop("Date Done"), prop("Date Started"), "days"),
  0
)
```

### ワークフロー例

```
1. タスク作成
   └→ Issueやチケットから自動作成、または手動作成

2. 着手時
   └→ Date Started に現在日時を設定

3. 完了時
   └→ Date Done に現在日時を設定
   └→ ステータスを Done に変更

4. 計測
   └→ syncCycleTime() でデータを取得・集計
```

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
// 完了日プロパティ名をカスタマイズ
syncCycleTime(30, "完了日");

// タスク詳細をログで確認（デバッグ用）
showCycleTimeDetails(30);
```

### 前提条件

1. **Notion連携の設定が必要**

```javascript
// setup() で Notion Token と Database ID を設定
setup(
  'ghp_xxxx',           // GitHub PAT
  'spreadsheet-id',     // Google Spreadsheet ID
  'secret_xxxx',        // Notion Token ← 必須
  'database-id'         // Notion Database ID ← 必須
);
```

2. **Notionインテグレーションの権限**

対象データベースにインテグレーションを追加してください：
- データベース右上の「...」→「接続」→ インテグレーションを選択

---

## 出力データ

### スプレッドシート出力

2つのシートが作成されます：

#### 「Cycle Time」シート（サマリー）

| Period | Completed Tasks | Avg (hours) | Avg (days) | Median | Min | Max | Recorded At |
|--------|-----------------|-------------|------------|--------|-----|-----|-------------|
| 2024-01-01〜2024-01-31 | 15 | 48.5 | 2.0 | 36.0 | 4.0 | 120.0 | 2024-01-31T... |

#### 「Cycle Time - Details」シート（タスク詳細）

| Task ID | Title | Started At | Completed At | Cycle Time (hours) | Cycle Time (days) |
|---------|-------|------------|--------------|-------------------|------------------|
| abc-123 | Implement feature X | 2024-01-10T10:00 | 2024-01-11T14:00 | 28.0 | 1.2 |

### ログ出力例

```
⏱️ Calculating Cycle Time for 30 days
   Period: 2024-01-01〜2024-01-31
📥 Fetched 15 tasks with cycle time data
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
| **開始点** | コードコミット | タスク着手 |
| **終了点** | 本番デプロイ | タスク完了 |
| **測定対象** | CI/CDの効率 | 開発作業の効率 |
| **データソース** | GitHub (PR, Deployments) | Notion |

### 指標の関係性

```
タスク作成 ─→ 着手 ─────────→ コーディング ─→ PR作成 ─→ マージ ─→ デプロイ ─→ 完了
              │                              │                    │
              └──── Cycle Time (本実装) ─────┴── Lead Time (DORA) ┘
```

### 全指標の比較

| 指標 | データソース | 測定対象 | フレームワーク |
|------|-------------|----------|---------------|
| **サイクルタイム** | Notion | タスク着手〜完了 | Kanban/Agile |
| Lead Time for Changes | GitHub | コミット〜デプロイ | DORA |
| Deployment Frequency | GitHub | デプロイ回数 | DORA |
| Change Failure Rate | GitHub | デプロイ失敗率 | DORA |
| MTTR | GitHub / Issues | 障害復旧時間 | DORA |

### 使い分け

- **サイクルタイム**: チーム全体の生産性、タスク完了効率、WIP管理
- **Lead Time for Changes**: CI/CDパイプラインの効率、デリバリー速度

---

## 制約事項

1. **手動入力依存**: 着手日・完了日はNotionで手動設定が必要
2. **日時の精度**: Notionの日付プロパティの設定（日付のみ/日時）に依存
3. **Notion API制限**: 一度に100件までのタスクを取得

### 対象外のタスク

以下のタスクはサイクルタイム計算から除外されます：

- 着手日（Date Started）が未設定
- 完了日（Date Done）が未設定
- 計測期間外に完了したタスク

---

## トラブルシューティング

### 「Notion integration is not configured」エラー

```javascript
// Notion設定を確認
const config = getConfig();
console.log(config.notion);
```

Notion Token と Database ID が設定されているか確認してください。

### タスクが取得されない

1. Notionインテグレーションがデータベースに接続されているか確認
2. 日付プロパティ名が正しいか確認（`Date Started`, `Date Done` など）
3. 計測期間内に完了日があるタスクが存在するか確認

### サイクルタイムが異常に長い/短い

- Notionの日付プロパティで「時刻を含める」設定を確認
- 日付のみの場合、00:00:00として計算されます

---

## 出典・参考資料

### 公式ドキュメント

1. **Microsoft Azure DevOps - Cycle Time and Lead Time**
   - https://learn.microsoft.com/en-us/azure/devops/report/dashboards/cycle-time-and-lead-time
   - サイクルタイムとリードタイムの公式定義。本実装の定義はこれに準拠

2. **Atlassian Jira - Cycle Time Report**
   - https://support.atlassian.com/jira-software-cloud/docs/view-and-understand-your-cycle-time-report/
   - Jiraにおけるサイクルタイムの定義と計測方法

3. **GitLab - Value Stream Analytics**
   - https://docs.gitlab.com/user/group/value_stream_analytics/
   - GitLabにおけるサイクルタイムの定義（MR参照〜Issueクローズ）

4. **Apache DevLake - Lead Time for Changes**
   - https://devlake.apache.org/docs/Metrics/LeadTimeForChanges/
   - DORAのLead Time for Changesの定義。*Accelerate* 書籍からの引用を含む

### Kanban/Lean関連

5. **Kanban Tool - Cycle Time**
   - https://kanbantool.com/kanban-guide/cycle-time
   - Kanban文脈でのサイクルタイムの定義とWIPとの関係

### 比較・解説記事

6. **LinearB - Lead Time vs Cycle Time**
   - https://linearb.io/blog/lead-time-vs-cycle-time
   - ソフトウェア開発におけるリードタイムとサイクルタイムの比較

### 書籍

7. **Accelerate: The Science of Lean Software and DevOps**
   - Nicole Forsgren, Jez Humble, Gene Kim 著
   - DORA研究の基礎となった書籍。Lead Time for Changesの公式定義を含む

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-01 | 初版作成。Notionベースのサイクルタイム計測機能を追加 |
