# Sole source-identity authority for Cosimo build dependencies.
# Every revision is immutable; build entrypoints must resolve these values through
# scripts/resolve_build_dependencies.py rather than introducing another source path.

set(COSIMO_CPM_VERSION "0.43.1")
set(COSIMO_CPM_COMMIT "456cb6754daaa010d57444d0c8ce6d95ecf006ab")
set(COSIMO_CPM_SHA256 "1c40fc102ce9625d7de7eb14f541cab30cc3138dca627f0b0ec40293ce6c2934")

set(COSIMO_CMAJOR_REPOSITORY "https://github.com/androidStern-personal/cmajor.git")
set(COSIMO_CMAJOR_COMMIT "ee3c0d03944ccf281bc3b7d065d3daeb027aec6a")

set(COSIMO_CHOC_REPOSITORY "https://github.com/androidStern-personal/choc.git")
set(COSIMO_CHOC_COMMIT "037e34a2b382175c8bee4be5a0707724130f10e8")

set(COSIMO_JUCE_REPOSITORY "https://github.com/juce-framework/JUCE.git")
set(COSIMO_JUCE_COMMIT "501c07674e1ad693085a7e7c398f205c2677f5da")
