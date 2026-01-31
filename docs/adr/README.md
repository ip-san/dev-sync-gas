# Architecture Decision Records (ADR)

本ディレクトリには、DevSyncGASプロジェクトの重要な設計判断を記録します。

## ADRとは

ADR（Architecture Decision Record）は、ソフトウェアアーキテクチャに関する重要な決定を記録する文書です。「なぜそうなっているか」を後から追跡できるようにします。

## ADR一覧

| ADR | タイトル | ステータス |
|-----|---------|-----------|
| [0000](0000-template.md) | テンプレート | - |
| [0001](0001-graphql-api-default.md) | GraphQL APIをデフォルトにする | 承認 |
| [0002](0002-di-container-for-gas-abstraction.md) | DIコンテナによるGAS API抽象化 | 承認 |

## いつADRを書くか

以下のような決定をしたときにADRを作成します：

- アーキテクチャの大きな変更
- 技術スタック・ライブラリの選定
- 複数の選択肢から特定のアプローチを選んだとき
- 将来「なぜこうなっているのか」と疑問に思いそうな決定

## ADRの書き方

1. `0000-template.md`をコピー
2. 連番を付けてリネーム（例: `0003-feature-name.md`）
3. テンプレートに沿って記述
4. このREADMEの一覧に追加
5. PRでレビュー・マージ

## 参考

- [ADR GitHub Organization](https://adr.github.io/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
