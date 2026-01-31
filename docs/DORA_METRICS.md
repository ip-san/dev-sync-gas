# DORA指標

**4つのDORA指標(DevOps Research and Assessment Metrics)**の定義と、GitHubデータを使った計算方法を説明します。

```
コミット ─→ レビュー ─→ マージ ─→ デプロイ ─→ 本番稼働
   │                                    │
   └──── Lead Time for Changes ─────────┘

デプロイ頻度: 本番環境へのデプロイ回数
変更障害率: 障害を引き起こしたデプロイの割合
MTTR: 障害から復旧までの時間
```

> **参考**: [DORA公式ガイド](https://dora.dev/guides/dora-metrics/) | Google Cloud

---

## 1. デプロイ頻度（Deployment Frequency）

**本番環境へのデプロイ頻度**を計測します。

### 定義

本番環境に対して、成功したデプロイを何回行ったか。

### GitHubでの計算方法

#### 優先: GitHub Deployments API

```
GET /repos/{owner}/{repo}/deployments?environment=production
```

- `environment: "production"` のデプロイメントを取得
- `status: "success"` のみカウント
- 環境名は部分一致対応（例: "prod", "production", "production-us"）

#### フォールバック: GitHub Actions Workflow Runs

Deployments APIが使われていない場合：

```
GET /repos/{owner}/{repo}/actions/runs
```

- ワークフロー名に `deploy` を含むものを抽出
- `conclusion: "success"` のみカウント

### 出力例

| 期間 | デプロイ回数 | 頻度分類 |
|------|-------------|---------|
| 2024-01-01〜01-31 | 25 | daily |

### 分類基準（DORA）

| 頻度分類 | 定義 |
|---------|------|
| **daily** (Elite) | 1日1回以上 |
| **weekly** (High) | 週1回以上 |
| **monthly** (Medium) | 月1回以上 |
| **yearly** (Low) | 月1回未満 |

---

## 2. リードタイム（Lead Time for Changes）

**コードがコミットされてから本番環境にデプロイされるまでの時間**を計測します。

### 定義

DORA公式: "committed to version control to deployed in production"

コード変更（PR作成）から、本番デプロイまでの経過時間。

### GitHubでの計算方法

#### 優先: PR作成 → デプロイ

1. マージ済みPRを取得
2. PR作成後の最初の成功デプロイメントを探す
3. `PR作成日時` → `デプロイ日時` の経過時間（時間単位）を計算
4. 全PRの平均を算出

```javascript
leadTime = (deployedAt - prCreatedAt) / (1000 * 60 * 60); // 時間
```

**デプロイ関連付けの閾値**: マージから24時間以内のデプロイのみ関連付け

#### フォールバック: PR作成 → マージ

デプロイメントデータがない場合：

1. `PR作成日時` → `マージ日時` の経過時間を計算

```javascript
leadTime = (mergedAt - prCreatedAt) / (1000 * 60 * 60); // 時間
```

### 出力例

| 期間 | PR数 | 平均 (時間) | 計測方法 |
|------|------|------------|---------|
| 2024-01-01〜01-31 | 30 | 18.5 | マージ→デプロイ: 25件、作成→マージ: 5件 |

### 分類基準（DORA）

| 分類 | 基準 |
|------|------|
| **Elite** | < 1時間 |
| **High** | 1日〜1週間 |
| **Medium** | 1週間〜1ヶ月 |
| **Low** | 1ヶ月〜6ヶ月 |

---

## 3. 変更障害率（Change Failure Rate）

**本番環境でインシデントを引き起こしたデプロイの割合**を計測します。

### 定義

デプロイ後に障害が発生し、修正・ロールバックが必要になった割合。

### GitHubでの計算方法

#### 優先: GitHub Deployments API

```
総デプロイ数 = status が取得できたデプロイメント数
失敗デプロイ数 = status が "failure" または "error" のデプロイメント数

変更障害率 = (失敗デプロイ数 / 総デプロイ数) × 100
```

#### フォールバック: GitHub Actions Workflow Runs

```
総デプロイ数 = "deploy" を含むワークフロー実行数
失敗デプロイ数 = conclusion が "failure" のワークフロー数

変更障害率 = (失敗デプロイ数 / 総デプロイ数) × 100
```

### 出力例

| 期間 | 総デプロイ | 失敗 | 変更障害率 |
|------|-----------|------|----------|
| 2024-01-01〜01-31 | 25 | 2 | 8.0% |

### 分類基準（DORA 2024）

| 分類 | 基準 |
|------|------|
| **Elite / High** | 0-15% |
| **Medium** | 16-30% |
| **Low** | 30%超 |

---

## 4. 平均修復時間（Mean Time to Recovery, MTTR）

**本番環境の障害から復旧するまでの時間**を計測します。

### 定義

障害発生から、サービスが正常に復旧するまでの平均時間。

### GitHubでの計算方法

#### 優先: GitHub Deployments API

デプロイメントの時系列を追跡し、失敗→成功のパターンを検出：

```
失敗デプロイ発生 (status: "failure" or "error")
    ↓
成功デプロイ (status: "success")
    ↓
復旧時間 = 成功デプロイ日時 - 失敗デプロイ日時
```

全復旧パターンの平均を算出。

#### フォールバック: GitHub Actions Workflow Runs

```
失敗ワークフロー (conclusion: "failure")
    ↓
成功ワークフロー (conclusion: "success")
    ↓
復旧時間 = 成功実行日時 - 失敗実行日時
```

#### 真のMTTR: GitHub Issues（Incident）

より正確な計測として、"incident"ラベルのIssueを使用：

```
GET /repos/{owner}/{repo}/issues?labels=incident
```

```
Incident Issue作成 (障害検知)
    ↓
Incident Issue close (復旧完了)
    ↓
MTTR = Issue close日時 - Issue作成日時
```

### 出力例

| 期間 | 障害回数 | 平均復旧時間 (時間) |
|------|---------|-------------------|
| 2024-01-01〜01-31 | 3 | 2.5 |

### 分類基準（DORA）

| 分類 | 基準 |
|------|------|
| **Elite** | < 1時間 |
| **High** | 1-24時間 |
| **Medium** | 1-7日 |
| **Low** | > 7日 |

---

## 使い方

### 基本

```javascript
// DORA指標を同期（デフォルト: 過去30日）
syncDevOpsMetrics();

// 過去90日間
syncDevOpsMetrics(90);

// 全プロジェクトを同期
syncAllProjects();
```

### API モード切替

```javascript
// GraphQL API を使用（デフォルト、API呼び出し回数削減）
configureApiMode('graphql');

// REST API を使用
configureApiMode('rest');

// 現在のモードを確認
showApiMode();
```

---

## 出力されるシート

### 「Dashboard」シート

全リポジトリ × 全指標を俯瞰：

| リポジトリ | デプロイ頻度 | リードタイム (時間) | 変更障害率 | MTTR (時間) | 最終更新 | ステータス |
|-----------|------------|-------------------|-----------|------------|---------|-----------|
| owner/repo-a | daily | 12.5 | 5.0% | 1.2 | 2024-01-31 | ✓ |

### 「Dashboard - Trend」シート

週次トレンド：

| 週 | リポジトリ | デプロイ頻度 | リードタイム | 変更障害率 | MTTR |
|----|-----------|------------|------------|-----------|------|
| 2024-W01 | owner/repo-a | daily | 10.5 | 4.0% | 1.0 |

### 「DevOps Summary」シート

リポジトリ比較サマリー：

| リポジトリ | デプロイ回数 | 平均リードタイム | 変更障害率 | 平均MTTR |
|-----------|------------|----------------|-----------|---------|
| owner/repo-a | 25 | 12.5h | 5.0% | 1.2h |
| owner/repo-b | 18 | 18.0h | 8.0% | 2.5h |

### リポジトリ別シート（例: "owner/repo-a"）

| 日付 | デプロイ回数 | 頻度分類 | リードタイム | 変更障害率 | MTTR |
|------|------------|---------|------------|-----------|------|
| 2024-01-31 | 1 | daily | 10.5 | 0.0% | null |

---

## 設定

### Production環境名の設定

```javascript
// デフォルト: "production"（部分一致）
showProductionEnvironment();

// 変更する場合
configureProductionEnvironment("prod");
configureProductionEnvironment("production-us");

// リセット
resetProductionEnvironment();
```

### GraphQL vs REST API

| モード | 特徴 | 使いどころ |
|--------|------|-----------|
| **GraphQL** (デフォルト) | API呼び出し回数が少ない、高速 | 通常運用 |
| **REST** | より詳細なデータ取得 | トラブルシューティング |

---

## GitHubデータの前提条件

### 必須

- GitHub PATまたはGitHub Apps認証
- リポジトリへの読み取り権限（`repo` or `public_repo`）

### 推奨

| 機能 | 必要なGitHub設定 |
|------|-----------------|
| **デプロイ頻度** | GitHub Deployments API または "deploy" ワークフロー |
| **リードタイム** | PR運用（マージ必須） |
| **変更障害率** | デプロイメントステータス取得 |
| **MTTR** | デプロイメントステータス または "incident" ラベル付きIssue |

---

## 計測思想

DevSyncGASは、DORA指標に加えて**拡張指標**も提供します。

| 指標 | 起点 | 終点 | 視点 |
|------|------|------|------|
| **DORA: Lead Time** | PR作成 | デプロイ | CI/CDパイプライン |
| サイクルタイム | Issue作成 | Productionマージ | タスク管理 |
| コーディング時間 | Issue作成 | PR作成 | 実装速度 |

詳細は以下を参照：

- [計測思想](MEASUREMENT_PHILOSOPHY.md) - なぜこの指標を、この方法で測るのか
- [サイクルタイム](CYCLE_TIME.md)
- [コーディング時間](CODING_TIME.md)

---

## トラブルシューティング

### デプロイ頻度が0件

- **GitHub Deployments API**: 環境名が "production" にマッチするか確認
  - `showProductionEnvironment()` で現在の設定を確認
  - 環境名を変更: `configureProductionEnvironment("prod")`
- **フォールバック**: ワークフロー名に "deploy" が含まれるか確認

### リードタイムが計測されない

- PRがマージ済みか確認
- デプロイメントデータが存在するか確認（なければフォールバックモードに自動切替）

### 変更障害率が取得できない

- デプロイメントステータスが正しく取得されているか確認
- `skipStatusFetch: true` が設定されていないか確認

### MTTRがnull

- 復旧パターン（失敗→成功）が存在しない場合、nullになります
- "incident"ラベル付きIssueを作成すると、より正確なMTTRを計測できます

---

## 参考資料

- [DORA公式ガイド](https://dora.dev/guides/dora-metrics/)
- [State of DevOps Report](https://dora.dev/research/)
- [Google Cloud - DORA metrics](https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance)
- [GitHub Deployments API](https://docs.github.com/en/rest/deployments/deployments)
- [GitHub Actions API](https://docs.github.com/en/rest/actions/workflow-runs)
