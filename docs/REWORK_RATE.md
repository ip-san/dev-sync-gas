# 手戻り率（Rework Rate）実装ガイド

GitHubのPRデータを使用して、手戻り率を計測する機能の解説です。

---

## 目次

1. [概要](#概要)
2. [なぜこの指標を選んだか](#なぜこの指標を選んだか)
3. [業界標準との比較](#業界標準との比較)
4. [AI活用での活用方法](#ai活用での活用方法)
5. [計測方法](#計測方法)
6. [使い方](#使い方)
7. [出力データ](#出力データ)
8. [制約事項と将来の拡張](#制約事項と将来の拡張)
9. [出典・参考資料](#出典参考資料)

---

## 概要

### 手戻り率とは

手戻り率は、PR作成後の**追加コミット数**と**Force Push回数**を測定する指標です。

```
PR作成 ───→ レビュー ───→ 修正 ───→ マージ
     ↑                    ↑
   最初の状態          追加コミット / Force Push
                       （= 手戻り）
```

### 計測する指標

| 指標 | 定義 | 計算方法 |
|------|------|----------|
| **追加コミット数** | PR作成後のコミット数 | コミット日時 > PR作成日時 |
| **Force Push回数** | PRブランチへのforce push回数 | Timeline APIの`head_ref_force_pushed`イベント |

### なぜ計測するのか

- **コードレビュー効率の可視化**: レビュー指摘への対応量を把握
- **初回コード品質の測定**: 最初のコミットの完成度を評価
- **プロセス改善**: 要件不明確やレビュー遅延の発見
- **AI活用効果の測定**: AIコーディング導入前後の比較

---

## なぜこの指標を選んだか

### 業界標準はLOC（行数）ベース

多くのツールは**書き換えられたコード行数**で手戻りを測定します：

| ツール | 定義 |
|--------|------|
| Code Climate | 30日以内に書き換えられたコード（LOC） |
| Hatica | コードの編集頻度（ファイル単位） |
| LinearB | 新規コードに対する修正の割合（LOC） |

### 本実装がコミット数を選んだ理由

**1. シンプルな計測**
- GitHub APIから直接取得可能
- LOC差分計算の複雑さを回避

**2. レビューフローとの親和性**
- PRレビューでの指摘対応を直接測定
- 「何回修正したか」が明確

**3. AI活用効果の測定に適している**
- AIでコーディング → 初回品質向上 → レビュー指摘減少 → 追加コミット減少
- この因果関係を測定可能

### 注意すべきトレードオフ

| 観点 | LOCベース | コミットベース（本実装） |
|------|-----------|------------------------|
| 修正規模 | ✅ 測定可能 | ❌ 測定不可 |
| 計測の容易さ | ❌ 複雑 | ✅ シンプル |
| 解釈のしやすさ | △ 専門知識が必要 | ✅ 直感的 |
| コミット粒度の影響 | ❌ なし | ⚠️ あり |

**コミット粒度の影響**: 「1コミット = 大きな修正」と「10コミット = 小さな修正」が区別できません。チーム内でコミット粒度のルールを統一することを推奨します。

---

## 業界標準との比較

### SPACEフレームワークとの関連

手戻り率は、Microsoft ResearchのSPACEフレームワークにおける**Efficiency and Flow（効率とフロー）** ディメンションに該当します。

> Effective collaboration can drive down the need for some individual activities (e.g., unnecessary code reviews and **rework**).
>
> — [Microsoft Research - SPACE Framework](https://queue.acm.org/detail.cfm?id=3454124)

### 公式定義の引用

> **Rework**, also known as code churn, represents efficiency at the coding level. Rework is when an engineer rewrites or deletes their own code that is less than 30 days old.
>
> — [Code Climate Velocity](https://docs.velocity.codeclimate.com/en/articles/2913574-rework)

> **Code churn** (also interchangeably known as rework) is a metric that indicates how often a given piece of code gets edited.
>
> — [Hatica](https://www.hatica.io/blog/code-churn-rate/)

### 推奨される目標値

| 指標 | 推奨値 | 出典 |
|------|--------|------|
| Rework Rate（LOCベース） | 9-14%（シニア） | Code Climate |
| Code Churn（全体） | 15-25% | Hatica |
| **追加コミット数（本実装）** | **2-3以下/PR** | 本実装推奨 |

---

## AI活用での活用方法

### 期待される効果

AIコーディングツール（GitHub Copilot、Claude等）を活用することで、以下の効果が期待できます：

```
AI活用前                    AI活用後
─────────────────────────────────────────
追加コミット: 3-5/PR   →   1-2/PR
Force Push: 頻繁       →   減少
```

### 測定の観点

| 観点 | 説明 |
|------|------|
| **初回品質の向上** | AIが生成するコードの品質が高ければ、レビュー指摘が減少 |
| **レビュー対応の効率化** | 指摘への修正もAIで行えば、修正の質が向上 |
| **学習効果** | AIの提案を学ぶことで、エンジニア自身のコード品質も向上 |

### AI活用特有の考慮事項

1. **コミット粒度の変化**
   - AIが生成したコードをそのままコミット → 追加コミット0も可能
   - ただしレビュー後の修正は発生する

2. **Force Pushの意味**
   - 一般的には「履歴整理」（squash/rebase）
   - AI活用との直接関係は薄いが、「やり直し」の頻度として有用

3. **チーム比較時の注意**
   - AI活用度合いが異なるチーム間での単純比較は避ける
   - 同一チームの時系列比較を推奨

### 補完指標の検討

将来的に以下の指標を追加することで、より詳細な分析が可能になります：

| 指標 | 説明 | 実装難易度 |
|------|------|-----------|
| 追加コミットのLOC合計 | 修正規模の測定 | 中 |
| レビューコメント数 | 指摘数の直接測定 | 低（GitHub API対応） |
| 修正までの時間 | レビュー対応速度 | 低 |

---

## 計測方法

### データソース

GitHub APIから以下のデータを取得します：

| エンドポイント | 取得データ | 用途 |
|---------------|-----------|------|
| `GET /repos/{owner}/{repo}/pulls` | PR一覧 | 対象PRの取得 |
| `GET /repos/{owner}/{repo}/pulls/{number}/commits` | コミット一覧 | 追加コミントのカウント |
| `GET /repos/{owner}/{repo}/issues/{number}/timeline` | タイムライン | Force Pushイベントの検出 |

### 計算式

```
追加コミット数 = コミット日時 > PR作成日時 のコミット数

Force Push率 = Force Pushが発生したPR数 / 全PR数 × 100
```

### 統計値

| 指標 | 説明 |
|------|------|
| 合計（Total） | 全PRの追加コミット数/Force Push回数の合計 |
| 平均（Average） | PRあたりの平均値 |
| 中央値（Median） | ソート後の中央の値 |
| 最大（Max） | 最も多いPRの値 |

### 他の指標との関係

```
着手 ──→ コーディング ──→ PR作成 ──→ レビュー ──→ マージ ──→ デプロイ
         │                          │           │
         └── Coding Time ──────────→│           │
                                    └─ Rework ──┘
```

| 指標 | 測定対象 | フレームワーク |
|------|----------|---------------|
| **手戻り率** | PR作成後の修正 | SPACE (Efficiency) |
| コーディング時間 | 着手〜PR作成 | SPACE (Activity) |
| サイクルタイム | 着手〜完了 | Kanban/Lean |
| Lead Time for Changes | マージ〜デプロイ | DORA |

---

## 使い方

### 基本的な使い方

```javascript
// GASエディタで実行

// 過去30日間の手戻り率を計測
syncReworkRate();

// 過去90日間の手戻り率を計測
syncReworkRate(90);

// PR詳細をログで確認（デバッグ用）
showReworkRateDetails(30);
```

### 前提条件

**1. GitHub PAT**

```javascript
setup(
  'ghp_xxxx',           // GitHub PAT ← 必須
  'spreadsheet-id'      // Google Spreadsheet ID
);

addRepo('owner', 'repo-name');
```

**2. 必要な権限**（Fine-grained PAT）

- `Pull requests`: Read-only
- `Metadata`: Read-only

---

## 出力データ

### スプレッドシート

2つのシートが作成されます：

**「Rework Rate」シート（サマリー）**

| Period | PR Count | Add Commits (Total) | Add Commits (Avg) | Add Commits (Median) | Force Pushes (Total) | Force Push Rate (%) | Recorded At |
|--------|----------|---------------------|-------------------|---------------------|---------------------|---------------------|-------------|
| 2024-01-01〜2024-01-31 | 25 | 48 | 1.9 | 1.0 | 12 | 32.0 | 2024-01-31T... |

**「Rework Rate - Details」シート（PR詳細）**

| PR # | Title | Repository | Created At | Merged At | Total Commits | Additional Commits | Force Push Count |
|------|-------|------------|------------|-----------|---------------|-------------------|------------------|
| 123 | Feature X | owner/repo | 2024-01-10T... | 2024-01-12T... | 5 | 2 | 0 |

### ログ出力例

```
🔄 Calculating Rework Rate for 30 days
   Period: 2024-01-01〜2024-01-31
📡 Fetching PRs from owner/repo...
   Found 25 merged PRs
📊 Fetching rework data for 25 PRs...
📊 Rework Rate Results:
   PRs analyzed: 25
   Additional Commits: total=48, avg=1.9
   Force Pushes: total=12, rate=32.0%
✅ Rework Rate metrics synced
```

---

## 制約事項と将来の拡張

### 現在の制約

| 制約 | 説明 | 対処法 |
|------|------|--------|
| **マージ済みPRのみ** | オープン/クローズのみのPRは対象外 | - |
| **API呼び出し回数** | PRごとに2回（コミット+タイムライン） | 期間を短くする |
| **Force Push検出** | 古いPRでは取得できない場合あり | - |
| **レート制限** | GitHub API 5000回/時間 | 期間を分割 |

### カウント対象外

- マージコミット
- 最初のコミット（PR作成時点）
- オープン状態のPR
- マージされていないPR（クローズのみ）

### トラブルシューティング

| 問題 | 原因 | 対処法 |
|------|------|--------|
| 「No merged PRs found」 | 期間内にマージPRがない | 期間を広げる、`listRepos()`で確認 |
| PRが取得できない | PAT権限不足 | Fine-grained tokenで対象リポジトリを選択 |
| Force Push回数が0 | Timeline API制限 or ブランチ保護 | 古いPRでは取得不可 |
| API制限エラー | 5000回/時間超過 | 期間を短くする |

### 将来の拡張案

| 機能 | 説明 | 優先度 |
|------|------|--------|
| LOC差分の取得 | 修正規模の測定 | 中 |
| レビューコメント数 | 指摘数の直接測定 | 高 |
| 著者別集計 | エンジニア別の手戻り率 | 中 |
| ラベル別集計 | バグ修正/機能追加別 | 低 |

---

## 出典・参考資料

### フレームワーク・研究

| # | 資料 | 説明 |
|---|------|------|
| 1 | [SPACE Framework](https://queue.acm.org/detail.cfm?id=3454124) | Microsoft Research。開発者生産性の5ディメンション |
| 2 | [DORA](https://dora.dev/) | ソフトウェアデリバリーの4 Key Metrics |
| 3 | [Accelerate](https://www.oreilly.com/library/view/accelerate/9781457191435/) | DORA研究の書籍（Forsgren, Humble, Kim） |

### エンジニアリングメトリクスツール

| # | 資料 | 説明 |
|---|------|------|
| 4 | [Code Climate - Rework](https://docs.velocity.codeclimate.com/en/articles/2913574-rework) | 30日以内の書き換え。シニアで9-14% |
| 5 | [Hatica - Code Churn](https://www.hatica.io/blog/code-churn-rate/) | 15-25%が許容範囲 |
| 6 | [LinearB - Code Churn](https://linearb.io/blog/what-is-code-churn) | サイクルタイム内訳としての解説 |
| 7 | [Pluralsight Flow - Rework](https://help.pluralsight.com/help/what-is-churn) | 可視化方法 |

### GitHub API

| # | 資料 | 説明 |
|---|------|------|
| 8 | [Pull Requests API](https://docs.github.com/en/rest/pulls/pulls) | PR一覧、コミット一覧 |
| 9 | [Timeline Events API](https://docs.github.com/en/rest/issues/timeline) | Force Pushイベント検出 |

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-01 | 初版作成。GitHubベースの手戻り率計測機能を追加 |
| 2025-01 | AI活用での考慮事項、業界標準との比較を追加。ドキュメント構成をリファクタリング |
