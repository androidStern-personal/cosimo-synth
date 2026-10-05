import type { FactoryPreset } from "../../../kit/index";

/** Enhance That's factory sounds. Every preset sets all eight sound fields. */
export const factoryPresets: readonly FactoryPreset[] = [
    {
        id: "sub-weight",
        name: "Sub Weight",
        values: { frequency: 90, q: 0.71, routing: 0, amount: 0.35, sideAmount: 0, character: 0, intensity: 0, shape: 0 },
    },
    {
        id: "vocal-presence",
        name: "Vocal Presence",
        values: { frequency: 3200, q: 1.1, routing: 0, amount: 0.3, sideAmount: 0, character: 1, intensity: 0, shape: 1 },
    },
    {
        id: "air-lift",
        name: "Air Lift",
        values: { frequency: 9000, q: 0.6, routing: 0, amount: 0.4, sideAmount: 0, character: 1, intensity: 0, shape: 2 },
    },
    {
        id: "wide-shimmer",
        name: "Wide Shimmer",
        values: { frequency: 7000, q: 0.71, routing: 1, amount: 0.12, sideAmount: 0.5, character: 0, intensity: 1, shape: 2 },
    },
];
