#include "PluginState.h"

extern "C" {
void beginSharedBlock() noexcept { PluginState::Data::beginSharedBlock(); }
void endSharedBlock() noexcept { PluginState::Data::endSharedBlock(); }
float readSettings() noexcept
{
    const auto value = PluginState::settings.readForAudioBlock();
    return value.amount + (value.enabled ? 10.0f : 0.0f)
        + static_cast<float> (value.mode) * 100.0f
        + static_cast<float> (value.a.b) * 1000.0f
        + static_cast<float> (value.a_b) * 10000.0f;
}
float readScalar() noexcept { return PluginState::settings_value.readForAudioBlock(); }
bool readBoolean() noexcept { return PluginState::settings_codec.readForAudioBlock(); }
}
