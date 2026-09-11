#include "PluginState.h"
#include <fstream>
#include <iostream>
#include <stdexcept>

using PatchData = cmaj::PatchSharedData;
using Store = cmaj::SharedDataStore;

void expect (bool result, const char* message)
{
    if (! result) throw std::runtime_error (message);
}

void expectDefaults()
{
    const auto value = PluginState::settings.readForAudioBlock();
    expect (value.amount == 1.0f && value.enabled
            && value.mode == decltype (value.mode)::clean
            && value.a.b == decltype (value.a.b)::low
            && value.a_b == decltype (value.a_b)::off, "generated nested defaults are wrong");
    expect (PluginState::settings_value.readForAudioBlock() == 0.25f, "resource/type collision changed scalar default");
    expect (! PluginState::settings_codec.readForAudioBlock(), "resource/codec collision changed boolean default");
}

template <typename Run> void block (PatchData& data, Run run)
{
    data.store.beginBlock();
    { PatchData::ReadScope scope (&data); run(); }
    data.store.endBlock();
    data.drain();
}

void submit (PatchData& data, const std::vector<std::int32_t>& words)
{
    const auto request = data.store.beginRequest (SETTINGS_INPUT, 1);
    expect (request.status == Store::RequestStatus::ready, "generated setting request rejected");
    expect (data.store.submitBytes (request.ticket, std::make_shared<std::vector<std::int32_t>> (words))
            == Store::SubmitResult::accepted, "generated setting bytes rejected");
}

int main (int argc, char** argv)
{
    try
    {
        expect (argc == 2, "expected authored preparation bytes");
        std::ifstream file (argv[1], std::ios::binary);
        std::vector<std::int32_t> words (5);
        file.read (reinterpret_cast<char*> (words.data()), static_cast<std::streamsize> (words.size() * 4));
        expect (file.gcount() == 20 && file.peek() == std::ifstream::traits_type::eof(), "unexpected authored record length");
        PatchData data (INPUT_COUNT, 1024);
        expectDefaults();
        block (data, expectDefaults);
        submit (data, words);
        block (data, [&]
        {
            const auto value = PluginState::settings.readForAudioBlock();
            expect (value.amount == 1.5f && ! value.enabled
                    && value.mode == decltype (value.mode)::warm
                    && value.a.b == decltype (value.a.b)::high
                    && value.a_b == decltype (value.a_b)::on, "authored bytes did not reach generated nested reader");
        });
        expectDefaults();
        // Every invalid member must restore the whole authored default record.
        for (const auto invalid : { std::pair<int, std::int32_t>{0, -1}, {1, 2}, {2, 0x40400000},
                                    {2, 0x7fc00000}, {2, 0x7f800000}, {3, 2}, {4, 99} })
        {
            auto corrupted = words;
            corrupted[invalid.first] = invalid.second;
            submit (data, corrupted);
            block (data, expectDefaults);
        }
        for (const auto size : {4u, 6u})
        {
            auto malformed = words;
            malformed.resize (size);
            submit (data, malformed);
            block (data, expectDefaults);
        }
        data.stop();
        std::cout << "PASS generated nativeValue: nested type collisions, author bytes, defaults, enum/bool/float validation and exact size\n";
    }
    catch (const std::exception& error) { std::cerr << error.what() << '\n'; return 1; }
}
