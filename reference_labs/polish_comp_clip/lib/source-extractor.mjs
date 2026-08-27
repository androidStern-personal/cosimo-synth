import { createHash } from "node:crypto";

const DOUBLE_TYPE = 0x07;

function assertRange(data, offset, length, label) {
    if (offset < 0 || length < 0 || offset + length > data.length) {
        throw new Error(`${label} is outside the ${data.length}-byte source`);
    }
}

function u32Buffer(value) {
    const result = Buffer.alloc(4);
    result.writeUInt32BE(value, 0);
    return result;
}

function tokenPattern(text) {
    const value = Buffer.from(text, "utf8");
    return Buffer.concat([u32Buffer(value.length), value]);
}

function findToken(data, text, start = 0, end = data.length) {
    const pattern = tokenPattern(text);
    const offset = data.indexOf(pattern, start);
    if (offset < 0 || offset + pattern.length > end) {
        throw new Error(`Missing length-prefixed token ${JSON.stringify(text)} in ${start}..${end}`);
    }
    return { offset, endOffset: offset + pattern.length, pattern };
}

function doubleEvidence(data, recordOffset, valueOffset, recordEndOffset) {
    assertRange(data, valueOffset, 8, "double payload");
    assertRange(data, recordOffset, recordEndOffset - recordOffset, "double record");
    const payload = data.subarray(valueOffset, valueOffset + 8);
    return {
        value: payload.readDoubleBE(0),
        ieee754Hex: payload.toString("hex"),
        valueOffset,
        recordOffset,
        recordHex: data.subarray(recordOffset, recordEndOffset).toString("hex"),
    };
}

function findNamedDouble(data, name, start, end) {
    const token = tokenPattern(name);
    let recordOffset = data.indexOf(token, start);
    while (recordOffset >= 0 && recordOffset + token.length + 13 <= end) {
        const markerOffset = recordOffset + token.length;
        const typeOffset = markerOffset + 4;
        if (data[typeOffset] === DOUBLE_TYPE) {
            return doubleEvidence(data, recordOffset, typeOffset + 1, typeOffset + 9);
        }
        recordOffset = data.indexOf(token, recordOffset + 1);
    }
    throw new Error(`Missing tagged double ${name} in ${start}..${end}`);
}

function findFieldDouble(data, fieldId, start, end) {
    const pattern = Buffer.concat([u32Buffer(fieldId), Buffer.from([DOUBLE_TYPE])]);
    const recordOffset = data.indexOf(pattern, start);
    if (recordOffset < 0 || recordOffset + pattern.length + 8 > end) {
        throw new Error(`Missing double field 0x${fieldId.toString(16)} in ${start}..${end}`);
    }
    const valueOffset = recordOffset + pattern.length;
    return doubleEvidence(data, recordOffset, valueOffset, valueOffset + 8);
}

function scanAsciiTokens(data, start, end) {
    const tokens = [];
    let offset = start;
    while (offset + 4 <= end) {
        const length = data.readUInt32BE(offset);
        const valueOffset = offset + 4;
        const valueEnd = valueOffset + length;
        if (length >= 1 && length <= 256 && valueEnd <= end) {
            const bytes = data.subarray(valueOffset, valueEnd);
            if (bytes.every((byte) => byte >= 0x20 && byte <= 0x7e)) {
                tokens.push({ offset, endOffset: valueEnd, value: bytes.toString("ascii") });
                offset = valueEnd;
                continue;
            }
        }
        offset += 1;
    }
    return tokens;
}

function extractToolVolume(data, label, endLabel) {
    const start = findToken(data, label).offset;
    const end = findToken(data, endLabel, start + 1).offset;
    return findNamedDouble(data, "VOLUME", start, end);
}

function extractCompressor(data) {
    const start = findToken(data, "Dynamics").offset;
    const end = findToken(data, "EQ-5", start + 1).offset;
    const names = [
        "ATTACK",
        "RELEASE",
        "LOW_THRESHOLD",
        "LOW_RATIO",
        "LOW_KNEE",
        "HIGH_THRESHOLD",
        "HIGH_RATIO",
        "HIGH_KNEE",
        "OUTPUT_GAIN",
        "INPUT_GAIN",
    ];
    return Object.fromEntries(names.map((name) => [name, findNamedDouble(data, name, start, end)]));
}

function extractCurve(data) {
    const transferStart = findToken(data, "Transfer").offset;
    const curveStart = findToken(data, "CURVE", transferStart).endOffset;
    const curveEnd = findToken(data, "Init", curveStart).offset;
    const xPattern = Buffer.concat([u32Buffer(0x35fd), Buffer.from([DOUBLE_TYPE])]);
    const points = [];
    let cursor = curveStart;
    while (points.length < 4) {
        const xOffset = data.indexOf(xPattern, cursor);
        if (xOffset < 0 || xOffset >= curveEnd) break;
        const nextX = data.indexOf(xPattern, xOffset + 1);
        const pointEnd = nextX >= 0 && nextX < curveEnd ? nextX : curveEnd;
        points.push({
            input: findFieldDouble(data, 0x35fd, xOffset, pointEnd),
            output: findFieldDouble(data, 0x35fe, xOffset, pointEnd),
            tension: findFieldDouble(data, 0x35ff, xOffset, pointEnd),
        });
        cursor = pointEnd;
    }
    if (points.length !== 4) {
        throw new Error(`Expected four transfer points, found ${points.length}`);
    }
    const driveEnd = findToken(data, "Gain - dB", curveEnd).offset;
    return {
        points,
        drive: findNamedDouble(data, "DRIVE", curveEnd, driveEnd),
    };
}

function extractMacroMappings(data) {
    const label = findToken(data, "Fatness");
    const scopeEndBytes = Buffer.from("CONTENTS/MIX", "ascii");
    const scopeEnd = data.indexOf(scopeEndBytes, label.endOffset);
    if (scopeEnd < 0) throw new Error("Missing end of source macro mapping scope");

    const targetTokens = scanAsciiTokens(data, label.endOffset, scopeEnd).filter(({ value }) => (
        value.startsWith("CONTENTS/DEVICE_CHAIN/")
        && ["/AMPLITUDE", "/OUTPUT_GAIN", "/HIGH_RATIO"].some((suffix) => value.endsWith(suffix))
    ));
    if (targetTokens.length !== 3) {
        throw new Error(`Expected three source macro targets, found ${targetTokens.length}`);
    }

    return targetTokens.map((target, index) => {
        const end = targetTokens[index + 1]?.offset ?? scopeEnd;
        return {
            path: target.value,
            pathOffset: target.offset,
            pathRecordHex: data.subarray(target.offset, target.endOffset).toString("hex"),
            parameterMinimum: findFieldDouble(data, 0x124, target.endOffset, end),
            parameterMaximum: findFieldDouble(data, 0x125, target.endOffset, end),
            parameterBase: findFieldDouble(data, 0x37b, target.endOffset, end),
            rawControlQuantum: findFieldDouble(data, 0x7c4, target.endOffset, end),
            mappedAmount: findFieldDouble(data, 0xe32, target.endOffset, end),
        };
    });
}

function exactValue(evidence) {
    return evidence.value;
}

export function sha256(data) {
    return createHash("sha256").update(data).digest("hex");
}

export function decodeEvidenceDouble(ieee754Hex) {
    const bytes = Buffer.from(ieee754Hex, "hex");
    if (bytes.length !== 8) throw new Error("An IEEE-754 fixture must contain exactly eight bytes");
    return bytes.readDoubleBE(0);
}

export function extractPresetEvidence(input) {
    const data = Buffer.isBuffer(input) ? input : Buffer.from(input);
    if (data.subarray(0, 4).toString("ascii") !== "BtWg") {
        throw new Error("Source is not a BtWg container");
    }

    const outputToolVolume = extractToolVolume(data, "Out Gain", "PRE_FX");
    const inputToolVolume = extractToolVolume(data, "In Gain", "Dynamics");
    const compressor = extractCompressor(data);
    const curve = extractCurve(data);
    const macroMappings = extractMacroMappings(data);
    const zipOffset = data.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    const ratioSlope = exactValue(compressor.HIGH_RATIO);
    const attackLog10Seconds = exactValue(compressor.ATTACK);
    const releaseLog10Seconds = exactValue(compressor.RELEASE);

    return {
        schema: "cosimo.polishCompClip.extractedPreset.v1",
        source: {
            sha256: sha256(data),
            byteLength: data.length,
            containerHeaderAscii: data.subarray(0, 14).toString("ascii"),
            embeddedZipOffset: zipOffset,
        },
        decodedPresetFacts: {
            provenance: "decoded-polarity-bitwig-preset",
            inputToolVolume,
            compressor,
            curve,
            outputToolVolume,
            macro: {
                storedValue: findNamedDouble(
                    data,
                    "VALUE",
                    findToken(data, "Fatness").offset,
                    macroMappings[0].pathOffset,
                ),
                mappings: macroMappings,
            },
        },
        cosimoDerivedValues: {
            provenance: "cosimo-mathematical-conversion-or-inference",
            inputToolGainDb: 20 * Math.log10(exactValue(inputToolVolume)),
            outputToolGainDb: 20 * Math.log10(exactValue(outputToolVolume)),
            compressorAttackSeconds: 10 ** attackLog10Seconds,
            compressorReleaseSeconds: 10 ** releaseLog10Seconds,
            compressorRatioFromStoredSlope: 1 / (1 - ratioSlope),
        },
    };
}
