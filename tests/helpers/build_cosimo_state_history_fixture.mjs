import { build } from 'esbuild';
import { mkdir, readFile, writeFile, symlink } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const output = path.resolve(process.argv[2] ?? path.join(root, 'build/cosimo-state-history-proof'));
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(root, 'WavetableSynth.cmajorpatch'), 'utf8'));
manifest.source = manifest.source.map(file => path.relative(output, path.join(root, file)));
manifest.worker = path.relative(output, path.join(root, 'patch_gui/wavetable-worker.js'));
await writeFile(path.join(output, 'Cosimo.cmajorpatch'), JSON.stringify(manifest, null, 2) + '\n');
try { await symlink(path.join(root, 'assets'), path.join(output, 'assets')); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
await build({ entryPoints: [path.join(root, 'tests/native/cosimo-state-history-client.ts')],
    outfile: path.join(output, 'client.js'), bundle: true, format: 'iife', platform: 'browser', target: 'es2022',
    define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
console.log(path.join(output, 'Cosimo.cmajorpatch'));
