import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";
import tsconfigPaths from "vite-tsconfig-paths";

export default {
  plugins: [wasm(), topLevelAwait(), tsconfigPaths()],
};
