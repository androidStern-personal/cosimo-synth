#pragma once

#include "cmajor/helpers/cmaj_JUCEPlugin.h"

namespace cosimo
{
    template <typename Info, int maxEditorWidth>
    struct BoundedGeneratedPlugin final : cmaj::plugin::GeneratedPlugin<Info>
    {
        static_assert (maxEditorWidth >= 250);

        using Base = cmaj::plugin::GeneratedPlugin<Info>;
        using Base::Base;

        juce::AudioProcessorEditor* createEditor() override
        {
            auto* editor = Base::createEditor();
            editor->setResizeLimits (250, 160, maxEditorWidth, 32768);
            return editor;
        }
    };
}
