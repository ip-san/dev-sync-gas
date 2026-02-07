# 手戻り率

**PR作成後の追加コミット数とForce Push回数**を計測します。

```
PR作成 ───→ レビュー ───→ 修正 ───→ マージ
     │                    │
   最初の状態          追加コミット / Force Push
                       （= 手戻り）
```

---

## なぜ計測するのか

- **初回コード品質の測定**: 最初のコミットの完成度を評価
- **AI活用効果の測定**: AIコーディング導入前後の比較
- **レビュー効率の可視化**: レビュー指摘への対応量を把握

### AIと手戻り率

AIツール（Copilot、Claude等）を活用すると:

```
AI活用前                    AI活用後
─────────────────────────────────────────
追加コミット: 3-5/PR   →   1-2/PR
Force Push: 頻繁       →   減少
```

---

## 使い方

```javascript
// 過去30日間の手戻り率を計測（デフォルト）
syncReworkRate();

// 過去90日間
syncReworkRate(90);
```

---

## 設定

### デプロイ用PRの除外

デプロイ用PRは通常、開発プロセスが異なるため、統計を歪めることがあります。特定のbaseブランチへのマージを除外できます。

#### init.tsで設定（推奨）

`src/init.ts` に設定を記述して永続化できます：

```typescript
export const config: InitConfig = {
  // ... 他の設定 ...

  // 手戻り率計算から除外するbaseブランチ（部分一致）
  reworkRateExcludeBranches: ['production', 'staging'],
};
```

設定後の適用手順：
1. `bun run push` でデプロイ
2. GASエディタで `initConfig()` を実行（設定を保存）
3. `syncReworkRate(90)` を実行（手戻り率を再計算）

#### GASエディタで直接設定

```javascript
// デプロイ用ブランチを除外（部分一致）
configureReworkRateExcludeBranches(['production', 'staging']);
// → ✅ Rework rate exclude branches set to: production, staging (partial match)

// 現在の設定を確認
showReworkRateExcludeBranches();
// → 📋 Rework rate exclude branches: production, staging (partial match)

// 設定をリセット（全PR対象に戻す）
resetReworkRateExcludeBranchesConfig();
// → ✅ Rework rate exclude branches reset (all PRs will be included)
```

#### 部分一致による判定

ブランチ名は**部分一致**で判定されます。

---

## 出力されるシート

リポジトリごとに2つのシートが生成されます：

### 集約シート: `{owner/repo} - Rework Rate`

**日付ごとの統計**（トレンド分析用）

| 日付 | PR数 | 平均追加コミット | 中央値コミット | 平均Force Push | Force Push率 (%) | 記録日時 |
|------|------|----------------|--------------|---------------|-----------------|---------|
| 2024-01-10 | 5 | 2.4 | 2 | 0.6 | 40.0 | 2024-01-15 12:00 |
| 2024-01-11 | 3 | 1.7 | 1 | 0.3 | 33.3 | 2024-01-15 12:00 |

### 詳細シート: `{owner/repo} - Rework Rate - Details`

**PR単位の個別レコード**（ドリルダウン調査用）

| PR # | Title | Repository | Total Commits | Additional Commits | Force Push Count | Merged At |
|------|-------|------------|---------------|-------------------|------------------|-----------|
| 123 | Feature X | owner/repo | 5 | 2 | 0 | 2024-01-10T15:00 |
| 124 | Bug Fix | owner/repo | 3 | 1 | 1 | 2024-01-10T18:00 |

---

## 推奨値

| 指標 | 推奨値 |
|------|--------|
| 追加コミット数 | 2-3以下/PR |
| Force Push率 | 低いほど良い |

---

## 業界標準との違い

多くのツールは**書き換えられたコード行数（LOC）**で手戻りを測定しますが、本ツールは**コミット数**を使用しています。

| 観点 | LOCベース | コミットベース（本ツール） |
|------|-----------|------------------------|
| 修正規模 | 測定可能 | 測定不可 |
| 計測の容易さ | 複雑 | シンプル |
| 解釈のしやすさ | 専門知識が必要 | 直感的 |

**注意**: コミット粒度の影響を受けます。チーム内でコミット粒度のルールを統一することを推奨します。

---

## トラブルシューティング

### 「No merged PRs found」

- 期間を広げる
- `listRepos()` でリポジトリが正しく登録されているか確認

### Force Push回数が0

- Timeline API制限（古いPRでは取得不可）
- ブランチ保護が設定されている

---

## 参考資料

- [SPACE Framework](https://queue.acm.org/detail.cfm?id=3454124) - Efficiency and Flow
- [Code Climate - Rework](https://docs.velocity.codeclimate.com/en/articles/2913574-rework)
