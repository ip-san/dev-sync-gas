/**
 * Google Apps Script グローバルオブジェクトの型定義
 *
 * GASではグローバルスコープにエクスポートするためにglobalオブジェクトを使用する。
 * この型定義により、ESLintのno-unsafe-member-accessエラーを回避する。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GASグローバルオブジェクトの型
 * 動的にプロパティを設定するため、インデックスシグネチャを使用
 */
interface GasGlobal {
  [key: string]: (...args: any[]) => any;
}

declare const global: GasGlobal;
