import { defineConfig } from "vite";
import { resolve } from "node:path";

const fxRoot = new URL(".", import.meta.url).pathname;

const targets = {
  ott: { entry: resolve(fxRoot, "ott_lab/view/index.js"), outDir: resolve(fxRoot, "ott_lab/view") },
  chorus: { entry: resolve(fxRoot, "chorus_lab/view/index.js"), outDir: resolve(fxRoot, "chorus_lab/view") },
};

const target = targets[process.env.EFFECT_VIEW];

if (!target) {
  throw new Error(
    `Set EFFECT_VIEW to one of: ${Object.keys(targets).join(", ")}`,
  );
}

export default defineConfig({
  build: {
    target: "esnext",
    minify: false,
    emptyOutDir: false,
    lib: {
      entry: target.entry,
      formats: ["es"],
      fileName: () => "bundle.js",
    },
    outDir: target.outDir,
  },
});
