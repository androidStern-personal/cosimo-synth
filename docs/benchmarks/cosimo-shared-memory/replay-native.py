"""Replay the preserved, hash-identified native benchmark binaries; no rebuilding."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

package = Path(__file__).resolve().parent
repo = package.parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, help='New output directory; required unless verifying only')
parser.add_argument('--verify-only', action='store_true')
args = parser.parse_args()
identity = json.loads((package / 'native-identity.json').read_text())
for relative, expected in identity['sha256'].items():
    artifact = repo / relative
    actual = hashlib.sha256(artifact.read_bytes()).hexdigest()
    if actual != expected:
        raise SystemExit(f'Artifact changed: {relative}; restore the recorded artifact before replaying.')
print('Recorded native artifact hashes match.')
if args.verify_only:
    raise SystemExit(0)
if args.output is None:
    parser.error('--output is required')
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=False)
base = repo / 'build/cosimo_shared_memory_baseline'
runtime = repo / 'build/native_plugin_state_runtime/lib/libCmajPerformer.dylib'
cases = [('old-jit', base / 'CosimoBaseline', base / 'runtime'),
         ('new-jit', base / 'current/CosimoCurrent', base / 'current/runtime'),
         ('old-aot', base / 'CosimoBaselineAot', base / 'runtime'),
         ('new-aot', base / 'current/CosimoCurrentAot', base / 'current/runtime')]
results = []
for name, binary, resources in cases:
    print(f'Running {name}', flush=True)
    with (output / f'{name}.log').open('w') as log:
        subprocess.run([str(binary), str(runtime), str(resources / 'WavetableSynth.cmajorpatch'), '3'],
                       stdout=log, stderr=subprocess.STDOUT, check=True, timeout=80,
                       env={**os.environ, 'COSIMO_BENCH_AUDIO': str(output / f'{name}.f32')})
    line = next(line for line in (output / f'{name}.log').read_text().splitlines()
                if line.startswith('RESULT '))
    results.append({'case': name, **json.loads(line[7:])})
(output / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
for mode in ['jit', 'aot']:
    comparison = subprocess.check_output([sys.executable, str(package / 'compare-audio.py'),
                                         str(output / f'old-{mode}.f32'),
                                         str(output / f'new-{mode}.f32')], text=True)
    (output / f'{mode}-audio-comparison.json').write_text(comparison)
print(output / 'results.json')
