# Data-only dependency source URLs consumed by CosimoDependencies.cmake.
#
# This file is the single switch between dependency origins. In the Cosimo
# monorepo the Cmajor fork comes from GitHub; a Builder Kit export rendered
# with a feed URL (kit/scripts/export_kit.mjs, from kit/feed.json baseUrl or
# --feed-url) points COSIMO_CMAJOR_GIT_URL at the feed's cmajor.git mirror.
# CHOC arrives as a submodule of the Cmajor fork, so it follows that URL.
# JUCE always comes from the official repository. Commit pins live in
# CosimoDependencies.cmake, never here.
set(COSIMO_CMAJOR_GIT_URL "https://github.com/androidStern-personal/cmajor.git")
set(COSIMO_JUCE_GIT_URL "https://github.com/juce-framework/JUCE.git")
