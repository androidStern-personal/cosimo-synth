import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {loadUIModule} from './helpers/load_ui_module.mjs';
const {UndoHistory}=await loadUIModule(path.resolve(import.meta.dirname,'../..'),'kit/ui/undo-history.ts');

test('standalone history bounds edits, preserves earlier snapshots, and replaces only its own redo branch',()=>{
    const initial=new UndoHistory({limit:2});
    const recorded=initial.record({before:0,after:1}).record({before:1,after:2}).record({before:2,after:3});
    assert.equal(initial.undoEntry,undefined);
    const twice=recorded.undo().undo();
    assert.equal(twice.undoEntry,undefined);
    assert.deepEqual(twice.redoEntry,{before:1,after:2});
    assert.deepEqual(twice.redo().redo().undoEntry,{before:2,after:3});
    assert.equal(twice.record({before:1,after:9}).redoEntry,undefined);
    assert.deepEqual(twice.redoEntry,{before:1,after:2},'branching cannot mutate a retained history snapshot');
    assert.equal(new UndoHistory({limit:0}).record(4).undoEntry,undefined);
    assert.throws(()=>new UndoHistory({limit:-1}),/non-negative integer/);
});
