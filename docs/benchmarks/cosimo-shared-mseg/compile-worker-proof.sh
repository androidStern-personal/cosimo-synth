#!/bin/zsh
set -eu
base=$PWD/build/shared-mseg-proof/native-worker
cmajor=/Users/winterfell/.codex/worktrees/plugin-state-cmajor/cmajor
args=()
[[ $1 == aot ]] && args=(-DCOSIMO_BENCH_AOT=1 $base/AotFactory.cpp)
/usr/bin/c++ -std=c++17 -O2 -g0 -DCMAJOR_DLL=1 -DCOSIMO_MEASURED_WORKER_HEADER=\"$base/MeasuredWorker.h\" -I "$base/renderer" -I "$base/renderer/third_party/xsimd/include" -I "$base" -I "$cmajor/include" -I "$cmajor/include/choc" "$base/native-host.cpp" "${args[@]}" "$base/renderer/RendererBridge.cpp" "$base/renderer/WarpRenderer.cpp" -framework Accelerate -framework AudioToolbox -framework Cocoa -framework CoreAudio -framework CoreMIDI -framework Foundation -framework IOKit -o "$base/worker-$1"
