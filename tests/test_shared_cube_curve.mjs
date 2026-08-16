import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const cubePromise = loadUIModule(repoRoot, "ui/shared/cube-curve.ts");

test("cube chain resamples a polyline at even arc spacing", async () => {
    const cube = await cubePromise;
    const line = Array.from({ length: 21 }, (_, i) => ({ x: i * 5, y: 0 }));
    const chain = cube.buildCubeChain(line, 10);
    assert.equal(chain.length, 11, "100px line at 10px spacing yields 11 cubes");
    for (let index = 0; index < chain.length; index += 1) {
        assert.equal(Math.abs(chain[index].x - index * 10) < 1e-9, true, `cube ${index} sits on its arc mark`);
        assert.equal(chain[index].y, 0);
    }
});

test("cube chain follows bends and keeps spacing along the arc", async () => {
    const cube = await cubePromise;
    const corner = [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 40 },
    ];
    const chain = cube.buildCubeChain(corner, 10);
    assert.equal(chain.length, 8, "70px arc at 10px spacing yields 8 cubes");
    for (let index = 1; index < chain.length; index += 1) {
        const dx = chain[index].x - chain[index - 1].x;
        const dy = chain[index].y - chain[index - 1].y;
        const gap = Math.hypot(dx, dy);
        assert.equal(gap <= 10 + 1e-9, true, `gap ${index} never exceeds the spacing`);
    }
    for (const point of chain) {
        const onHorizontal = point.y === 0 && point.x >= 0 && point.x <= 30;
        const onVertical = point.x === 30 && point.y >= 0 && point.y <= 40;
        assert.equal(onHorizontal || onVertical, true, "every cube lies on the polyline");
    }
});

test("degenerate inputs yield a bare anchor or nothing", async () => {
    const cube = await cubePromise;
    assert.deepEqual(cube.buildCubeChain([], 10), []);
    const single = cube.buildCubeChain([{ x: 4, y: 7 }], 10);
    assert.deepEqual(single, [{ x: 4, y: 7 }]);
    const short = cube.buildCubeChain([{ x: 0, y: 0 }, { x: 3, y: 0 }], 10);
    assert.deepEqual(short, [{ x: 0, y: 0 }], "segment shorter than spacing keeps only the anchor");
});
