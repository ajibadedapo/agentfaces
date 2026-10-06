import { defineConfig, type Options } from "tsup";

const shared: Options = {
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  target: "es2020",
  external: ["agentfaces", "react", "react/jsx-runtime", "react-native", "react-native-svg"],
};

export default defineConfig([
  { ...shared, entry: { index: "src/index.ts" }, outDir: "dist", clean: true },
  { ...shared, entry: { index: "src/react/index.ts" }, outDir: "dist/react", banner: { js: '"use client";' } },
  { ...shared, entry: { index: "src/react-native/index.ts" }, outDir: "dist/react-native" },
  { ...shared, entry: { index: "src/svg/index.ts" }, outDir: "dist/svg" },
]);
