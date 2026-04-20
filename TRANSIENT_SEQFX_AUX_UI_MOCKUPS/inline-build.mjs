import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(dir, "dist");
const assetsDir = path.join(distDir, "assets");

const htmlPath = path.join(distDir, "index.html");
let html = await readFile(htmlPath, "utf8");

const files = await readdir(assetsDir);
const jsFile = files.find((n) => n.endsWith(".js"));
const cssFile = files.find((n) => n.endsWith(".css"));

if (!jsFile || !cssFile) {
    throw new Error("dist/assets must contain one .js and one .css");
}

const js = await readFile(path.join(assetsDir, jsFile), "utf8");
const css = await readFile(path.join(assetsDir, cssFile), "utf8");

html = html.replace(
    /<link[^>]*rel="stylesheet"[^>]*>\s*/g,
    () => `<style>\n${css}\n</style>\n`,
);

html = html.replace(
    /<script[^>]*type="module"[^>]*>\s*<\/script>\s*/g,
    () => `<script type="module">\n${js}\n</script>\n`,
);

await writeFile(htmlPath, html, "utf8");
console.log(`Inlined ${(js.length / 1024).toFixed(1)} kB JS + ${(css.length / 1024).toFixed(1)} kB CSS into ${path.relative(dir, htmlPath)}`);
