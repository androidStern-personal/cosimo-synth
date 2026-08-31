#!/bin/bash
# Provisions Claude Code on the web sessions so the full web engine build
# (npm run web:build) and the node test suites work without manual setup.
#
# What the web build needs beyond a bare container:
#   1. npm dependencies (vite, playwright, etc.)
#   2. A wasm32-wasi C++ toolchain for native/three_oscillator_renderer
#      (scripts/build_three_oscillator_renderer_wasm.sh already understands
#      the Ubuntu multiarch layout; it just needs the packages and the
#      COSIMO_RENDERER_* variables pointing at them).
#   3. Git access to the pinned Cmajor fork (androidStern-personal/cmajor)
#      for the CPM fetch in cmake/CosimoDependencies.cmake. That is a repo
#      permission, not a package: it must be granted to the session (via
#      Claude's GitHub repo scope / add_repo), so this hook only reports
#      whether it is reachable rather than trying to install anything.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "[session-start] installing lockfile-exact npm dependencies"
npm ci --no-audit --no-fund
echo "[session-start] JavaScript toolchain: node $(node --version), npm $(npm --version)"

readonly WASI_PACKAGES=(
  wasi-libc
  libc++-18-dev-wasm32
  libclang-rt-18-dev-wasm32
  lld-18
)

if [ ! -f /usr/lib/wasm32-wasi/crt1-reactor.o ] || [ ! -x /usr/lib/llvm-18/bin/wasm-ld ]; then
  echo "[session-start] installing wasm32-wasi toolchain (wasi-libc, libc++ wasm32, clang-rt wasm32, lld)"
  apt-get update -qq
  apt-get install -y -qq "${WASI_PACKAGES[@]}"
else
  echo "[session-start] wasm32-wasi toolchain already present"
fi

echo "[session-start] resolved wasm32-wasi packages:"
dpkg-query -W -f='  ${binary:Package}=${Version}\n' "${WASI_PACKAGES[@]}"

# The renderer build script defaults to Homebrew paths; point it at the
# Ubuntu layout for every shell in this session.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo 'export COSIMO_RENDERER_LLVM_DIR=/usr/lib/llvm-18'
    echo 'export COSIMO_RENDERER_WASI_C_DIR=/usr'
    echo 'export COSIMO_RENDERER_WASI_CXX_DIR=/usr'
  } >> "$CLAUDE_ENV_FILE"
fi

# The Cmajor fork pins public submodules with SSH URLs while remote sessions
# use the HTTPS credential proxy. Scope those rewrites to this Claude session;
# never mutate the account's global Git configuration from a project hook.
session_has_git_url_rewrite() {
  local needle="$1"
  local count="${GIT_CONFIG_COUNT:-0}"
  local index key_name value_name
  for ((index = 0; index < count; index += 1)); do
    key_name="GIT_CONFIG_KEY_${index}"
    value_name="GIT_CONFIG_VALUE_${index}"
    if [ "${!key_name:-}" = "url.https://github.com/.insteadOf" ] && [ "${!value_name:-}" = "$needle" ]; then
      return 0
    fi
  done
  return 1
}

append_session_git_url_rewrite() {
  local needle="$1"
  if session_has_git_url_rewrite "$needle"; then
    return
  fi

  local index="${GIT_CONFIG_COUNT:-0}"
  local key_name="GIT_CONFIG_KEY_${index}"
  local value_name="GIT_CONFIG_VALUE_${index}"
  export "${key_name}=url.https://github.com/.insteadOf"
  export "${value_name}=${needle}"
  export GIT_CONFIG_COUNT="$((index + 1))"

}

append_session_git_url_rewrite "git@github.com:"
append_session_git_url_rewrite "ssh://git@github.com/"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  for ((index = 0; index < GIT_CONFIG_COUNT; index += 1)); do
    key_name="GIT_CONFIG_KEY_${index}"
    value_name="GIT_CONFIG_VALUE_${index}"
    printf 'export %s=%q\n' "$key_name" "${!key_name}" >> "$CLAUDE_ENV_FILE"
    printf 'export %s=%q\n' "$value_name" "${!value_name}" >> "$CLAUDE_ENV_FILE"
  done
  printf 'export GIT_CONFIG_COUNT=%q\n' "$GIT_CONFIG_COUNT" >> "$CLAUDE_ENV_FILE"
fi

# CPM in cmake/CosimoDependencies.cmake clones the private Cmajor fork on the
# first engine build. Report reachability so a session knows up front whether
# `npm run web:build` can work or the repo still needs to be added to the
# session's GitHub scope first.
reachable=true
for repository in androidStern-personal/cmajor androidStern-personal/choc; do
  if ! git ls-remote --exit-code "https://github.com/$repository.git" HEAD > /dev/null 2>&1; then
    reachable=false
    echo "[session-start] WARNING: $repository is not reachable with this session's git credentials."
  fi
done
if [ "$reachable" = true ]; then
  echo "[session-start] Cmajor fork and choc fork are reachable; npm run web:build can fetch the engine toolchain"
else
  echo "[session-start] The engine build (npm run web:build) will fail at the CPM fetch until the repos above are"
  echo "[session-start] added to this session's GitHub scope (ask Claude to add them, or grant them in the Claude"
  echo "[session-start] GitHub settings so every session has them)."
fi

echo "[session-start] done"
