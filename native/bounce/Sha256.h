#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <string>

namespace cosimo::bounce
{

class Sha256 final
{
public:
    using Digest = std::array<std::uint8_t, 32>;

    Sha256() noexcept;
    void update (const void* data, std::size_t byteCount) noexcept;
    Digest finish() const noexcept;

    static Digest hash (const void* data, std::size_t byteCount) noexcept;
    static Digest hashFile (const std::filesystem::path&);
    static std::string toHex (const Digest&);
    static Digest fromHex (const std::string&);

private:
    void transform (const std::uint8_t* block) noexcept;

    std::array<std::uint32_t, 8> state;
    std::array<std::uint8_t, 64> buffer {};
    std::uint64_t bitLength = 0;
    std::size_t bufferLength = 0;
};

} // namespace cosimo::bounce
