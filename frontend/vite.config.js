import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

export default {
  plugins: [wasm(), topLevelAwait()],
};
