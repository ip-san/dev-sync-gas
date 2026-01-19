import { build } from "esbuild";
import { GasPlugin } from "esbuild-gas-plugin";

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "dist/Code.js",
  format: "iife",
  target: "es2020",
  plugins: [GasPlugin],
  minify: false,
  keepNames: true,
});

console.log("✅ Build completed: dist/Code.js");
