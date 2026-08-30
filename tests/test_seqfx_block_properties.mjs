import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import fc from "fast-check";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const stateModulePromise = loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");
const arbitraryModulePromise = loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.arbitrary.ts");

function deepFreeze(value, seen = new WeakSet()) {
    if (value === null || typeof value !== "object" || seen.has(value)) {
        return value;
    }

    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
        deepFreeze(value[key], seen);
    }
    return Object.freeze(value);
}

function collectLaneBlocks(lane, selectableEffectTypes, label) {
    const blocks = [];
    let currentBlock = null;

    lane.steps.forEach((step, stepIndex) => {
        assert.equal(typeof step.active, "boolean", `${label} step ${stepIndex} active`);
        assert.equal(typeof step.trigger, "boolean", `${label} step ${stepIndex} trigger`);
        assert.equal(Array.isArray(step.params), true, `${label} step ${stepIndex} params`);
        assert.equal(step.params.length, 8, `${label} step ${stepIndex} param count`);
        assert.equal(Array.isArray(step.aux.targets), true, `${label} step ${stepIndex} aux targets`);
        assert.equal(step.aux.targets.length, 8, `${label} step ${stepIndex} aux target count`);

        if (!step.active) {
            assert.equal(step.trigger, false, `${label} inactive step ${stepIndex} trigger`);
            assert.equal(step.effectType, 0, `${label} inactive step ${stepIndex} effect`);
            if (currentBlock) {
                blocks.push(currentBlock);
                currentBlock = null;
            }
            return;
        }

        assert.equal(selectableEffectTypes.has(step.effectType), true, `${label} active step ${stepIndex} effect`);
        if (step.trigger) {
            if (currentBlock) {
                blocks.push(currentBlock);
            }
            currentBlock = { startStep: stepIndex, length: 1, effectType: step.effectType };
            return;
        }

        assert.notEqual(currentBlock, null, `${label} step ${stepIndex} needs a trigger`);
        assert.equal(step.effectType, currentBlock.effectType, `${label} step ${stepIndex} continuation effect`);
        currentBlock.length += 1;
    });

    if (currentBlock) {
        blocks.push(currentBlock);
    }

    return blocks;
}

function assertIndependentTopology(state, stateModule, { validateValues = true } = {}) {
    const selectableEffectTypes = new Set(stateModule.SEQFX_SELECTABLE_EFFECT_IDS);
    assert.equal(state.version, stateModule.SEQFX_STATE_VERSION);
    assert.equal(state.patterns.length, stateModule.SEQFX_PATTERN_COUNT);
    const oracleBlocks = state.patterns.map((pattern, patternIndex) => {
        assert.equal(Number.isInteger(pattern.revision) && pattern.revision >= 1, true, `pattern ${patternIndex} revision`);
        assert.equal(pattern.lanes.length, stateModule.SEQFX_LANE_COUNT, `pattern ${patternIndex} lanes`);
        return pattern.lanes.map((lane, laneIndex) => {
            assert.equal(lane.steps.length, stateModule.SEQFX_STEP_COUNT, `pattern ${patternIndex} lane ${laneIndex} steps`);
            return collectLaneBlocks(lane, selectableEffectTypes, `pattern ${patternIndex} lane ${laneIndex}`);
        });
    });

    if (validateValues) {
        stateModule.assertSeqFxStateValuesInRange(state);
    }
    return oracleBlocks;
}

function applyWithoutMutation(state, stateModule, operation) {
    // Test modules are ESM/strict mode, so any attempted write anywhere in the
    // recursively frozen caller graph fails the property immediately.
    deepFreeze(state);
    const nextState = operation(state);
    assertIndependentTopology(nextState, stateModule, { validateValues: false });
    return nextState;
}

function assertRejectedAtomically(state, operation, expectedError) {
    deepFreeze(state);
    assert.throws(() => operation(state), expectedError);
}

function findBlock(topology, patternIndex, lane, startStep) {
    return topology[patternIndex][lane].find((block) => block.startStep === startStep) ?? null;
}

function dispatchCommand(stateModule, state, command) {
    switch (command.tag) {
        case "create":
            return stateModule.applySeqFxBlockCreate(state, command);
        case "resize":
            return stateModule.applySeqFxBlockResize(state, command);
        case "move":
            return stateModule.applySeqFxBlockMove(state, command);
        case "copy":
            return stateModule.applySeqFxBlockCopy(state, command);
        case "delete":
            return stateModule.applySeqFxBlockDelete(state, command);
        case "mix":
            return stateModule.applySeqFxBlockMixEdit(state, command);
        case "param":
            return stateModule.applySeqFxBlockParamEdit(state, command);
        default:
            throw new Error(`Unknown SeqFX property command: ${command.tag}`);
    }
}

test("SeqFX block operations preserve values, topology, and caller immutability", async () => {
    const [stateModule, arbitraryModule] = await Promise.all([stateModulePromise, arbitraryModulePromise]);

    fc.assert(
        fc.property(arbitraryModule.seqFxBlockOperationCaseArbitrary(fc), (scenario) => {
            deepFreeze(scenario);
            let state = stateModule.createDefaultSeqFxState();
            state = applyWithoutMutation(state, stateModule, (input) => stateModule.applySeqFxBlockCreate(input, {
                patternIndex: scenario.patternIndex,
                lane: scenario.lane,
                startStep: scenario.startStep,
                length: scenario.length,
                effectType: scenario.effectType,
            }));
            state = applyWithoutMutation(state, stateModule, (input) => stateModule.applySeqFxBlockMixEdit(input, {
                patternIndex: scenario.patternIndex,
                lane: scenario.lane,
                startStep: scenario.startStep,
                value: scenario.mix,
            }));
            state = applyWithoutMutation(state, stateModule, (input) => stateModule.applySeqFxBlockParamEdit(input, {
                patternIndex: scenario.patternIndex,
                lane: scenario.lane,
                startStep: scenario.startStep,
                paramIndex: scenario.paramIndex,
                value: scenario.paramValue,
            }));
            state = applyWithoutMutation(state, stateModule, (input) => stateModule.applySeqFxBlockAuxSourceEdit(input, {
                patternIndex: scenario.patternIndex,
                lane: scenario.lane,
                startStep: scenario.startStep,
                source: scenario.auxSource,
            }));
            state = applyWithoutMutation(state, stateModule, (input) => stateModule.applySeqFxBlockResize(input, {
                patternIndex: scenario.patternIndex,
                lane: scenario.lane,
                startStep: scenario.startStep,
                length: scenario.resizedLength,
            }));

            let topology = assertIndependentTopology(state, stateModule, { validateValues: false });
            assert.deepEqual(findBlock(topology, scenario.patternIndex, scenario.lane, scenario.startStep), {
                startStep: scenario.startStep,
                length: scenario.resizedLength,
                effectType: scenario.effectType,
            });
            const sourceSteps = state.patterns[scenario.patternIndex].lanes[scenario.lane].steps
                .slice(scenario.startStep, scenario.startStep + scenario.resizedLength);

            state = applyWithoutMutation(state, stateModule, (input) => stateModule.applySeqFxBlockCopy(input, {
                patternIndex: scenario.patternIndex,
                lane: scenario.lane,
                startStep: scenario.startStep,
                targetLane: scenario.targetLane,
                targetStartStep: scenario.targetStartStep,
            }));
            assert.deepEqual(
                state.patterns[scenario.patternIndex].lanes[scenario.targetLane].steps
                    .slice(scenario.targetStartStep, scenario.targetStartStep + scenario.resizedLength),
                sourceSteps,
            );

            state = applyWithoutMutation(state, stateModule, (input) => stateModule.applySeqFxBlockMove(input, {
                patternIndex: scenario.patternIndex,
                lane: scenario.lane,
                startStep: scenario.startStep,
                targetLane: scenario.moveLane,
                targetStartStep: scenario.moveStartStep,
            }));
            topology = assertIndependentTopology(state, stateModule, { validateValues: false });
            assert.equal(findBlock(topology, scenario.patternIndex, scenario.lane, scenario.startStep), null);
            assert.deepEqual(findBlock(topology, scenario.patternIndex, scenario.moveLane, scenario.moveStartStep), {
                startStep: scenario.moveStartStep,
                length: scenario.resizedLength,
                effectType: scenario.effectType,
            });

            state = applyWithoutMutation(state, stateModule, (input) => stateModule.applySeqFxBlockDelete(input, {
                patternIndex: scenario.patternIndex,
                lane: scenario.moveLane,
                startStep: scenario.moveStartStep,
            }));
            topology = assertIndependentTopology(state, stateModule);
            assert.equal(findBlock(topology, scenario.patternIndex, scenario.moveLane, scenario.moveStartStep), null);
            assert.notEqual(findBlock(topology, scenario.patternIndex, scenario.targetLane, scenario.targetStartStep), null);
        }),
        { seed: 0x53e9f703, numRuns: 500 },
    );
});

test("SeqFX rejects overlapping and out-of-range block edits atomically", async () => {
    const [stateModule, arbitraryModule] = await Promise.all([stateModulePromise, arbitraryModulePromise]);

    fc.assert(
        fc.property(arbitraryModule.seqFxBlockOperationCaseArbitrary(fc), (scenario) => {
            deepFreeze(scenario);
            let state = stateModule.createDefaultSeqFxState();
            state = stateModule.applySeqFxBlockCreate(state, {
                patternIndex: scenario.patternIndex,
                lane: scenario.lane,
                startStep: scenario.startStep,
                length: scenario.length,
                effectType: scenario.effectType,
            });
            state = stateModule.applySeqFxBlockCreate(state, {
                patternIndex: scenario.patternIndex,
                lane: scenario.lane,
                startStep: scenario.sameLaneBlockerStart,
                length: 1,
                effectType: scenario.effectType,
            });
            state = stateModule.applySeqFxBlockCreate(state, {
                patternIndex: scenario.patternIndex,
                lane: scenario.targetLane,
                startStep: scenario.targetStartStep,
                length: 1,
                effectType: scenario.effectType,
            });
            assertIndependentTopology(state, stateModule);

            assertRejectedAtomically(state, (input) => stateModule.applySeqFxBlockCreate(input, {
                patternIndex: scenario.patternIndex,
                lane: scenario.lane,
                startStep: scenario.startStep,
                length: 1,
                effectType: scenario.effectType,
            }), /cannot overlap/);
            assertRejectedAtomically(state, (input) => stateModule.applySeqFxBlockResize(input, {
                patternIndex: scenario.patternIndex,
                lane: scenario.lane,
                startStep: scenario.startStep,
                length: scenario.collisionResizeLength,
            }), /cannot overlap/);
            assertRejectedAtomically(state, (input) => stateModule.applySeqFxBlockCopy(input, {
                patternIndex: scenario.patternIndex,
                lane: scenario.lane,
                startStep: scenario.startStep,
                targetLane: scenario.targetLane,
                targetStartStep: scenario.targetStartStep,
            }), /cannot overlap/);
            assertRejectedAtomically(state, (input) => stateModule.applySeqFxBlockMove(input, {
                patternIndex: scenario.patternIndex,
                lane: scenario.lane,
                startStep: scenario.startStep,
                targetLane: scenario.targetLane,
                targetStartStep: scenario.targetStartStep,
            }), /cannot overlap/);
            assertRejectedAtomically(state, (input) => stateModule.applySeqFxBlockCreate(input, {
                patternIndex: -1,
                lane: scenario.lane,
                startStep: scenario.startStep,
                length: 1,
                effectType: scenario.effectType,
            }), /outside the valid range/);
        }),
        { seed: 0x53e9f704, numRuns: 500 },
    );
});

test("SeqFX randomized command sequences never produce invalid block layouts", async () => {
    const [stateModule, arbitraryModule] = await Promise.all([stateModulePromise, arbitraryModulePromise]);

    fc.assert(
        fc.property(
            fc.array(arbitraryModule.seqFxEditCommandArbitrary(fc), { maxLength: 20 }),
            (commands) => {
                deepFreeze(commands);
                let state = stateModule.createDefaultSeqFxState();
                assertIndependentTopology(state, stateModule, { validateValues: false });

                for (const command of commands) {
                    deepFreeze(state);
                    let nextState;
                    try {
                        nextState = dispatchCommand(stateModule, state, command);
                    } catch (error) {
                        assert.notEqual(error, null);
                        assert.notEqual(error?.name, "TypeError", "command attempted to mutate its frozen input");
                        continue;
                    }

                    assertIndependentTopology(nextState, stateModule, { validateValues: false });
                    state = nextState;
                }

                assertIndependentTopology(state, stateModule);
            },
        ),
        { seed: 0x53e9f705, numRuns: 250 },
    );
});
