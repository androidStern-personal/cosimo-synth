import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
    root: import.meta.dirname,
    plugins: [react()],
    server: { host: '127.0.0.1', allowedHosts: ['.localhost'], fs: { allow: [path.resolve(import.meta.dirname, '../../..')] } },
    build: { outDir: path.resolve(import.meta.dirname, '../../../build/knob-docs'), emptyOutDir: true },
});
