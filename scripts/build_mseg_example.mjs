// Maintainer command: freeze the public example's real DSP with this worktree's pinned compiler.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
const root = path.resolve(import.meta.dirname, '..')
const output = path.join(root, 'kit/examples/mseg')
const temp = await mkdtemp(path.join(tmpdir(), 'mseg-example-'))
try {
    const cache = await readFile(path.join(root, 'build/cmajor_external_codegen-host/CMakeCache.txt'), 'utf8')
    const source = cache.match(/^CPM_PACKAGE_cosimo_cmajor_toolchain_SOURCE_DIR:INTERNAL=(.+)$/m)?.[1]
    if (!source) throw new Error('Configure the worktree-local pinned external generator first.')
    const files = ['kit/cmajor/mseg.cmajor', 'kit/examples/mseg/playback.cmajor', 'kit/cmake/CosimoDependencies.cmake']
    const hashes = {}
    for (const name of files) {
        const bytes = await readFile(path.join(root, name))
        hashes[name] = createHash('sha256').update(bytes).digest('hex')
        if (name.endsWith('.cmajor')) await writeFile(path.join(temp, path.basename(name)), bytes)
    }
    await writeFile(
        path.join(temp, 'playback.cmajorpatch'),
        JSON.stringify({
            CmajorVersion: 1,
            ID: 'dev.builderkit.mseg.example',
            version: '1',
            name: 'MSEG Playback',
            source: ['playback.cmajor', 'mseg.cmajor'],
        }),
    )
    const program = path.join(temp, 'program.js')
    execFileSync(path.join(root, 'build/cmajor_external_codegen-host/cosimo_cmajor_external_codegen'), [
        path.join(temp, 'playback.cmajorpatch'),
        program,
        'MsegPlayback',
        '--target',
        'javascript',
        '--max-frames-per-block',
        '128',
        '--shared-memory-maximum-pages',
        '256',
    ])
    await writeFile(
        path.join(output, 'playback-program.js'),
        (await readFile(program, 'utf8')) + '\nexport default MsegPlayback;\n',
    )
    const reader = await readFile(path.join(source, 'javascript/cmaj_api/cmaj-shared-data-reader.js'), 'utf8')
    const wasm = reader.match(/atob\('([^']+)'\)/)?.[1]
    if (!wasm) throw new Error('Pinned shared reader format changed.')
    await writeFile(path.join(output, 'playback-reader.json'), JSON.stringify({ wasm }) + '\n')
    for (const name of ['playback-program.js', 'playback-reader.json'])
        hashes['kit/examples/mseg/' + name] = createHash('sha256')
            .update(await readFile(path.join(output, name)))
            .digest('hex')
    await writeFile(
        path.join(output, 'playback-provenance.json'),
        JSON.stringify({ generatedBy: 'scripts/build_mseg_example.mjs', sha256: hashes }, null, 2) + '\n',
    )
    console.log('Frozen real MSEG playback example and source fingerprints.')
} finally {
    await rm(temp, { recursive: true, force: true })
}
