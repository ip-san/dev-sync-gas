/**
 * Google Apps Script グローバルオブジェクトの型定義
 *
 * GASではグローバルスコープにエクスポートするためにglobalオブジェクトを使用する。
 * この型定義により、動的なプロパティ設定を型安全に行える。
 */

/**
 * GASグローバルオブジェクトの型
 * 動的にプロパティを設定するため、インデックスシグネチャを使用
 */
interface GasGlobal {
  // biome-ignore lint/suspicious/noExplicitAny: GAS global requires dynamic function signatures
  [key: string]: (...args: any[]) => any;
}

declare const global: GasGlobal;
