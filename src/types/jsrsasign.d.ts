/**
 * jsrsasign ライブラリの型定義（必要な部分のみ）
 *
 * @see https://kjur.github.io/jsrsasign/
 */

declare module 'jsrsasign' {
  namespace KJUR {
    namespace jws {
      namespace JWS {
        /**
         * JWSを生成する
         *
         * @param alg - アルゴリズム（例: "RS256"）
         * @param sHeader - ヘッダーのJSON文字列
         * @param sPayload - ペイロードのJSON文字列
         * @param key - 秘密鍵（PEM形式）
         * @returns JWS文字列
         */
        function sign(alg: string, sHeader: string, sPayload: string, key: string): string;

        /**
         * JWSを検証する
         *
         * @param sJWS - JWS文字列
         * @param key - 公開鍵（PEM形式）
         * @param acceptAlgs - 許可するアルゴリズムの配列
         * @returns 検証成功時true
         */
        function verify(sJWS: string, key: string, acceptAlgs: string[]): boolean;
      }
    }
  }

  export { KJUR };
}
