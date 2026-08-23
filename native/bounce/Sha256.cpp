#include "Sha256.h"

#include <algorithm>
#include <fstream>
#include <stdexcept>

namespace cosimo::bounce
{
namespace
{
constexpr std::array<std::uint32_t, 64> constants {
    0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u,
    0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
    0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u,
    0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
    0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu,
    0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
    0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u,
    0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
    0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u,
    0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
    0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u,
    0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
    0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u,
    0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
    0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u,
    0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u,
};

constexpr std::uint32_t rotateRight (std::uint32_t value, std::uint32_t count) noexcept
{
    return (value >> count) | (value << (32u - count));
}

std::uint8_t hexNibble (char character)
{
    if (character >= '0' && character <= '9')
        return static_cast<std::uint8_t> (character - '0');
    if (character >= 'a' && character <= 'f')
        return static_cast<std::uint8_t> (character - 'a' + 10);
    throw std::invalid_argument ("SHA-256 digest must use lowercase hexadecimal");
}
}

Sha256::Sha256() noexcept
    : state { 0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
              0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u }
{
}

void Sha256::update (const void* input, std::size_t byteCount) noexcept
{
    const auto* bytes = static_cast<const std::uint8_t*> (input);
    if (bytes == nullptr || byteCount == 0)
        return;

    bitLength += static_cast<std::uint64_t> (byteCount) * 8u;
    while (byteCount > 0)
    {
        const auto copied = std::min (byteCount, buffer.size() - bufferLength);
        std::copy_n (bytes, copied, buffer.begin() + static_cast<std::ptrdiff_t> (bufferLength));
        bufferLength += copied;
        bytes += copied;
        byteCount -= copied;
        if (bufferLength == buffer.size())
        {
            transform (buffer.data());
            bufferLength = 0;
        }
    }
}

Sha256::Digest Sha256::finish() const noexcept
{
    auto copy = *this;
    const auto originalBitLength = copy.bitLength;
    const std::uint8_t marker = 0x80;
    copy.update (&marker, 1);
    const std::uint8_t zero = 0;
    while (copy.bufferLength != 56)
        copy.update (&zero, 1);

    std::array<std::uint8_t, 8> lengthBytes {};
    for (std::size_t index = 0; index < lengthBytes.size(); ++index)
        lengthBytes[7 - index] = static_cast<std::uint8_t> (originalBitLength >> (index * 8));
    copy.update (lengthBytes.data(), lengthBytes.size());

    Digest digest {};
    for (std::size_t word = 0; word < copy.state.size(); ++word)
        for (std::size_t byte = 0; byte < 4; ++byte)
            digest[word * 4 + byte] = static_cast<std::uint8_t> (
                copy.state[word] >> ((3 - byte) * 8));
    return digest;
}

Sha256::Digest Sha256::hash (const void* data, std::size_t byteCount) noexcept
{
    Sha256 hash;
    hash.update (data, byteCount);
    return hash.finish();
}

Sha256::Digest Sha256::hashFile (const std::filesystem::path& path)
{
    std::ifstream input (path, std::ios::binary);
    if (! input)
        throw std::runtime_error ("Could not open file for SHA-256: " + path.string());
    Sha256 hash;
    std::array<char, 64 * 1024> bytes {};
    while (input)
    {
        input.read (bytes.data(), static_cast<std::streamsize> (bytes.size()));
        const auto count = input.gcount();
        if (count > 0)
            hash.update (bytes.data(), static_cast<std::size_t> (count));
    }
    if (! input.eof())
        throw std::runtime_error ("Could not finish SHA-256 read: " + path.string());
    return hash.finish();
}

std::string Sha256::toHex (const Digest& digest)
{
    constexpr char digits[] = "0123456789abcdef";
    std::string result (digest.size() * 2, '0');
    for (std::size_t index = 0; index < digest.size(); ++index)
    {
        result[index * 2] = digits[digest[index] >> 4];
        result[index * 2 + 1] = digits[digest[index] & 0x0f];
    }
    return result;
}

Sha256::Digest Sha256::fromHex (const std::string& hex)
{
    if (hex.size() != 64)
        throw std::invalid_argument ("SHA-256 digest must contain 64 lowercase hex characters");
    Digest digest {};
    for (std::size_t index = 0; index < digest.size(); ++index)
        digest[index] = static_cast<std::uint8_t> (
            (hexNibble (hex[index * 2]) << 4) | hexNibble (hex[index * 2 + 1]));
    return digest;
}

void Sha256::transform (const std::uint8_t* block) noexcept
{
    std::array<std::uint32_t, 64> words {};
    for (std::size_t index = 0; index < 16; ++index)
    {
        const auto offset = index * 4;
        words[index] = (static_cast<std::uint32_t> (block[offset]) << 24)
                     | (static_cast<std::uint32_t> (block[offset + 1]) << 16)
                     | (static_cast<std::uint32_t> (block[offset + 2]) << 8)
                     | static_cast<std::uint32_t> (block[offset + 3]);
    }
    for (std::size_t index = 16; index < words.size(); ++index)
    {
        const auto s0 = rotateRight (words[index - 15], 7)
                      ^ rotateRight (words[index - 15], 18)
                      ^ (words[index - 15] >> 3);
        const auto s1 = rotateRight (words[index - 2], 17)
                      ^ rotateRight (words[index - 2], 19)
                      ^ (words[index - 2] >> 10);
        words[index] = words[index - 16] + s0 + words[index - 7] + s1;
    }

    auto a = state[0];
    auto b = state[1];
    auto c = state[2];
    auto d = state[3];
    auto e = state[4];
    auto f = state[5];
    auto g = state[6];
    auto h = state[7];
    for (std::size_t index = 0; index < words.size(); ++index)
    {
        const auto sum1 = rotateRight (e, 6) ^ rotateRight (e, 11) ^ rotateRight (e, 25);
        const auto choice = (e & f) ^ ((~e) & g);
        const auto temp1 = h + sum1 + choice + constants[index] + words[index];
        const auto sum0 = rotateRight (a, 2) ^ rotateRight (a, 13) ^ rotateRight (a, 22);
        const auto majority = (a & b) ^ (a & c) ^ (b & c);
        const auto temp2 = sum0 + majority;
        h = g;
        g = f;
        f = e;
        e = d + temp1;
        d = c;
        c = b;
        b = a;
        a = temp1 + temp2;
    }
    state[0] += a;
    state[1] += b;
    state[2] += c;
    state[3] += d;
    state[4] += e;
    state[5] += f;
    state[6] += g;
    state[7] += h;
}

} // namespace cosimo::bounce
