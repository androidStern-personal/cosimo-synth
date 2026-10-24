#include "../../kit/native/native_state/NativeValue.h"
#if defined(__wasm32__)
 #include "../../kit/native/shared_data/WasmSharedData.h"
 using Data = builder_kit::shared_data::WasmData<2>;
#else
 #include "../../kit/native/shared_data/NativeSharedData.h"
 #include <iostream>
 #include <stdexcept>
 using Data = builder_kit::shared_data::NativeData<2>;
#endif

namespace ns = builder_kit::native_state;
enum class Quality : std::int32_t { normal, high, maximum };
struct Settings { float amount; bool enabled; Quality quality; };
struct SettingsCodec
{
    static constexpr std::size_t wordCount = 3;
    static bool decode (const void* bytes, Settings& value) noexcept
    {
        return ns::decodeFloat (bytes, 0, 0.0f, 1.0f, value.amount)
            && ns::decodeBool (bytes, 1, value.enabled) && ns::decodeEnum (bytes, 2, 3, value.quality);
    }
};
struct GainCodec
{
    static constexpr std::size_t wordCount = 1;
    static bool decode (const void* bytes, float& value) noexcept
    {
        return ns::decodeFloat (bytes, 0, 0.0f, 1.0f, value);
    }
};
constexpr ns::Value<float, GainCodec, Data> gain { 0, 0.5f };
constexpr ns::Value<Settings, SettingsCodec, Data> settings { 1, { 0.25f, false, Quality::normal } };

float settingsScore() noexcept
{
    const auto value = settings.readForAudioBlock();
    return value.amount + (value.enabled ? 10.0f : 0.0f) + static_cast<float> (value.quality) * 100.0f;
}

#if defined(__wasm32__)
extern "C" {
void beginSharedBlock() noexcept { Data::beginSharedBlock(); }
void endSharedBlock() noexcept { Data::endSharedBlock(); }
float readSettings() noexcept { return settingsScore(); }
float readGain() noexcept { return gain.readForAudioBlock(); }
}
#else
using PatchData = cmaj::PatchSharedData;
using Store = cmaj::SharedDataStore;
void expect (bool result, const char* message) { if (! result) throw std::runtime_error (message); }

void submit (PatchData& data, int input, float amount, int enabled = 0, int quality = 0)
{
    auto bytes = std::make_shared<std::vector<std::int32_t>> (input == 0 ? 1 : 3);
    std::memcpy (bytes->data(), &amount, sizeof (amount));
    if (input == 1) { (*bytes)[1] = enabled; (*bytes)[2] = quality; }
    const auto request = data.store.beginRequest (input, 1);
    expect (request.status == Store::RequestStatus::ready, "setting request rejected");
    expect (data.store.submitBytes (request.ticket, bytes) == Store::SubmitResult::accepted, "setting submit rejected");
}

template <typename Run> void block (PatchData& data, Run run)
{
    data.store.beginBlock();
    { PatchData::ReadScope scope (&data); run(); }
    data.store.endBlock(); data.drain();
}

int main()
{
    try
    {
        PatchData first (2, 256), second (2, 256);
        expect (gain.readForAudioBlock() == 0.5f && settingsScore() == 0.25f, "unscoped settings lack defaults");
        submit (first, 0, 0.75f); submit (first, 1, 0.125f, 1, 2);
        submit (second, 1, 0.875f, 0, 1);
        block (first, [&]
        {
            expect (gain.readForAudioBlock() == 0.75f && settingsScore() == 210.125f, "typed settings not adopted");
            block (second, [&] { expect (settingsScore() == 100.875f, "typed settings crossed instances"); });
            expect (settingsScore() == 210.125f, "nested scope did not restore settings");
            const auto retained = settings.readForAudioBlock();
            submit (first, 1, 0.625f, 0, 1);
            expect (settingsScore() == 210.125f, "pending setting changed current block");
            expect (retained.amount == 0.125f && retained.quality == Quality::maximum, "snapshot was not a value copy");
        });
        block (first, [&] { expect (settingsScore() == 100.625f, "setting replacement not adopted"); });
        expect (settingsScore() == 0.25f, "setting cache leaked outside audio block");
        submit (first, 1, 0.9f, 4, 1);
        block (first, [&] { expect (settingsScore() == 0.25f, "invalid boolean partially changed record"); });
        submit (first, 1, 0.9f, 1, 9);
        block (first, [&] { expect (settingsScore() == 0.25f, "invalid enum partially changed record"); });
        submit (first, 0, 3.0f);
        block (first, [&] { expect (gain.readForAudioBlock() == 0.5f, "out-of-range number accepted"); });
        submit (first, 0, std::numeric_limits<float>::quiet_NaN());
        block (first, [&] { expect (gain.readForAudioBlock() == 0.5f, "nonfinite number accepted"); });
        auto shortRecord = std::make_shared<std::vector<std::int32_t>> (1, 0);
        const auto shortRequest = first.store.beginRequest (1, 1);
        expect (first.store.submitBytes (shortRequest.ticket, shortRecord) == Store::SubmitResult::accepted, "short test resource rejected by storage");
        block (first, [&] { expect (settingsScore() == 0.25f, "truncated record accepted"); });
        first.stop(); second.stop();
        std::cout << "PASS typed native settings: scalar, bool, enum, bounded record, block publication, instance isolation and validation\n";
    }
    catch (const std::exception& error) { std::cerr << error.what() << '\n'; return 1; }
}
#endif
