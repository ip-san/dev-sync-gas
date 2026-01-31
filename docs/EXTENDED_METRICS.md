# 🎯 拡張指標

**AI時代の開発生産性を測る拡張指標**の定義と、GitHubデータを使った計算方法を説明します。

DORA指標に加えて、以下の5つの拡張指標を自動計測します。

```
Issue作成 ─→ PR作成 ─→ レビュー ─→ マージ ─→ Productionマージ
    │           │                       │              │
    └ コーディング┘                       │              │
    └────────── サイクルタイム ────────────────────────┘
                └─ 手戻り ─┘
                └ レビュー効率 ┘
                └ PRサイズ ┘
```

> **参考**: [計測思想](MEASUREMENT_PHILOSOPHY.md) - なぜIssue作成から計測するか

---

## 🔄 1. サイクルタイム（Cycle Time）

**Issue作成からProductionマージまでの時間**を計測します。

### 📝 定義

タスク起票（Issue作成）から、本番環境への反映（Productionマージ）までの全体の時間。

### 🔢 GitHubでの計算方法

1. IssueとPRのリンクを検出（PR本文の `Fixes #123` など）
2. PRがProductionブランチにマージされているか確認
3. `Issue作成日時` → `Productionマージ日時` の経過時間（時間単位）を計算
4. 全Issueの平均・中央値を算出

```javascript
cycleTime = (productionMergedAt - issueCreatedAt) / (1000 * 60 * 60); // 時間
```

### PRチェーン追跡

多段階マージ（feature→main→staging→production）に対応：

```
Issue #123 作成
    ↓
PR1 (feature→main) ← "Fixes #123" でリンク
    ↓ マージコミットSHA
PR2 (main→staging)
    ↓ マージコミットSHA
PR3 (staging→production) ← このマージ日 = 完了日
```

最大5段階まで追跡します。

### 出力例

#### サマリーシート

| 期間 | 完了タスク数 | 平均 (時間) | 中央値 | 最小 | 最大 |
|------|-------------|-------------|--------|------|------|
| 2024-01-01〜01-31 | 15 | 48.5 | 36.0 | 4.0 | 120.0 |

#### 詳細シート

| Issue番号 | タイトル | リポジトリ | Issue作成日時 | マージ日時 | サイクルタイム (時間) | PRチェーン |
|-----------|---------|-----------|--------------|-----------|---------------------|-----------|
| #123 | Feature X | org/repo | 2024-01-10T10:00 | 2024-01-11T14:00 | 28.0 | #1→#2→#3 |

### 設定

```javascript
// 過去30日間のサイクルタイムを計測（デフォルト）
syncCycleTime();

// 過去90日間
syncCycleTime(90);

// Productionブランチパターンを設定
configureProductionBranch("production");  // デフォルト
configureProductionBranch("release");

// ラベルフィルタ（特定のラベルのみ計測）
configureCycleTimeLabels(["feature", "bug"]);

// 設定確認
showCycleTimeConfig();
```

詳細は [CYCLE_TIME.md](CYCLE_TIME.md) を参照。

---

## ⌨️ 2. コーディング時間（Coding Time）

**Issue作成からPR作成までの時間**を計測します。

### 📝 定義

タスク起票（Issue作成）から、コード完成（PR作成）までの純粋なコーディング時間。

### 🔢 GitHubでの計算方法

1. IssueとPRのリンクを検出（PR本文の `Fixes #123` など）
2. `Issue作成日時` → `PR作成日時` の経過時間（時間単位）を計算
3. 全Issueの平均・中央値を算出

```javascript
codingTime = (prCreatedAt - issueCreatedAt) / (1000 * 60 * 60); // 時間
```

### 出力例

#### サマリーシート

| 期間 | Issue数 | 平均 (時間) | 中央値 | 最小 | 最大 |
|------|---------|-------------|--------|------|------|
| 2024-01-01〜01-31 | 12 | 6.5 | 4.0 | 1.0 | 24.0 |

#### 詳細シート

| Issue番号 | タイトル | リポジトリ | Issue作成日時 | PR作成日時 | PR番号 | コーディング時間 (時間) |
|-----------|----------|------------|---------------|------------|--------|------------------------|
| #123 | Feature X | owner/repo | 2024-01-10T10:00 | 2024-01-10T14:00 | #125 | 4.0 |

### 設定

```javascript
// 過去30日間のコーディング時間を計測（デフォルト）
syncCodingTime();

// 過去90日間
syncCodingTime(90);

// ラベルフィルタ
configureCodingTimeLabels(["feature", "enhancement"]);

// 設定確認
showCodingTimeConfig();
```

### 使い分け

- **コーディング時間**: AI支援ツールの効果測定、個人の生産性分析
- **サイクルタイム**: チーム全体のスループット、プロセス改善

詳細は [CODING_TIME.md](CODING_TIME.md) を参照。

---

## 🔁 3. 手戻り率（Rework Rate）

**PRマージ後の追加コミット・Force Pushの回数**を計測します。

### 📝 定義

PRレビュー中に発生した修正作業の量を、追加コミット数とForce Push回数で評価。

### 🔢 GitHubでの計算方法

#### 追加コミット数

```
GET /repos/{owner}/{repo}/pulls/{number}/commits
```

- PR内の総コミット数をカウント
- 1コミットでマージされた場合は「手戻りなし」

#### Force Push回数

```
GET /repos/{owner}/{repo}/pulls/{number}/events
```

- イベントタイプが `head_ref_force_pushed` の回数をカウント

### 出力例

| PR番号 | タイトル | 追加コミット数 | Force Push回数 | 手戻り率 |
|--------|---------|---------------|---------------|---------|
| #123 | Feature X | 3 | 1 | 中 |

### 評価基準（目安）

| 手戻り率 | 追加コミット | Force Push |
|---------|-------------|-----------|
| **低** | 1-2 | 0 |
| **中** | 3-5 | 1-2 |
| **高** | 6以上 | 3以上 |

---

## 👀 4. レビュー効率（Review Efficiency）

**レビュー待ち時間とレビュー時間**を計測します。

### 📝 定義

- **レビュー待ち時間**: PR作成から最初のレビューまでの時間
- **レビュー時間**: 最初のレビューからマージまでの時間

### 🔢 GitHubでの計算方法

```
GET /repos/{owner}/{repo}/pulls/{number}/reviews
```

```
PR作成 ─→ 最初のレビュー ─→ マージ
   │             │              │
   └ レビュー待ち┘              │
                └ レビュー時間 ─┘
```

```javascript
reviewWaitTime = (firstReviewAt - prCreatedAt) / (1000 * 60 * 60); // 時間
reviewTime = (mergedAt - firstReviewAt) / (1000 * 60 * 60); // 時間
```

### 出力例

| PR番号 | タイトル | レビュー待ち (時間) | レビュー時間 (時間) | 総時間 |
|--------|---------|-------------------|-------------------|--------|
| #123 | Feature X | 2.5 | 4.0 | 6.5 |

### ボトルネック分析

- **レビュー待ちが長い**: レビュアーのアサイン・通知が機能していない
- **レビュー時間が長い**: PRが大きすぎる、複雑すぎる、議論が必要

---

## 📏 5. PRサイズ（Pull Request Size）

**変更行数・変更ファイル数**を計測します。

### 📝 定義

PRの規模を、追加行数・削除行数・変更ファイル数で評価。

### 🔢 GitHubでの計算方法

```
GET /repos/{owner}/{repo}/pulls/{number}
```

- `additions`: 追加行数
- `deletions`: 削除行数
- `changed_files`: 変更ファイル数

### 出力例

| PR番号 | タイトル | 追加行 | 削除行 | 変更ファイル | サイズ分類 |
|--------|---------|--------|--------|------------|----------|
| #123 | Feature X | 250 | 50 | 8 | L |

### サイズ分類（目安）

| サイズ | 変更行数 | 変更ファイル |
|-------|---------|------------|
| **XS** | 1-50 | 1-2 |
| **S** | 51-200 | 3-5 |
| **M** | 201-500 | 6-10 |
| **L** | 501-1000 | 11-20 |
| **XL** | 1000+ | 20+ |

### ベストプラクティス

- 小さいPRほどレビューが速く、マージ率が高い
- 目安: 1PR = 200-400行以内
- 大きなPRは分割を検討

---

## 🔗 全体の関係性

### 📊 DORA指標との違い

| 指標 | 起点 | 終点 | 視点 |
|------|------|------|------|
| **DORA: Lead Time** | PR作成 | デプロイ | CI/CDパイプライン |
| **サイクルタイム** | Issue作成 | Productionマージ | タスク管理 |
| **コーディング時間** | Issue作成 | PR作成 | 実装速度 |
| **手戻り率** | - | - | コード品質 |
| **レビュー効率** | PR作成 | マージ | レビュープロセス |
| **PRサイズ** | - | - | 複雑さ |

### 改善サイクル

```
1. サイクルタイムでボトルネックを発見
    ↓
2. コーディング時間・レビュー効率で原因を特定
    ↓
3. 手戻り率・PRサイズで品質・複雑さを評価
    ↓
4. プロセス改善（AI活用、レビュー体制、PR分割）
    ↓
5. DORA指標で全体的な改善を確認
```

---

## 🚀 使い方

### 📋 基本

```javascript
// サイクルタイム
syncCycleTime();

// コーディング時間
syncCodingTime();

// 全プロジェクトを同期（DORA + 拡張指標）
syncAllProjects();
```

### 日次バックフィル

```javascript
// 過去30日分を日次で集計
syncDailyBackfill(30);

// 過去90日分
syncDailyBackfill(90);
```

---

## GitHubデータの前提条件

### 必須

| 指標 | 必要なGitHub設定 |
|------|-----------------|
| **サイクルタイム** | IssueとPRのリンク（`Fixes #123`） |
| **コーディング時間** | IssueとPRのリンク |
| **手戻り率** | PR運用 |
| **レビュー効率** | PR レビュー運用 |
| **PRサイズ** | PR運用 |

### 推奨

- Issue駆動開発（タスク管理とコードを連携）
- PR運用（レビュー・マージフロー）
- ラベル運用（"feature", "bug", "incident"）

---

## トラブルシューティング

### サイクルタイムが計測されない

- IssueとPRがリンクされているか確認（`Fixes #123` など）
- PRがProductionブランチにマージされているか確認
- `showProductionBranch()` でブランチパターンを確認

### コーディング時間がゼロ

- リンクPRがないIssueはスキップされます
- 負の値（Issue作成前にPRが存在）はスキップされます

### 手戻り率・レビュー効率が取得できない

- PRにコミット・レビューが存在するか確認
- GitHub PATの権限を確認（`repo`）

---

## 参考資料

- [SPACE Framework](https://queue.acm.org/detail.cfm?id=3454124) - Microsoft Research
- [Azure DevOps - Cycle Time](https://learn.microsoft.com/en-us/azure/devops/report/dashboards/cycle-time-and-lead-time)
- [Kanban Guide for Scrum Teams](https://www.scrum.org/resources/kanban-guide-scrum-teams)
- [計測思想](MEASUREMENT_PHILOSOPHY.md) - なぜIssue作成から計測するか
