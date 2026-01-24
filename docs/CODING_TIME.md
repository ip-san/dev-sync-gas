# コーディング時間（Coding Time）実装ガイド

NotionのタスクデータとGitHub PRを連携して、コーディング時間を計測する機能の解説です。

---

## 目次

- [コーディング時間とは](#コーディング時間とは)
- [公式定義との比較](#公式定義との比較)
- [計測方法](#計測方法)
- [Notionの設定](#notionの設定)
- [使い方](#使い方)
- [出力データ](#出力データ)
- [サイクルタイムとの違い](#サイクルタイムとの違い)
- [制約事項](#制約事項)
- [出典・参考資料](#出典参考資料)

---

## コーディング時間とは

コーディング時間は、タスクの**着手からPR作成までの時間**を測定する指標です。

```
着手（Notion進行中）────────→ PR作成（GitHub）
        ↑                           ↑
   作業開始                    コード完成

   ←──────── コーディング時間 ────────→
```

### 公式定義

> **Coding Time** is the time elapsed from the first commit until the pull request is created. It's an indication of how long the developer was actively working on the code changes before submitting them for review.
>
> — [Multitudes - Coding Time](https://docs.multitudes.com/metrics-and-definitions/process-metrics/flow-of-work/coding-time)

> **Coding time** is calculated from the first commit to when a pull request or merge request is created.
>
> — [Hatica - Coding Time](https://www.hatica.io/docs/metrics/coding-time/)

### なぜコーディング時間を計測するのか

- **純粋な開発時間の可視化**: コードを書くのにかかった実時間を把握
- **AI支援の効果測定**: GitHub Copilot等のAIツール導入効果を定量化
- **見積もり精度の向上**: タスクサイズと実際の開発時間の相関を分析
- **ボトルネックの発見**: 特定タイプのタスクで時間がかかる傾向を特定

---

## 公式定義との比較

各ツール・フレームワークでのコーディング時間の定義と、本実装との対応を示します。

### 本実装の定義

| 開始点 | 終了点 | 計算式 |
|--------|--------|--------|
| Notionの着手日（Date Started） | GitHub PRの作成時刻（created_at） | PR作成時刻 - 着手日時 |

### 業界標準の定義

| ソース | 開始点 | 終了点 | 本実装との違い |
|--------|--------|--------|---------------|
| **Hatica** | 最初のコミット | PR作成 | ⚠️ 開始点が異なる |
| **Multitudes** | 最初のコミット | PR作成 | ⚠️ 開始点が異なる |
| **LinearB** | 最初のコミット | PR作成 | ⚠️ 開始点が異なる |

### 本実装の特徴

本実装では**Notionのタスク着手日**を開始点として使用しています。これは以下の理由によります：

1. **タスク管理との統合**: Notionでタスク管理を行うワークフローと親和性が高い
2. **実作業時間の測定**: コミット前の設計・調査時間も含めた開発時間を測定
3. **柔軟な開始点**: チームのワークフローに合わせて開始点を調整可能

> **Note**: 業界標準の「最初のコミット〜PR作成」を測定したい場合は、GitHubのみでの計測を検討してください（Apache DevLake、LinearB等のツールで可能）。

### SPACEフレームワークとの関連

コーディング時間は、Microsoft ResearchのSPACEフレームワークにおける**Activity（活動）** ディメンションに該当します。

> The SPACE framework includes five dimensions: **Satisfaction**, **Performance**, **Activity**, **Communication**, and **Efficiency**. Activity captures actions like coding time, commits, and code reviews.
>
> — [Microsoft Research - SPACE Framework](https://queue.acm.org/detail.cfm?id=3454124)

---

## 計測方法

### データソース

2つのデータソースを連携します：

| ソース | フィールド | 説明 |
|--------|-----------|------|
| **Notion** | `Date Started` | コーディング時間の開始点 |
| **Notion** | `PR URL` | GitHub PRへのリンク |
| **GitHub** | PR `created_at` | コーディング時間の終了点 |

### 計算式

```
コーディング時間 = PR作成時刻 - 着手時刻
```

### 統計値

| 指標 | 説明 |
|------|------|
| 平均（Average） | 全タスクのコーディング時間の平均値 |
| 中央値（Median） | ソート後の中央の値。外れ値の影響を受けにくい |
| 最小（Min） | 最も短いコーディング時間 |
| 最大（Max） | 最も長いコーディング時間 |

---

## Notionの設定

### 必要なプロパティ

Notionデータベースに以下のプロパティを追加してください：

| プロパティ名 | タイプ | 説明 |
|-------------|--------|------|
| `Date Started` | Date | タスクに着手した日時 |
| `PR URL` | URL | GitHub PRのURL |

> **Note**: プロパティ名の代替：
> - 着手日: `Started`, `着手日`, `開始日`
> - PR URL: `PR`, `Pull Request`, `GitHub PR`

### ワークフロー例

```
1. タスク作成
   └→ Issueやチケットから自動作成、または手動作成

2. 着手時
   └→ Date Started に現在日時を設定
   └→ ステータスを「進行中」に変更

3. PR作成時
   └→ GitHubでPRを作成
   └→ NotionにPR URLを記録

4. 計測
   └→ syncCodingTime() でデータを取得・集計
```

### PR URLの記録方法

#### 手動

1. GitHubでPRを作成
2. PRのURLをコピー
3. NotionタスクのPR URLプロパティに貼り付け

#### 自動化（推奨）

Notion APIやZapier/Make等を使用して自動連携：
- PRタイトルやブランチ名にNotionタスクIDを含める
- PR作成時にWebhookでNotionを更新

---

## 使い方

### 基本的な使い方

```javascript
// GASエディタで実行

// コーディング時間を計測
syncCodingTime();

// 着手日プロパティ名をカスタマイズ
syncCodingTime("着手日");
```

### オプション

```javascript
// タスク詳細をログで確認（デバッグ用）
showCodingTimeDetails();
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

2. **GitHub PAT**

リポジトリへの読み取り権限が必要です。

3. **Notionインテグレーションの権限**

対象データベースにインテグレーションを追加してください：
- データベース右上の「...」→「接続」→ インテグレーションを選択

---

## 出力データ

### スプレッドシート出力

2つのシートが作成されます：

#### 「Coding Time」シート（サマリー）

| Period | Task Count | Avg (hours) | Avg (days) | Median | Min | Max | Recorded At |
|--------|------------|-------------|------------|--------|-----|-----|-------------|
| 〜2024-01-31 | 12 | 6.5 | 0.3 | 4.0 | 1.0 | 24.0 | 2024-01-31T... |

#### 「Coding Time - Details」シート（タスク詳細）

| Task ID | Title | Started At | PR Created At | PR URL | Coding Time (hours) | Coding Time (days) |
|---------|-------|------------|---------------|--------|--------------------|--------------------|
| abc-123 | Implement feature X | 2024-01-10T10:00 | 2024-01-10T14:00 | https://github.com/... | 4.0 | 0.2 |

### ログ出力例

```
⌨️ Calculating Coding Time
📥 Fetched 12 tasks with PR URLs
📡 Fetching PR information from GitHub...
   Found 12 PRs
📊 Coding Time Results:
   Tasks with valid coding time: 12
   Average: 6.5 hours (0.3 days)
   Median: 4.0 hours
   Min: 1.0 hours
   Max: 24.0 hours
✅ Coding Time metrics synced
```

---

## サイクルタイムとの違い

### 比較表

| 観点 | コーディング時間 | サイクルタイム |
|------|-----------------|---------------|
| **開始点** | Notion着手時刻 | Notion着手時刻 |
| **終了点** | GitHub PR作成時刻 | Notion完了時刻 |
| **測定対象** | 純粋なコーディング | タスク全体の作業 |
| **含まれるもの** | 開発・実装 | 開発 + レビュー + 修正 + QA |
| **フレームワーク** | SPACE (Activity) | Kanban/Lean |

### 時系列での関係

```
着手 ──→ コーディング ──→ PR作成 ──→ レビュー ──→ マージ ──→ 完了
│                            │                              │
└──── コーディング時間 ───────┘                              │
│                                                           │
└────────────────── サイクルタイム ──────────────────────────┘
```

### 業界標準の分類

> Coding Time is the time between the first code commit and when a pull request is created. While Cycle Time is a broader measure that includes all phases from code commit through deployment.
>
> — [LinearB - Lead Time vs Cycle Time](https://linearb.io/blog/lead-time-vs-cycle-time)

### 使い分け

- **コーディング時間**: 開発効率の改善、AI支援ツールの効果測定、個人の生産性分析
- **サイクルタイム**: チーム全体のスループット、プロセス改善、WIP管理

### 推奨される目標値

| 指標 | 推奨値 | 出典 |
|------|--------|------|
| コーディング時間 | 4時間以内 | Hatica |
| サイクルタイム | 1-2日 | Kanban/Lean |

---

## 制約事項

1. **手動連携依存**: PR URLはNotionで手動設定が必要（自動化推奨）
2. **日時の精度**: Notionの日付プロパティの設定に依存
3. **GitHub API制限**: 多数のタスクがある場合、API呼び出し回数に注意

### 除外されるタスク

以下のタスクはコーディング時間計算から除外されます：

- 着手日（Date Started）が未設定
- PR URLが未設定
- PR URLが無効（GitHub PRとして認識できない）
- コーディング時間が負の値（PR作成後に着手日を設定した場合）

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
2. 日付プロパティ名が正しいか確認（`Date Started` など）
3. PR URLプロパティ名が正しいか確認（`PR URL` など）

### PRが取得できない

1. GitHub PATが有効か確認
2. PRが存在するリポジトリへのアクセス権があるか確認
3. PR URLの形式が正しいか確認（`https://github.com/owner/repo/pull/123`）

### コーディング時間が0件

- 負の値のタスク（PR作成 < 着手）はスキップされます
- 着手日時刻とPR作成時刻を確認してください

---

## 出典・参考資料

### 公式ドキュメント

1. **Microsoft Research - SPACE Framework**
   - https://queue.acm.org/detail.cfm?id=3454124
   - 開発者生産性の5つのディメンション（Satisfaction, Performance, Activity, Communication, Efficiency）を定義。コーディング時間はActivityディメンションに該当

2. **Microsoft Research - The SPACE of Developer Productivity**
   - https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/
   - SPACEフレームワークの原論文。開発者生産性の測定に関する包括的な研究

### エンジニアリングメトリクスツール

3. **Hatica - Coding Time**
   - https://www.hatica.io/docs/metrics/coding-time/
   - コーディング時間の定義: 最初のコミットからPR作成まで。推奨値は4時間以内

4. **Multitudes - Coding Time**
   - https://docs.multitudes.com/metrics-and-definitions/process-metrics/flow-of-work/coding-time
   - コーディング時間の定義と計測方法。Flow of Workメトリクスの一部として解説

5. **LinearB - Software Delivery Metrics**
   - https://linearb.io/blog/cycle-time
   - サイクルタイムの内訳としてのコーディング時間の解説

### 関連フレームワーク

6. **DORA - DevOps Research and Assessment**
   - https://dora.dev/
   - ソフトウェアデリバリーパフォーマンスの4つの主要指標を定義

7. **Apache DevLake - Engineering Metrics**
   - https://devlake.apache.org/docs/Metrics/
   - オープンソースのエンジニアリングメトリクスプラットフォーム。DORA指標とその他のメトリクスを統合

### 書籍

8. **Accelerate: The Science of Lean Software and DevOps**
   - Nicole Forsgren, Jez Humble, Gene Kim 著
   - DORA研究の基礎となった書籍。ソフトウェアデリバリーパフォーマンスと組織パフォーマンスの相関を解説

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-01 | 初版作成。Notion + GitHubベースのコーディング時間計測機能を追加 |
| 2025-01 | 公式定義との比較、出典・参考資料セクションを追加 |
