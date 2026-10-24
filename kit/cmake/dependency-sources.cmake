# Data-only dependency source URLs consumed by dependencies.cmake.
#
# This file is the single switch between dependency origins. A delivered kit
# points BUILDER_KIT_CMAJOR_GIT_URL at the cmajor.git mirror on its download feed;
# the kit's own source repository points it at the fork on GitHub. CHOC
# arrives as a submodule of the Cmajor fork, so it follows that URL. JUCE
# always comes from the official repository. Commit pins live in
# dependencies.cmake, never here.
set(BUILDER_KIT_CMAJOR_GIT_URL "https://github.com/androidStern-personal/cmajor.git")
set(BUILDER_KIT_JUCE_GIT_URL "https://github.com/juce-framework/JUCE.git")
