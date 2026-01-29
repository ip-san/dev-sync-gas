# コーディング時間（Coding Time）実装ガイド

GitHub IssueとPRを連携して、コーディング時間を計測する機能の解説です。

---

## 目次

- [コーディング時間とは](#コーディング時間とは)
- [公式定義との比較](#公式定義との比較)
- [計測方法](#計測方法)
- [使い方](#使い方)
- [出力データ](#出力データ)
- [サイクルタイムとの違い](#サイクルタイムとの違い)
- [設定オプション](#設定オプション)
- [制約事項](#制約事項)
- [出典・参考資料](#出典参考資料)

---

## コーディング時間とは

コーディング時間は、**Issue作成からPR作成までの時間**を測定する指標です。

```
Issue作成（GitHub）────────→ PR作成（GitHub）
        ↑                           ↑
   タスク起票                  コード完成

   ←──────── コーディング時間 ────────→
```

### 公式定義

> **Coding Time** is the time elapsed from the first commit until the pull request is created. It's an indication of how long the developer was actively working on the code changes before submitting them for review.
>
> — [Multitudes - Coding Time](https://docs.multitudes.com/metrics-and-definitions/process-metrics/flow-of-work/coding-time)

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
| GitHub Issue作成日時（`created_at`） | リンクされたPRの作成日時（`created_at`） | PR作成時刻 - Issue作成時刻 |

### 業界標準の定義

| ソース | 開始点 | 終了点 | 本実装との違い |
|--------|--------|--------|---------------|
| **Hatica** | 最初のコミット | PR作成 | ⚠️ 開始点が異なる |
| **Multitudes** | 最初のコミット | PR作成 | ⚠️ 開始点が異なる |
| **LinearB** | 最初のコミット | PR作成 | ⚠️ 開始点が異なる |

### 本実装の特徴

本実装では**GitHub Issue作成日時**を開始点として使用しています。これは以下の理由によります：

1. **GitHub完結**: 外部ツール連携が不要
2. **サイクルタイムとの一貫性**: サイクルタイムと同様にIssue起点で計測
3. **Issue-PR連携**: `Fixes #123` などのキーワードで自動的にIssueとPRがリンク

### SPACEフレームワークとの関連

コーディング時間は、Microsoft ResearchのSPACEフレームワークにおける**Activity（活動）** ディメンションに該当します。

> The SPACE framework includes five dimensions: **Satisfaction**, **Performance**, **Activity**, **Communication**, and **Efficiency**. Activity captures actions like coding time, commits, and code reviews.
>
> — [Microsoft Research - SPACE Framework](https://queue.acm.org/detail.cfm?id=3454124)

---

## 計測方法

### データソース

GitHubのデータのみを使用します：

| ソース | フィールド | 説明 |
|--------|-----------|------|
| **GitHub Issue** | `created_at` | コーディング時間の開始点 |
| **GitHub PR** | `created_at` | コーディング時間の終了点 |
| **GitHub Timeline** | `cross-referenced` | IssueとPRのリンク検出 |

### Issue-PRリンクの検出

以下の方法でIssueとPRがリンクされている場合に計測対象となります：

```markdown
# PR本文またはコミットメッセージに以下のキーワードを含める

Fixes #123
Closes #123
Resolves #123
```

### 計算式

```
コーディング時間 = PR作成時刻 - Issue作成時刻
```

### 統計値

| 指標 | 説明 |
|------|------|
| 平均（Average） | 全Issueのコーディング時間の平均値 |
| 中央値（Median） | ソート後の中央の値。外れ値の影響を受けにくい |
| 最小（Min） | 最も短いコーディング時間 |
| 最大（Max） | 最も長いコーディング時間 |

---

## 使い方

### 基本的な使い方

```javascript
// GASエディタで実行

// 過去30日間のコーディング時間を計測
syncCodingTime();

// 過去7日間のコーディング時間を計測
syncCodingTime(7);

// 過去90日間のコーディング時間を計測
syncCodingTime(90);
```

### デバッグ用

```javascript
// Issue詳細をログで確認
showCodingTimeDetails();

// 過去7日間のIssue詳細をログで確認
showCodingTimeDetails(7);
```

### 前提条件

1. **GitHub認証の設定が必要**

```javascript
// setup() で GitHub Token を設定
setup(
  'ghp_xxxx',           // GitHub PAT
  'spreadsheet-id'      // Google Spreadsheet ID
);

// または GitHub Apps認証
setupWithGitHubApp(
  'app-id',
  'private-key',
  'installation-id',
  'spreadsheet-id'
);
```

2. **リポジトリの登録**

```javascript
addRepo('owner', 'repo-name');
```

---

## 出力データ

### スプレッドシート出力

2つのシートが作成されます：

#### 「コーディング時間」シート（サマリー）

| 期間 | Issue数 | 平均 (時間) | 平均 (日) | 中央値 | 最小 | 最大 | 記録日時 |
|------|---------|-------------|-----------|--------|------|------|----------|
| 2024-01-01〜2024-01-31 | 12 | 6.5 | 0.3 | 4.0 | 1.0 | 24.0 | 2024-01-31T... |

#### 「コーディング時間 - Details」シート（Issue詳細）

| Issue番号 | タイトル | リポジトリ | Issue作成日時 | PR作成日時 | PR番号 | コーディング時間 (時間) | コーディング時間 (日) |
|-----------|----------|------------|---------------|------------|--------|------------------------|----------------------|
| #123 | Implement feature X | owner/repo | 2024-01-10T10:00 | 2024-01-10T14:00 | #125 | 4.0 | 0.2 |

### ログ出力例

```
⌨️ Calculating Coding Time (GitHub) for 30 days
   Period: 2024-01-01〜2024-01-31
   Issue labels: (all issues)
🔍 Processing owner/repo for coding time...
  📋 Fetching issues from owner/repo...
  ✅ Found 15 issues
  📌 Processing Issue #123: Implement feature X
    🔗 Found 1 linked PRs: 125
    ✅ Coding time: 4.0h (Issue → PR #125)
📥 Fetched 15 issues
📊 Coding Time Results:
   Issues with linked PRs: 12
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
| **開始点** | Issue作成時刻 | Issue作成時刻 |
| **終了点** | PR作成時刻 | productionブランチへのマージ時刻 |
| **測定対象** | 純粋なコーディング | タスク全体の完了 |
| **含まれるもの** | 開発・実装 | 開発 + レビュー + マージ + デプロイ |
| **フレームワーク** | SPACE (Activity) | Kanban/Lean |

### 時系列での関係

```
Issue作成 ──→ コーディング ──→ PR作成 ──→ レビュー ──→ productionマージ
│                              │                              │
└──── コーディング時間 ────────┘                              │
│                                                             │
└────────────────── サイクルタイム ───────────────────────────┘
```

### 使い分け

- **コーディング時間**: 開発効率の改善、AI支援ツールの効果測定、個人の生産性分析
- **サイクルタイム**: チーム全体のスループット、プロセス改善、リリース頻度の最適化

### 推奨される目標値

| 指標 | 推奨値 | 出典 |
|------|--------|------|
| コーディング時間 | 4時間以内 | Hatica |
| サイクルタイム | 1-2日 | Kanban/Lean |

---

## 設定オプション

### Issueラベルのフィルタ

特定のラベルを持つIssueのみを計測対象にできます：

```javascript
// "feature" と "enhancement" ラベルを持つIssueのみ計測
configureCodingTimeLabels(["feature", "enhancement"]);

// 全Issueを対象にする
configureCodingTimeLabels([]);

// 現在の設定を確認
showCodingTimeLabels();

// 設定をリセット
resetCodingTimeLabelsConfig();
```

### 設定の一覧表示

```javascript
// コーディングタイム設定を一覧表示
showCodingTimeConfig();
```

---

## 制約事項

### API呼び出し回数

コーディング時間の計測には以下のAPI呼び出しが発生します：

```
Issue数 × (1 + リンクPR数)
```

GASの実行時間制限（6分）を考慮し、大量のIssueがある場合は期間を短く設定してください。

### 除外されるIssue

以下のIssueはコーディング時間計算から除外されます：

- リンクされたPRがない
- PRの取得に失敗した
- コーディング時間が負の値（Issue作成前にPRが存在する場合）

### Issue-PRリンクの検出

以下の場合のみリンクが検出されます：

- PRの本文またはコミットメッセージに `Fixes #123`, `Closes #123`, `Resolves #123` などのキーワードが含まれる
- 同じリポジトリ内のIssueとPR

---

## トラブルシューティング

### 「GitHub authentication is not configured」エラー

```javascript
// 認証モードを確認
showAuthMode();
```

GitHub Token または GitHub Apps認証が設定されているか確認してください。

### Issueが取得されない

1. GitHub PATが有効か確認
2. リポジトリへのアクセス権があるか確認
3. 対象期間内にIssueがあるか確認

### リンクPRが検出されない

1. PR本文に `Fixes #123` などのキーワードが含まれているか確認
2. 同じリポジトリ内のIssueとPRか確認
3. Timeline APIの結果を確認

### コーディング時間が0件

- リンクPRがないIssueはスキップされます
- 負の値（Issue作成前にPRが存在）はスキップされます

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
| 2025-01 | GitHub完結版として実装。Issue作成日時を開始点に使用 |
