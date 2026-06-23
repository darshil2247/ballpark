import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// base: "./" so the build runs from file:// too.
// viteSingleFile() inlines JS/CSS into one index.html — trivial to deploy or open.
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
});
