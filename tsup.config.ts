import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs"], // 输出 CommonJS 模块
    dts: true,       // 生成 .d.ts 文件
    outDir: "dist/commonjs"
  },
  {
    entry: ["src/index.ts"],
    format: ["esm"], // 输出 ESNext 模块
    dts: false,      // 避免重复生成
    outDir: "dist/esnext"
  }
]);
