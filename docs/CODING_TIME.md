# コーディング時間

**Issue作成からPR作成までの時間**を計測します。

```
Issue作成 ──────────────────→ PR作成
    │                           │
   タスク起票               コード完成
    └──── コーディング時間 ────┘
```

---

## 使い方

```javascript
// 過去30日間のコーディング時間を計測（デフォルト）
syncCodingTime();

// 過去90日間
syncCodingTime(90);
```

### 前提条件

IssueとPRがリンクされている（PRのdescriptionに `Fixes #123` など）

---

## 出力されるシート

### 「コーディング時間」シート（サマリー）

| 期間 | Issue数 | 平均 (時間) | 中央値 | 最小 | 最大 |
|------|---------|-------------|--------|------|------|
| 2024-01-01〜01-31 | 12 | 6.5 | 4.0 | 1.0 | 24.0 |

### 「コーディング時間 - Details」シート（Issue詳細）

| Issue番号 | タイトル | リポジトリ | Issue作成日時 | PR作成日時 | PR番号 | コーディング時間 (時間) |
|-----------|----------|------------|---------------|------------|--------|------------------------|
| #123 | Feature X | owner/repo | 2024-01-10T10:00 | 2024-01-10T14:00 | #125 | 4.0 |

---

## 設定

### ラベルフィルタ

特定のラベルが付いたIssueのみを計測対象にできます。

```javascript
configureCodingTimeLabels(["feature", "enhancement"]);

showCodingTimeLabels();          // 現在の設定を確認
resetCodingTimeLabelsConfig();   // 全Issueを対象にリセット
showCodingTimeConfig();          // 全設定を一覧表示
```

### デプロイ用PRの除外

デプロイ用PRは通常、開発プロセスが異なるため、統計を歪めることがあります。特定のbaseブランチへのマージを除外できます。

#### init.tsで設定（推奨）

`src/init.ts` に設定を記述して永続化できます：

```typescript
export const config: InitConfig = {
  // ... 他の設定 ...

  // コーディング時間計算から除外するbaseブランチ（部分一致）
  codingTimeExcludeBranches: ['production', 'staging'],
};
```

設定後の適用手順：
1. `bun run push` でデプロイ
2. GASエディタで `initConfig()` を実行（設定を保存）
3. `syncCodingTime(90)` を実行（コーディング時間を再計算）

#### GASエディタで直接設定

```javascript
// デプロイ用ブランチを除外（部分一致）
configureCodingTimeExcludeBranches(['production', 'staging']);
// → ✅ Coding time exclude branches set to: production, staging (partial match)

// 現在の設定を確認
showCodingTimeExcludeBranches();
// → 📋 Coding time exclude branches: production, staging (partial match)

// 設定をリセット（全Issue対象に戻す）
resetCodingTimeExcludeBranchesConfig();
// → ✅ Coding time exclude branches reset (all issues will be included)
```

#### 部分一致による判定

ブランチ名は**部分一致**で判定されます。

---

## サイクルタイムとの違い

| 指標 | 起点 | 終点 | 測定対象 |
|------|------|------|---------|
| **コーディング時間** | Issue作成 | PR作成 | 純粋なコーディング |
| サイクルタイム | Issue作成 | Productionマージ | タスク全体 |

```
Issue作成 ──→ コーディング ──→ PR作成 ──→ レビュー ──→ マージ
│                              │                       │
└──── コーディング時間 ────────┘                       │
│                                                      │
└──────────────── サイクルタイム ──────────────────────┘
```

### 使い分け

- **コーディング時間**: AI支援ツールの効果測定、個人の生産性分析
- **サイクルタイム**: チーム全体のスループット、プロセス改善

---

## トラブルシューティング

### Issueが取得されない

- GitHub PATが有効か確認
- リポジトリへのアクセス権があるか確認

### リンクPRが検出されない

- PR本文に `Fixes #123` などのキーワードが含まれているか確認
- 同じリポジトリ内のIssueとPRか確認

### コーディング時間が0件

- リンクPRがないIssueはスキップされます
- 負の値（Issue作成前にPRが存在）はスキップされます

---

## 参考資料

- [SPACE Framework](https://queue.acm.org/detail.cfm?id=3454124) - Microsoft Research
- [計測思想](MEASUREMENT_PHILOSOPHY.md) - なぜIssue作成から計測するか
