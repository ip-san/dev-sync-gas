# DORA Metrics 実装ガイド

このドキュメントでは、DevSyncGASで実装しているDORA Four Key Metricsの定義、計算方法、および制約事項について解説します。

## DORA Metricsとは

DORA（DevOps Research and Assessment）は、ソフトウェアデリバリーのパフォーマンスを測定するための4つの主要指標を定義しています。これらの指標は、Google CloudのDORAチームによる6年以上の研究に基づいており、組織のソフトウェアデリバリー能力と運用パフォーマンスを客観的に評価するために使用されます。

### 4つの主要指標

| 指標 | 説明 | 測定対象 |
|------|------|----------|
| Deployment Frequency | 本番環境へのデプロイ頻度 | スループット |
| Lead Time for Changes | コード変更から本番デプロイまでの時間 | スループット |
| Change Failure Rate | 本番環境で障害を引き起こしたデプロイの割合 | 安定性 |
| Mean Time to Recovery | 本番環境の障害から復旧するまでの時間 | 安定性 |

> **注意**: パフォーマンスレベル（Elite/High/Medium/Low）の閾値は、DORAの年次調査データに基づいて毎年更新されます。本ドキュメントの閾値は2024年時点のものです。最新の閾値は[DORA公式サイト](https://dora.dev/)を参照してください。

---

## GitHubから取得するデータ

本プロジェクトでは、GitHub APIから3種類のデータを取得してDORA Metricsを計算しています。

### 1. Pull Request（プルリクエスト）

**何を見ているか**: コードの変更履歴

PRはコードの変更をレビューしてもらうための仕組みです。以下の情報を使用します:

| フィールド | 説明 | 使用目的 |
|------------|------|----------|
| `created_at` | PRが作成された日時 | Lead Timeのフォールバック計算 |
| `merged_at` | PRがマージされた日時 | Lead Timeの起点 |
| `state` | PRの状態（open/closed） | マージ済みPRのフィルタリング |

**GitHubでの確認方法**: リポジトリ → 「Pull requests」タブ → 各PRの詳細

```
例: あるPRの場合
- created_at: 2024-01-15 10:00:00  ← PRを作成した時刻
- merged_at:  2024-01-15 14:00:00  ← マージされた時刻（4時間後）
```

### 2. Workflow Run（ワークフロー実行）

**何を見ているか**: GitHub Actionsの実行履歴

GitHub Actionsで定義したCI/CDパイプラインの実行結果です:

| フィールド | 説明 | 使用目的 |
|------------|------|----------|
| `name` | ワークフロー名 | デプロイ関連かどうかの判定（「deploy」を含むか） |
| `conclusion` | 実行結果 | 成功/失敗の判定 |
| `created_at` | 実行開始日時 | 時系列での分析 |

**GitHubでの確認方法**: リポジトリ → 「Actions」タブ

```
例: ワークフロー実行の場合
- name: "Deploy to Production"  ← 「deploy」を含むのでデプロイとして認識
- conclusion: "success"         ← 成功したデプロイ
- created_at: 2024-01-15 14:30:00
```

**よくあるワークフロー名の例**:
- `Deploy to Production` ✅ デプロイとして認識
- `deploy` ✅ デプロイとして認識
- `CD - Deploy` ✅ デプロイとして認識
- `Build and Test` ❌ デプロイとして認識されない
- `CI` ❌ デプロイとして認識されない

### 3. Deployment（デプロイメント）

**何を見ているか**: GitHub Deploymentsの記録

GitHub Deploymentsは、特定の環境（production, staging等）へのデプロイを追跡する機能です:

| フィールド | 説明 | 使用目的 |
|------------|------|----------|
| `environment` | デプロイ先環境名 | 本番環境のフィルタリング |
| `status` | デプロイのステータス | 成功/失敗の判定 |
| `created_at` | デプロイ作成日時 | Lead Time, MTTR計算 |
| `sha` | デプロイしたコミットのSHA | （現在は未使用、将来的にPRとの紐付けに使用予定） |

**GitHubでの確認方法**: リポジトリ → 「Deployments」（右サイドバーの「Environments」セクション）

```
例: デプロイメントの場合
- environment: "production"  ← 本番環境へのデプロイ
- status: "success"          ← 成功
- created_at: 2024-01-15 14:35:00
```

**statusの値と各指標への影響**:

| 値 | 意味 | Deployment Frequency | Lead Time | CFR | MTTR |
|----|------|---------------------|-----------|-----|------|
| `success` | 成功 | ✅ カウント | ✅ 使用 | 分母に含む | 復旧として検出 |
| `failure` | 失敗 | - | - | 分母・分子に含む | 障害として検出 |
| `error` | エラー | - | - | 分母・分子に含む | 障害として検出 |
| `inactive` | 非アクティブ | - | - | 分母に含む | - |
| `in_progress` | 進行中 | - | - | 分母に含む | - |
| `queued` | 待機中 | - | - | 分母に含む | - |
| `pending` | 保留中 | - | - | 分母に含む | - |
| `null` | 取得失敗 | フォールバック | フォールバック | フォールバック | フォールバック |

> **注意**: `in_progress`や`queued`などの進行中ステータスもCFRの分母に含まれます。
> これらが多いとCFRが実際より低く見える可能性があります。

### データ取得の流れ

```
┌─────────────────────────────────────────────────────────────┐
│                      GitHub API                              │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Pull Requests │  Workflow Runs  │     Deployments         │
│                 │                 │                         │
│  ・created_at   │  ・name         │  ・environment          │
│  ・merged_at    │  ・conclusion   │  ・status               │
│  ・state        │  ・created_at   │  ・created_at           │
└────────┬────────┴────────┬────────┴────────┬────────────────┘
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    DORA Metrics 計算                         │
├─────────────────────────────────────────────────────────────┤
│  Deployment Frequency : Deployments (status=success)        │
│                        └→ フォールバック: Workflow Runs     │
│                                                             │
│  Lead Time for Changes: PRs (merged_at) + Deployments       │
│                        └→ フォールバック: PRs (created_at)  │
│                                                             │
│  Change Failure Rate  : Deployments (status≠null)           │
│                        └→ フォールバック: Workflow Runs     │
│                                                             │
│  MTTR                 : Deployments (status≠null)           │
│                        └→ フォールバック: Workflow Runs     │
└─────────────────────────────────────────────────────────────┘
```

### フォールバックが発生する条件

各指標がワークフローにフォールバックするタイミング:

| 指標 | フォールバック条件 |
|------|-------------------|
| Deployment Frequency | `status=success`のデプロイが0件の場合 |
| Lead Time | `status=success`のデプロイが0件の場合（PR作成→マージ時間を使用） |
| Change Failure Rate | `status≠null`のデプロイが0件の場合 |
| MTTR | `status≠null`のデプロイが0件の場合 |

> **ポイント**: Deploymentsが存在しても、すべてのステータスが`null`の場合はフォールバックします。
> これは`skipStatusFetch=true`を使用した場合や、ステータス取得に失敗した場合に発生します。

### あなたのリポジトリでDeploymentsが使われているか確認する方法

1. GitHubでリポジトリを開く
2. 右サイドバーの「Environments」セクションを確認
3. 「production」などの環境が表示されていれば、Deployments APIが使用されています

**Deploymentsがない場合**:
- GitHub Actionsのワークフロー実行データにフォールバックします
- ワークフロー名に「deploy」が含まれているものがデプロイとして認識されます

**Deploymentsを有効にするには**:
GitHub Actionsのワークフローで `environment` を指定します:

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # ← これを追加
    steps:
      - name: Deploy
        run: ./deploy.sh
```

---

## 各指標の詳細

---

### 1. Deployment Frequency（デプロイ頻度）

#### 公式定義

> 組織が本番環境またはエンドユーザーへのリリースを成功させる頻度

#### パフォーマンス分類（DORA基準）

| レベル | 頻度 |
|--------|------|
| Elite | オンデマンド（1日複数回） |
| High | 1日1回〜週1回 |
| Medium | 週1回〜月1回 |
| Low | 月1回〜6ヶ月に1回 |

#### 本プロジェクトでの実装

```
計算式: 成功デプロイ数 / 期間（日数）
```

**データソース（優先順位）:**

1. **GitHub Deployments API** - `production`環境への成功デプロイをカウント
2. **フォールバック: GitHub Actions** - ワークフロー名に「deploy」を含む成功した実行をカウント

**分類基準:**
- `daily`: 1日1回以上
- `weekly`: 週1回以上
- `monthly`: 月1回以上
- `yearly`: 月1回未満

#### 制約事項

- GitHub Deployments APIを使用していないプロジェクトでは、ワークフロー名ベースのヒューリスティックに依存
- 環境名は設定で変更可能（デフォルト: `production`）

---

### 2. Lead Time for Changes（変更のリードタイム）

#### 公式定義

> コードがコミットされてから本番環境で正常に稼働するまでの時間

DORAの定義では、最初のコミットから本番デプロイまでの時間を測定しますが、実際の計測ではPRのオープンからデプロイまでの時間が一般的に使用されます。

#### パフォーマンス分類（DORA基準）

| レベル | リードタイム |
|--------|-------------|
| Elite | 1時間未満 |
| High | 1日〜1週間 |
| Medium | 1週間〜1ヶ月 |
| Low | 1ヶ月以上 |

> **実装上の注意**: DORA公式定義では1時間〜1日の間が未定義です。
> 本実装では連続的に分類するため、この範囲をHighとして扱っています。
> 詳細は `src/config/doraThresholds.ts` を参照してください。

#### 本プロジェクトでの実装

**計算方法（2段階）:**

1. **マージ→デプロイ時間**（推奨）
   - PRがマージされた時刻を取得
   - マージ後24時間以内の最初の成功デプロイを探す
   - 差分を計算

2. **フォールバック: PR作成→マージ時間**
   - デプロイメントデータがない場合に使用
   - PRの作成時刻からマージ時刻までの時間

**出力データ:**
```typescript
{
  leadTimeForChangesHours: 2.5,        // 平均リードタイム（時間）
  leadTimeMeasurement: {
    mergeToDeployCount: 8,             // マージ→デプロイで計測されたPR数
    createToMergeCount: 2,             // フォールバックで計測されたPR数
  }
}
```

#### 制約事項

- **時間ベースマッチング**: 理想的にはコミットSHAでPRとデプロイを関連付けるべきですが、GitHub Deployments APIの制約により、時間ベースで近似しています
- **24時間閾値**: マージ後24時間以内のデプロイのみを関連付け。それ以上経過した場合はフォールバックを使用
- フォールバック計測はコードレビュー時間を含むため、純粋なリードタイムより長くなる傾向

---

### 3. Change Failure Rate（変更失敗率）

#### 公式定義

> 本番環境へのデプロイのうち、障害（サービス低下、サービス停止、ロールバックが必要な状態）を引き起こした割合

#### パフォーマンス分類（DORA基準）

| レベル | 失敗率 |
|--------|--------|
| Elite | 0-15% |
| High | 0-15% |
| Medium | 16-30% |
| Low | 30%超 |

> **注意**: EliteとHighは同じ閾値（0-15%）です。CFRだけでなく他の指標も含めた総合評価でレベルが決まります。

#### 本プロジェクトでの実装

```
計算式: 失敗デプロイ数 / 全デプロイ数 × 100
```

**データソース（優先順位）:**

1. **GitHub Deployments API** - ステータスが`failure`または`error`のデプロイをカウント
2. **フォールバック: GitHub Actions** - `conclusion`が`failure`のデプロイワークフローをカウント

#### 重要な注意事項

> **⚠️ 真のDORA定義との差異**
>
> DORAの公式定義では、**本番環境でインシデントを引き起こしたデプロイ**を測定します。これには以下が含まれます:
> - ユーザーに影響を与えた障害
> - ロールバックが必要になったデプロイ
> - ホットフィックスが必要になった変更
>
> 本実装では、**CI/CDパイプラインの失敗率**を測定しており、これは近似値です。真のChange Failure Rateを測定するには、インシデント管理システム（PagerDuty、Opsgenie等）との連携が必要です。

#### 制約事項

- デプロイ自体は成功したが、その後本番で問題が発生したケースは検出できない
- `skipStatusFetch=true`の場合、全デプロイのステータスが`null`となりワークフローにフォールバック

---

### 4. Mean Time to Recovery / MTTR（平均復旧時間）

#### 公式定義

> 本番環境でサービス障害が発生してから復旧するまでの時間

#### パフォーマンス分類（DORA基準）

| レベル | 復旧時間 |
|--------|----------|
| Elite | 1時間未満 |
| High | 1日未満 |
| Medium | 1週間未満 |
| Low | 1週間以上 |

#### 本プロジェクトでの実装

```
計算式: Σ(復旧デプロイ時刻 - 障害デプロイ時刻) / 障害回数
```

**計算ロジック:**

1. デプロイを時系列順にソート
2. 失敗デプロイを検出
3. その後の最初の成功デプロイまでの時間を計算
4. 全復旧時間の平均を算出

**データソース（優先順位）:**

1. **GitHub Deployments API** - `failure`/`error`から`success`までの時間
2. **フォールバック: GitHub Actions** - デプロイワークフローの失敗から成功までの時間

#### 重要な注意事項

> **⚠️ 真のDORA定義との差異**
>
> DORAの公式定義では、**本番環境のサービス障害から復旧するまでの時間**を測定します。これは:
> - アラートが発報されてから
> - サービスが正常に復旧するまで
>
> の時間を意味します。本実装では、**デプロイ失敗から次の成功デプロイまでの時間**を測定しており、これは近似値です。真のMTTRを測定するには、インシデント管理システムやモニタリングツールとの連携が必要です。

#### 制約事項

- 未復旧の障害（期間内に成功デプロイがない）はカウントされない
- 障害がない場合は`null`を返す
- 本番環境の実際のダウンタイムではなく、デプロイ間の時間を測定

---

## 実装上の考慮事項

### 閾値の設定ファイル

パフォーマンスレベル（Elite/High/Medium/Low）を判定する閾値は、設定ファイルに切り出されています:

```
src/config/doraThresholds.ts
```

**閾値を変更するには**:

DORAが年次レポートで閾値を更新した場合、このファイルの定数を修正してください:

```typescript
// 例: Deployment Frequency の閾値
export const DEPLOYMENT_FREQUENCY_THRESHOLDS = {
  elite: 1,      // 1日1回以上
  high: 1 / 7,   // 週1回以上
  medium: 1 / 30, // 月1回以上
} as const;
```

**パフォーマンスレベル判定関数**:

各指標のパフォーマンスレベルを取得する関数も提供しています:

```typescript
import {
  getDeploymentFrequencyLevel,
  getLeadTimeLevel,
  getChangeFailureRateLevel,
  getMTTRLevel,
} from "./config/doraThresholds";

// 使用例
const level = getLeadTimeLevel(2.5); // "high"
```

### データソースの優先順位

本プロジェクトでは、以下の優先順位でデータを取得します:

```
GitHub Deployments API（推奨）
    ↓ フォールバック
GitHub Actions Workflow Runs
```

GitHub Deployments APIを使用することで、より正確なデプロイ情報を取得できます。ただし、Deployments APIを使用していないプロジェクトでは、ワークフロー実行データにフォールバックします。

### `skipStatusFetch`オプション

デプロイメントのステータス取得はN+1クエリとなるため、パフォーマンスに影響します。

```typescript
getDeployments(repo, token, { skipStatusFetch: true })
```

`skipStatusFetch=true`に設定すると:
- API呼び出しが大幅に削減される
- すべてのデプロイの`status`が`null`になる
- Deployment Frequency, CFR, MTTRがワークフローベースのフォールバックを使用

メトリクス計算が目的の場合は`skipStatusFetch=false`（デフォルト）を推奨します。

### 環境フィルタリング

デプロイメントは指定された環境（デフォルト: `production`）でフィルタリングされます:

```typescript
getAllRepositoriesData(repos, token, {
  deploymentEnvironment: "production"  // または "prod", "live" など
})
```

---

## より正確なDORA Metrics計測に向けて

本実装はGitHub APIのみを使用した近似実装です。より正確なDORA Metricsを計測するには、以下の連携を検討してください:

### Change Failure Rate の改善

- **インシデント管理システム連携**: PagerDuty, Opsgenie, ServiceNow等
- **アラート管理**: Prometheus Alertmanager, Datadog等
- **イシュートラッキング**: 本番障害を表すラベル（`incident`, `production-bug`等）でフィルタリング

### MTTR の改善

- **モニタリングツール連携**: Datadog, New Relic, Grafana等
- **ステータスページ連携**: Statuspage, Atlassian等
- **オンコール管理**: PagerDuty, Opsgenie等

---

## 出典・参考資料

### 公式ドキュメント

1. **DORA | DevOps Capabilities**
   - https://dora.dev/capabilities/
   - DORAの公式サイト。各メトリクスの定義と改善方法を解説

2. **DORA Metrics: The 4 Keys of DevOps - Google Cloud Blog**
   - https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance
   - Google Cloudによる詳細な解説

3. **Four Keys Project - GitHub**
   - https://github.com/dora-team/fourkeys
   - DORAチームによるリファレンス実装

### 書籍

4. **Accelerate: The Science of Lean Software and DevOps**
   - Nicole Forsgren, Jez Humble, Gene Kim 著
   - DORA研究の基礎となった書籍

### その他の参考資料

5. **GitLab - DORA Metrics**
   - https://docs.gitlab.com/ee/user/analytics/dora_metrics.html
   - GitLabによるDORA Metricsの実装例

6. **GitHub Actions - Workflow runs API**
   - https://docs.github.com/en/rest/actions/workflow-runs
   - 本プロジェクトで使用しているAPI

7. **GitHub Deployments API**
   - https://docs.github.com/en/rest/deployments/deployments
   - 本プロジェクトで使用しているAPI

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2024-01 | 初版作成。DORA公式定義に基づく実装の解説を追加 |
