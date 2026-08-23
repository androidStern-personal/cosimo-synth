function bytesToHex(bytes) {
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function digestBounceBank(bytes) {
    if (!globalThis.crypto?.subtle) {
        throw new Error("Bounce requires the Web Crypto SHA-256 implementation");
    }
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return bytesToHex(new Uint8Array(digest));
}
