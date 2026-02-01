# DORA指標の詳細

**「チームの開発速度、本当に速い？」を4つの数字で答える**

---

## 🎯 30秒でわかるDORA指標

| 指標 | あなたのチームに当てはめると... | 理想値 |
|------|---------------------------|--------|
| **デプロイ頻度** | 「週に何回、本番リリースできてる？」 | 1日1回以上 |
| **リードタイム** | 「PR作成から本番まで何時間？」 | 1時間以内 |
| **変更障害率** | 「デプロイの何%で障害が起きる？」 | 15%以下 |
| **平均修復時間** | 「障害から何時間で復旧できる？」 | 1時間以内 |

> **出典:** Google Cloudが15,000組織を調査して確立した、開発生産性の業界標準
>
> **参考:** [DORA公式ガイド](https://dora.dev/guides/dora-metrics/) | Google Cloud

---

## 🤔 なぜDORA指標なのか？

**従来の指標の問題:**

```
❌ コード行数: たくさん書けば良い？（品質は？）
❌ コミット数: 細かく刻めば良い？（価値は？）
❌ ベロシティ: ポイント消化すれば良い？（リリースは？）
```

**DORA指標の強み:**

```
✅ デプロイ頻度: 実際にリリースできている
✅ リードタイム: 速く届けられている
✅ 変更障害率: 品質を保っている
✅ MTTR: 問題を素早く直せる
```

→ **「本当に価値を届けているか」を測る**

---

## 📊 データフロー

```
コミット ─→ レビュー ─→ マージ ─→ デプロイ ─→ 本番稼働
   │                                    │
   └──── Lead Time for Changes ─────────┘

デプロイ頻度: 本番環境へのデプロイ回数
変更障害率: 障害を引き起こしたデプロイの割合
MTTR: 障害から復旧までの時間
```

---

## 1. デプロイ頻度（Deployment Frequency）

**「1日1回リリースできる？ 週1回？ 月1回？」**

### なぜ重要？

```
デプロイ頻度が高い = フィードバックが速い
    ↓
ユーザーの声を反映しやすい
    ↓
市場変化に対応できる
```

**Elite チーム:** 1日に複数回デプロイ（Amazonは11.6秒に1回）

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
| daily (Elite) | 1日1回以上 |
| weekly (High) | 週1回以上 |
| monthly (Medium) | 月1回以上 |
| yearly (Low) | 月1回未満 |

## 2. リードタイム（Lead Time for Changes）

**「PR作成から本番リリースまで、何時間かかる？」**

### なぜ重要？

```
リードタイムが短い = 問題の早期発見
    ↓
バグ修正が速い
    ↓
ユーザーへの影響を最小化
```

**具体例:**

```
Before: リードタイム 72時間
    → 金曜午後にマージ → 月曜午前に本番リリース

After: リードタイム 2時間
    → 金曜午後にマージ → 金曜夕方に本番リリース
    → 問題があっても金曜中に修正可能
```

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

デプロイ関連付けの閾値: マージから24時間以内のデプロイのみ関連付け

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
| Elite | < 1時間 |
| High | 1日〜1週間 |
| Medium | 1週間〜1ヶ月 |
| Low | 1ヶ月〜6ヶ月 |

## 3. 変更障害率（Change Failure Rate）

**「デプロイの何%で障害が起きる？」**

### なぜ重要？

```
変更障害率が低い = 品質が高い
    ↓
夜間・休日の障害対応が減る
    ↓
チームの疲弊を防ぐ
```

**現実的なトレードオフ:**

```
デプロイ頻度を上げる ⇄ 変更障害率を下げる
    ↓
両立が難しい
    ↓
Elite チーム: 両方を実現（自動テスト・段階的ロールアウト）
```

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
| Elite / High | 0-15% |
| Medium | 16-30% |
| Low | 30%超 |

## 4. 平均修復時間（Mean Time to Recovery, MTTR）

**「障害から何時間で復旧できる？」**

### なぜ重要？

```
MTTRが短い = ユーザーへの影響が小さい
    ↓
信頼性が高い
    ↓
ビジネスの損失を最小化
```

**具体例:**

```
Before: MTTR 8時間
    → 朝9時に障害発生 → 夕方17時まで復旧せず
    → ユーザーは1日中使えない

After: MTTR 1時間
    → 朝9時に障害発生 → 10時には復旧
    → ユーザーは午前中から使える
```

**改善のポイント:**
- ロールバック手順の自動化
- 障害検知の高速化（監視・アラート）
- インシデントIssueの活用（復旧時間を可視化）

### 定義

障害発生から、サービスが正常に復旧するまでの平均時間。

### GitHubでの計算方法

#### 優先（推奨）: GitHub Issues（Incident）

DORA公式定義に最も近い計測方法として、設定されたインシデントラベル（デフォルト: `"incident"`）のIssueを使用：

```
GET /repos/{owner}/{repo}/issues?labels=<configured-labels>
```

```
Incident Issue作成 (障害検知)
    ↓
Incident Issue close (復旧完了)
    ↓
MTTR = Issue close日時 - Issue作成日時
```

デフォルト設定: DevSyncGASはIncident Issueを優先的に使用します。
インシデント判定ラベルは `configureIncidentLabels()` でカスタマイズ可能です。

#### フォールバック1: GitHub Deployments API

Incident Issueが存在しない場合、デプロイメントの時系列を追跡し、失敗→成功のパターンを検出：

```
失敗デプロイ発生 (status: "failure" or "error")
    ↓
成功デプロイ (status: "success")
    ↓
復旧時間 = 成功デプロイ日時 - 失敗デプロイ日時
```

#### フォールバック2: GitHub Actions Workflow Runs

デプロイメントデータもない場合、ワークフロー実行を使用：

```
失敗ワークフロー (conclusion: "failure")
    ↓
成功ワークフロー (conclusion: "success")
    ↓
復旧時間 = 成功実行日時 - 失敗実行日時
```

### 出力例

| 期間 | 障害回数 | 平均復旧時間 (時間) |
|------|---------|-------------------|
| 2024-01-01〜01-31 | 3 | 2.5 |

### 分類基準（DORA）

| 分類 | 基準 |
|------|------|
| Elite | < 1時間 |
| High | 1-24時間 |
| Medium | 1-7日 |
| Low | > 7日 |

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

## 出力されるシート

### 「Dashboard」シート

全リポジトリ × 全指標を俯瞰：

| リポジトリ | デプロイ頻度 | リードタイム (時間) | 変更障害率 | MTTR (時間) | 最終更新 | ステータス |
|-----------|------------|-------------------|-----------|------------|---------|-----------|
| owner/repo-a | daily | 12.5 | 5.0% | 1.2 | 2024-01-31 | OK |

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

## 設定

### Production環境名の設定

```javascript
// デフォルト: "production"（部分一致）
showProductionBranch();

// 変更する場合
configureProductionBranch("prod");
configureProductionBranch("production-us");

// リセット
resetProductionBranch();
```

### MTTR（Incident）ラベル設定

インシデント判定に使用するラベルをカスタマイズできます（デフォルト: `"incident"`）。

```javascript
// インシデントラベルを設定（プロジェクトのルールに合わせて）
configureIncidentLabels(['incident', 'bug', 'p0']);

// 現在の設定を確認
showIncidentLabels();

// デフォルトに戻す
resetIncidentLabelsConfig();

// 障害Issueを作成する場合の例
// 1. GitHubでIssueを作成
// 2. 設定したラベル（例: "incident"）を付与
// 3. 復旧後にIssueをクローズ
// → syncDevOpsMetrics() で自動的にMTTRが計算されます
```

推奨運用:
- 本番障害が発生したら設定したインシデントラベル付きIssueを作成
- 復旧完了後にIssueをクローズ
- より正確なMTTRが自動計測されます
- プロジェクトのラベル運用ルールに合わせてカスタマイズ可能

### GraphQL vs REST API

| モード | 特徴 | 使いどころ |
|--------|------|-----------|
| GraphQL (デフォルト) | API呼び出し回数が少ない、高速 | 通常運用 |
| REST | より詳細なデータ取得 | トラブルシューティング |

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
| **MTTR** | インシデントラベル付きIssue（推奨、デフォルト: "incident"） または デプロイメントステータス |

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

## トラブルシューティング

### デプロイ頻度が0件

- **GitHub Deployments API**: 環境名が "production" にマッチするか確認
  - `showProductionBranch()` で現在の設定を確認
  - 環境名を変更: `configureProductionBranch("prod")`
- **フォールバック**: ワークフロー名に "deploy" が含まれるか確認

### リードタイムが計測されない

- PRがマージ済みか確認
- デプロイメントデータが存在するか確認（なければフォールバックモードに自動切替）

### 変更障害率が取得できない

- デプロイメントステータスが正しく取得されているか確認
- `skipStatusFetch: true` が設定されていないか確認

### MTTRがnull

- 復旧パターン（失敗→成功）が存在しない場合、nullになります
- インシデントラベル付きIssueを作成すると、より正確なMTTRを計測できます
- インシデントラベルは `configureIncidentLabels()` でカスタマイズ可能（デフォルト: `"incident"`）

## 参考資料

- [DORA公式ガイド](https://dora.dev/guides/dora-metrics/)
- [State of DevOps Report](https://dora.dev/research/)
- [Google Cloud - DORA metrics](https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance)
- [GitHub Deployments API](https://docs.github.com/en/rest/deployments/deployments)
- [GitHub Actions API](https://docs.github.com/en/rest/actions/workflow-runs)
