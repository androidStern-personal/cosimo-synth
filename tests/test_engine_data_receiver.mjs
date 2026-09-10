import test from "node:test";
import assert from "node:assert/strict";
import { runEngineData } from "./test_engine_data_support.mjs";

test("compiled Cmajor keeps held A readable while incomplete B stays invisible and complete B is committed", { timeout: 90_000 }, () => {
    const wordCount = 257;
    const wordsA = Array.from({ length: wordCount }, (_, index) => -700001 + index * 997);
    const wordsB = Array.from({ length: wordCount }, (_, index) => 300007 - index * 613);
    const commands = [{ frames: 64 }];
    const receipts = [];
    const scans = [];
    const send = (endpoint, value, frames = 64) => {
        const index = commands.length;
        commands.push({ frames, events: [{ endpoint, value }] });
        if (["begin", "chunk", "commit"].includes(endpoint)) receipts.push({ index, endpoint, value });
        return index;
    };
    const chunk = (generation, words, offset, count) => send("chunk", {
        scope: 1, generation, offset, count,
        words: Array.from({ length: 32 }, (_, index) => index < count ? words[offset + index] : 0),
    });
    const scan = (name, current, held) => {
        const indices = [];
        for (let index = 0; index < wordCount; index++) {
            indices.push(commands.length);
            commands.push({ frames: 2, values: { readIndex: index } });
        }
        scans.push({ name, indices, current, held });
    };

    send("begin", { scope: 1, generation: 1, wordCount });
    for (let offset = 0; offset < wordCount; offset += 32)
        chunk(1, wordsA, offset, Math.min(32, wordCount - offset));
    const committedA = send("commit", { scope: 1, generation: 1 });
    send("holdReader", 0, 1);
    scan("A is both current and held", wordsA, wordsA);

    send("begin", { scope: 1, generation: 2, wordCount });
    for (let offset = 0; offset < 128; offset += 32) chunk(2, wordsB, offset, 32);
    scan("partial B cannot modify current or held A", wordsA, wordsA);
    for (let offset = 128; offset < wordCount; offset += 32)
        chunk(2, wordsB, offset, Math.min(32, wordCount - offset));
    scan("fully staged B remains invisible before commit", wordsA, wordsA);
    const committedB = send("commit", { scope: 1, generation: 2 });
    scan("committed B is current while the held reader retains A", wordsB, wordsA);

    const results = runEngineData(commands);
    assert.equal(results.length, commands.length, "the compiled performer returns one actual block per command");
    for (const { name, indices, current, held } of scans) {
        for (let index = 0; index < wordCount; index++) {
            const block = results[indices[index]];
            assert.equal(block.samples.length, 2);
            for (const sample of block.samples) {
                assert.deepEqual(sample, [current[index], held[index], 0], `${name}, word ${index}`);
            }
            assert.deepEqual(block.receipts, [], "read-only DSP frames cannot invent transfer receipts");
        }
    }
    // These receipts come from the compiled Cmajor receiver. They supplement,
    // rather than replace, the complete current/held DSP word checks above.
    const operation = { begin: 1, chunk: 2, commit: 3 };
    for (const { index, endpoint, value } of receipts) {
        assert.equal(results[index].receipts.length, 1);
        const receipt = results[index].receipts[0];
        assert.equal(receipt.operation, operation[endpoint]);
        assert.equal(receipt.scope, 1);
        assert.equal(receipt.generation, value.generation);
        assert.equal(receipt.status, 0, `${endpoint} for generation ${value.generation} must be accepted`);
    }
    assert.equal(results[committedA].receipts[0].currentGeneration, 1);
    assert.equal(results[committedB].receipts[0].currentGeneration, 2);
});

test("compiled Cmajor refuses a fourth generation while three slots are live and reuses only released capacity", { timeout: 90_000 }, () => {
    const wordCount = 257;
    const a = Array.from({ length: wordCount }, (_, index) => -900001 + index * 541);
    const b = Array.from({ length: wordCount }, (_, index) => 800009 - index * 827);
    const c = Array.from({ length: wordCount }, (_, index) => -300007 + index * 191);
    const d = Array.from({ length: wordCount }, (_, index) => 400003 + index * 313);
    const commands = [{ frames: 64 }];
    const accepted = [], scans = [];
    const send = (endpoint, value) => {
        const index = commands.length;
        commands.push({ frames: 64, events: [{ endpoint, value }] });
        return index;
    };
    const upload = (generation, words) => {
        accepted.push(send("begin", { scope: 1, generation, wordCount }));
        for (let offset = 0; offset < wordCount; offset += 32) {
            const count = Math.min(32, wordCount - offset);
            accepted.push(send("chunk", { scope: 1, generation, offset, count,
                words: Array.from({ length: 32 }, (_, index) => index < count ? words[offset + index] : 0) }));
        }
        accepted.push(send("commit", { scope: 1, generation }));
    };
    const scan = (name, current, held0, held1) => {
        for (let index = 0; index < wordCount; index++) {
            scans.push({ response: commands.length, name, index, expected: [current[index], held0?.[index] ?? 0, held1[index]] });
            commands.push({ frames: 2, values: { readIndex: index } });
        }
    };
    upload(1, a);
    send("holdReader", 0);
    upload(2, b);
    send("holdReader", 1);
    upload(3, c);
    scan("current C and held A/B fill every slot", c, a, b);
    const refused = send("begin", { scope: 1, generation: 4, wordCount });
    scan("capacity refusal preserves every current and held word", c, a, b);
    send("releaseReader", 0);
    upload(4, d);
    scan("D reuses released A capacity without overwriting held B", d, undefined, b);

    const results = runEngineData(commands);
    assert.equal(results.length, commands.length);
    assert.equal(results[refused].receipts.length, 1);
    assert.equal(results[refused].receipts[0].operation, 1);
    assert.equal(results[refused].receipts[0].generation, 4);
    assert.equal(results[refused].receipts[0].status, 3, "full capacity must refuse Begin D as busy");
    assert.equal(results[refused].receipts[0].currentGeneration, 3);
    for (const { response, name, index, expected } of scans) {
        assert.equal(results[response].samples.length, 2);
        for (const sample of results[response].samples) assert.deepEqual(sample, expected, `${name}, word ${index}`);
        assert.deepEqual(results[response].receipts, []);
    }
    for (const index of accepted) {
        assert.equal(results[index].receipts.length, 1);
        assert.equal(results[index].receipts[0].status, 0, "release permits the same refused generation to finish through the real receiver");
    }
});

test("compiled Cmajor reports its frontier and resets staging without invalidating held readers", { timeout: 90_000 }, () => {
    const wordCount = 257;
    const a = Array.from({ length: wordCount }, (_, index) => -500009 + index * 431);
    const b = Array.from({ length: wordCount }, (_, index) => 600011 - index * 719);
    const commands = [{ frames: 64 }];
    const accepted = [], queries = [], scans = [];
    const send = (endpoint, value) => {
        const index = commands.length;
        commands.push({ frames: 64, events: [{ endpoint, value }] });
        return index;
    };
    const query = (request, scope, generation, receivedWords, currentScope, currentGeneration) => {
        queries.push({ index: send("query", { request }), expected: {
            operation: 5, scope, generation, status: 0, receivedWords, currentScope, currentGeneration, request,
        } });
    };
    const chunk = (scope, generation, words, offset, count) => send("chunk", {
        scope, generation, offset, count,
        words: Array.from({ length: 32 }, (_, index) => index < count ? words[offset + index] : 0),
    });
    const scan = (name, current) => {
        for (let index = 0; index < wordCount; index++) {
            scans.push({ response: commands.length, name, index, expected: [current[index], a[index], 0] });
            commands.push({ frames: 2, values: { readIndex: index } });
        }
    };

    query(101, 0, 0, 0, 0, 0);
    accepted.push(send("begin", { scope: 1, generation: 1, wordCount }));
    for (let offset = 0; offset < wordCount; offset += 32)
        accepted.push(chunk(1, 1, a, offset, Math.min(32, wordCount - offset)));
    accepted.push(send("commit", { scope: 1, generation: 1 }));
    send("holdReader", 0);
    accepted.push(send("begin", { scope: 1, generation: 2, wordCount }));
    accepted.push(chunk(1, 2, b, 0, 32));
    accepted.push(chunk(1, 2, b, 32, 32));
    query(102, 1, 2, 64, 1, 1);

    accepted.push(send("resetScope", { scope: 2 }));
    query(103, 2, 0, 0, 1, 1);
    const staleChunk = chunk(1, 2, b, 64, 32);
    const staleCommit = send("commit", { scope: 1, generation: 2 });
    query(104, 2, 0, 0, 1, 1);
    scan("reset and old-scope traffic retain current and held A", a);

    accepted.push(send("begin", { scope: 2, generation: 1, wordCount }));
    accepted.push(chunk(2, 1, b, 0, 32));
    accepted.push(send("resetScope", { scope: 2 }));
    query(105, 2, 1, 32, 1, 1);
    for (let offset = 32; offset < wordCount; offset += 32)
        accepted.push(chunk(2, 1, b, offset, Math.min(32, wordCount - offset)));
    query(106, 2, 1, 257, 1, 1);
    scan("duplicate reset preserves staging but cannot publish B", a);
    accepted.push(send("commit", { scope: 2, generation: 1 }));
    query(107, 2, 1, 257, 2, 1);
    scan("fresh scope commits B while held A survives", b);

    const results = runEngineData(commands);
    assert.equal(results.length, commands.length);
    for (const { index, expected } of queries)
        assert.deepEqual(results[index].receipts, [expected], `query ${expected.request} reports the actual receiver frontier`);
    for (const index of accepted) {
        assert.equal(results[index].receipts.length, 1);
        assert.equal(results[index].receipts[0].status, 0);
        assert.equal(results[index].receipts[0].request, 0, "ordinary commands cannot masquerade as correlated queries");
    }
    for (const index of [staleChunk, staleCommit]) {
        assert.equal(results[index].receipts.length, 1);
        assert.equal(results[index].receipts[0].status, 1, "old-scope traffic is refused after reset");
    }
    for (const { response, name, index, expected } of scans) {
        assert.equal(results[response].samples.length, 2);
        for (const sample of results[response].samples) assert.deepEqual(sample, expected, `${name}, word ${index}`);
        assert.deepEqual(results[response].receipts, []);
    }
});

test("compiled Cmajor refuses malformed and conflicting packets without corrupting the staged value", { timeout: 90_000 }, () => {
    const wordCount = 257;
    const a = Array.from({ length: wordCount }, (_, index) => -200003 + index * 337);
    const b = Array.from({ length: wordCount }, (_, index) => 700001 - index * 521);
    const commands = [{ frames: 64 }];
    const accepted = [], rejected = [], scans = [];
    const send = (endpoint, value) => {
        const index = commands.length;
        commands.push({ frames: 64, events: [{ endpoint, value }] });
        return index;
    };
    const packet = (generation, words, offset, count) => ({ scope: 1, generation, offset, count,
        words: Array.from({ length: 32 }, (_, index) => index < count ? (words[offset + index] ?? 999983) : 0),
    });
    const scan = (name, current) => {
        for (let index = 0; index < wordCount; index++) {
            scans.push({ response: commands.length, name, index, expected: [current[index], a[index], 0] });
            commands.push({ frames: 2, values: { readIndex: index } });
        }
    };
    accepted.push(send("begin", { scope: 1, generation: 1, wordCount }));
    for (let offset = 0; offset < wordCount; offset += 32)
        accepted.push(send("chunk", packet(1, a, offset, Math.min(32, wordCount - offset))));
    accepted.push(send("commit", { scope: 1, generation: 1 }));
    send("holdReader", 0);
    accepted.push(send("begin", { scope: 1, generation: 2, wordCount }));
    accepted.push(send("chunk", packet(2, b, 0, 32)));
    const refuse = (name, endpoint, value) => {
        rejected.push({ name, response: send(endpoint, value), query: send("query", { request: 201 + rejected.length }) });
    };
    refuse("conflicting duplicate", "chunk", { ...packet(2, b, 0, 32), words: Array(32).fill(-999983) });
    refuse("skipped offset", "chunk", packet(2, b, 64, 32));
    refuse("count exceeds packet capacity", "chunk", packet(2, b, 32, 33));
    refuse("negative offset", "chunk", packet(2, b, -1, 32));
    refuse("incomplete commit", "commit", { scope: 1, generation: 2 });
    scan("rejected traffic never publishes or modifies current and held A", a);
    for (let offset = 32; offset < wordCount; offset += 32)
        accepted.push(send("chunk", packet(2, b, offset, Math.min(32, wordCount - offset))));
    accepted.push(send("commit", { scope: 1, generation: 2 }));
    scan("valid continuation commits every original B word and retains held A", b);

    const results = runEngineData(commands);
    assert.equal(results.length, commands.length);
    for (const { name, response, query } of rejected) {
        assert.equal(results[response].receipts.length, 1);
        assert.notEqual(results[response].receipts[0].status, 0, `${name} must not be accepted`);
        assert.equal(results[query].receipts.length, 1);
        const frontier = results[query].receipts[0];
        assert.equal(frontier.operation, 5);
        assert.equal(frontier.status, 0);
        assert.equal(frontier.request, commands[query].events[0].value.request);
        assert.equal(frontier.scope, 1);
        assert.equal(frontier.generation, 2);
        assert.equal(frontier.receivedWords, 32, `${name} must preserve the accepted prefix`);
        assert.equal(frontier.currentScope, 1);
        assert.equal(frontier.currentGeneration, 1);
    }
    for (const index of accepted) {
        assert.equal(results[index].receipts.length, 1);
        assert.equal(results[index].receipts[0].status, 0, "refusals must permit a valid continuation without a new Begin");
    }
    for (const { response, name, index, expected } of scans) {
        assert.equal(results[response].samples.length, 2);
        for (const sample of results[response].samples) assert.deepEqual(sample, expected, `${name}, word ${index}`);
        assert.deepEqual(results[response].receipts, []);
    }
});

test("compiled Cmajor shares one copy allowance across banks and control messages cannot refill it", { timeout: 90_000 }, () => {
    const a = Array.from({ length: 32 }, (_, index) => -88003 + index * 271);
    const b = Array.from({ length: 32 }, (_, index) => 99007 - index * 419);
    const commands = [{ frames: 64 }];
    const accepted = [], scans = [];
    const send = (endpoint, value) => {
        const index = commands.length;
        commands.push({ frames: 1, events: [{ endpoint, value }] });
        return index;
    };
    const scan = (name, bank, expected) => {
        for (let index = 0; index < 32; index++) {
            scans.push({ response: commands.length, name, index, expected: [expected[index], 0, 0] });
            commands.push({ frames: 1, values: { readBank: bank, readIndex: index } });
        }
    };
    accepted.push(send("begin", { scope: 1, generation: 1, wordCount: 32 }));
    accepted.push(send("chunk", { scope: 1, generation: 1, offset: 0, count: 32, words: a }));
    accepted.push(send("commit", { scope: 1, generation: 1 }));
    accepted.push(send("peerBegin", { scope: 1, generation: 1, wordCount: 32 }));
    const immediatelyRefused = send("peerChunk", { scope: 1, generation: 1, offset: 0, count: 32, words: b });
    accepted.push(send("query", { request: 301 }));
    accepted.push(send("begin", { scope: 1, generation: 2, wordCount: 32 }));
    accepted.push(send("resetScope", { scope: 2 }));
    accepted.push(send("peerReset", { scope: 2 }));
    accepted.push(send("peerBegin", { scope: 2, generation: 1, wordCount: 32 }));
    accepted.push(send("peerQuery", { request: 302 }));
    const refusedAfterControls = send("peerChunk", { scope: 2, generation: 1, offset: 0, count: 32, words: b });
    // Every command above advances only one real DSP frame. Thus both attempted
    // peer copies occur within the same 64-frame allowance period as A's copy.
    scan("control traffic preserves the first bank's actual words", 0, a);
    scan("a refused peer transfer is never visible", 1, Array(32).fill(0));
    commands.push({ frames: 64 });
    accepted.push(send("peerChunk", { scope: 2, generation: 1, offset: 0, count: 32, words: b }));
    accepted.push(send("peerCommit", { scope: 2, generation: 1 }));
    scan("elapsed DSP frames permit the exact refused peer packet", 1, b);
    scan("the second bank's install leaves the first bank intact", 0, a);

    const results = runEngineData(commands);
    assert.equal(results.length, commands.length);
    for (const index of [immediatelyRefused, refusedAfterControls]) {
        assert.equal(results[index].receipts.length, 1);
        const receipt = results[index].receipts[0];
        assert.equal(receipt.operation, 2);
        assert.equal(receipt.status, 5, "both banks consume the same copy budget; control messages cannot replenish it");
        assert.equal(receipt.receivedWords, 0, "a refused copy cannot advance the peer's frontier");
        assert.equal(receipt.currentScope, 0);
        assert.equal(receipt.currentGeneration, 0);
    }
    for (const index of accepted) {
        assert.equal(results[index].receipts.length, 1);
        assert.equal(results[index].receipts[0].status, 0);
    }
    for (const { response, name, index, expected } of scans) {
        assert.deepEqual(results[response].samples, [expected], `${name}, word ${index}`);
        assert.deepEqual(results[response].receipts, []);
    }
});

test("compiled Cmajor retains each reader's value length and safely releases or rejects invalid reader access", { timeout: 90_000 }, () => {
    const a = Array.from({ length: 257 }, (_, index) => -410003 + index * 263);
    const b = Array.from({ length: 17 }, (_, index) => 520009 - index * 389);
    const c = Array.from({ length: 257 }, (_, index) => -630017 + index * 457);
    const commands = [{ frames: 64 }];
    const accepted = [], scans = [];
    const send = (endpoint, value) => {
        const index = commands.length;
        commands.push({ frames: 64, events: [{ endpoint, value }] });
        return index;
    };
    const read = (name, index, expected) => {
        scans.push({ response: commands.length, name, index, expected });
        commands.push({ frames: 2, values: { readIndex: index } });
    };
    const scan = (name, current, held0, held1) => {
        for (let index = 0; index < 257; index++)
            read(name, index, [current[index] ?? 0, held0[index] ?? 0, held1[index] ?? 0]);
    };
    const upload = (generation, words) => {
        accepted.push(send("begin", { scope: 1, generation, wordCount: words.length }));
        for (let offset = 0; offset < words.length; offset += 32) {
            const count = Math.min(32, words.length - offset);
            accepted.push(send("chunk", { scope: 1, generation, offset, count,
                words: Array.from({ length: 32 }, (_, index) => index < count ? words[offset + index] : 0),
            }));
        }
        accepted.push(send("commit", { scope: 1, generation }));
    };

    send("holdReader", 0);
    read("holding before any value exists stays neutral", 0, [0, 0, 0]);
    upload(1, a);
    send("holdReader", 0);
    send("holdReader", 1);
    upload(2, b);
    for (const id of [-1, 2]) { send("holdReader", id); send("releaseReader", id); }
    scan("short current B cannot expose tails or change either held A reader", b, a, a);
    send("releaseReader", 0);
    send("releaseReader", 0);
    scan("repeated release remains neutral and does not release the other reader", b, [], a);
    send("holdReader", 0);
    upload(3, c);
    scan("a reused reader retains short B while current C and held A have their own lengths", c, b, a);
    for (const index of [-1, 257, 2147483647])
        read("invalid word indices never wrap into current or held storage", index, [0, 0, 0]);
    read("invalid reads do not alter the valid reader handles", 16, [c[16], b[16], a[16]]);

    const results = runEngineData(commands);
    assert.equal(results.length, commands.length);
    for (const index of accepted) {
        assert.equal(results[index].receipts.length, 1);
        assert.equal(results[index].receipts[0].status, 0);
    }
    for (const { response, name, index, expected } of scans) {
        assert.equal(results[response].samples.length, 2);
        for (const sample of results[response].samples) assert.deepEqual(sample, expected, `${name}, word ${index}`);
        assert.deepEqual(results[response].receipts, []);
    }
});
