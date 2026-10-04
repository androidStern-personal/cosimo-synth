import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
const root = import.meta.dirname;
export default defineConfig({
    root,
    cacheDir: path.resolve(root, "../../build/.vite-component-docs"),
    plugins: [react()],
    server: {
        host: "127.0.0.1", allowedHosts: [".localhost"],
        headers: { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" },
        fs: { allow: [path.resolve(root, "../..")] },
    },
    build: {
        outDir: path.resolve(root, "../../build/component-docs"), emptyOutDir: true,
        rollupOptions: { input: Object.fromEntries(["", "knobs", "mseg", "filters", "sliders"].map(name => [name || "index", path.join(root, name, "index.html")])) },
    },
});
