import fs from "node:fs";

const fixtureUrl = new URL("../fixtures/decoded-settings.json", import.meta.url);

export const decodedSettings = Object.freeze(JSON.parse(fs.readFileSync(fixtureUrl, "utf8")));

export function mappingBySuffix(suffix) {
    const mapping = decodedSettings.decodedPresetFacts.macro.mappings.find(({ path }) => path.endsWith(suffix));
    if (!mapping) throw new Error(`Missing retained source macro mapping ${suffix}`);
    return mapping;
}
