// Include the generated DSP unchanged and replace only the product factory.
#define createPluginFilter createGeneratedPluginFilter
#include "cmajor_plugin.cpp"
#undef createPluginFilter

class EnhanceThatReleasePlugin final : public Plugin
{
public:
    juce::AudioProcessorEditor* createEditor() override
    {
        auto* editor = new Editor (*this);
        // A fixed destination, not a generic URL/shell bridge. No network on load.
        editor->patchWebView->getWebView().bind ("enhance_openCheckout",
            [] (const choc::value::ValueView&) -> choc::value::Value
            {
                return choc::value::Value (juce::URL ("https://song-machines.com/enhance-that/checkout").launchInDefaultBrowser());
            });
        return editor;
    }
};

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new EnhanceThatReleasePlugin();
}
