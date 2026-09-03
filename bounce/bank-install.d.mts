import type { BounceBank } from "./bank-format.mjs";

/** One Cmajor event in the acknowledged Bounce bank upload protocol. */
export type BounceBankInstallMessage = {
    readonly endpointID: "bounceBankLoadBegin" | "bounceBankFrameBatch" | "bounceBankCommit";
    readonly deliverySerial: number;
    readonly value: Readonly<Record<string, unknown>>;
};

/** Number of stereo frames sent in one bank upload event. */
export const BOUNCE_BANK_BATCH_FRAMES: 6_000;

/** Parse unknown input into the installable in-memory bank contract. */
export function validateInstallableBounceBank(bank: unknown): BounceBank;

/** Yield the exact acknowledged Cmajor upload protocol for one bank. */
export function bounceBankInstallMessages(
    bank: unknown,
    options: {
        readonly dspSessionId: number;
        readonly generation: number;
        readonly firstDeliverySerial?: number;
    },
): Generator<BounceBankInstallMessage, void, unknown>;

/** Install a bank into a generated offline performer. */
export function installBounceBankInOfflinePerformer(
    performer: Readonly<Record<string, unknown>> & { advance(frameCount: number): void },
    bank: unknown,
    options: {
        readonly dspSessionId: number;
        readonly generation: number;
        readonly firstDeliverySerial?: number;
    },
): number;
