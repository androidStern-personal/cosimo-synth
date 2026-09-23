import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
    root: import.meta.dirname,
    cacheDir: path.resolve(import.meta.dirname, "../../../build/.vite-mseg-docs"),
    plugins: [react()],
    server: { headers: {'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}, host: '127.0.0.1', allowedHosts: ['.localhost'], fs: { allow: [path.resolve(import.meta.dirname, '../../..')] } },
    build: { outDir: path.resolve(import.meta.dirname, '../../../build/mseg-docs'), emptyOutDir: true },
});
