import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {loadUIModule} from './helpers/load_ui_module.mjs';

const root=path.resolve(import.meta.dirname,'../..');
const {definePluginState,storedValue,parameter}=await loadUIModule(root,'kit/ui/plugin-state-definition.ts');
const {createPluginStateSession}=await loadUIModule(root,'kit/ui/plugin-state-session.ts');
const {parseServiceMessage,parseClientMessage,encodeStateSnapshot}=await loadUIModule(root,'kit/ui/plugin-state-protocol.ts');
const codec={parse:value=>typeof value==='number'&&Number.isFinite(value)?{kind:'ok',value}:{kind:'error',message:'Expected number'},encode:value=>value,equals:Object.is};
const field=options=>storedValue({initial:0,codec,...options});

async function open(definition,{historyLimit,bindings=[]}={}) {
    const publications=[],defects=[];
    let scope={owner:'policy-owner',document:0},sequence=0;
    const owner=createPluginStateSession(definition,{historyLimit,bindings,native:{publish:value=>publications.push(value),update(){},close(){}},onDefect:error=>defects.push(error)});
    await owner.dispatch({kind:'opened',scope,native:{parameters:[],values:{}}});
    return {owner,publications,defects,command:command=>{
        const parsed=parseServiceMessage({kind:'command',address:{...scope,client:1,sequence:++sequence},command});
        assert.equal(parsed.kind,'ok');assert.equal(parsed.value.kind,'command');
        return owner.dispatch(parsed.value);
    },
        async replace(values={}) {scope={...scope,document:scope.document+1};await owner.dispatch({kind:'replaced',scope,native:{parameters:[],values}});},
        async receipt(publication,result) {await owner.dispatch({kind:'published',scope:publication.scope,request:publication.request,result});},
        async close(){await owner.stop();assert.deepEqual(defects,[]);}};
}

test('instance fields survive replacement without native serialization and excluded edits preserve unrelated Undo/Redo',async()=>{
    const definition=definePluginState({project:field(),session:field({lifetime:'instance',history:false})});
    const f=await open(definition);
    try {
        await f.command({kind:'edit',key:'project',value:1});
        await f.command({kind:'undo'});
        const history=f.owner.getSnapshot().history;
        await f.command({kind:'begin',key:'session',gesture:1});
        const edited=await f.command({kind:'edit',key:'session',value:7,gesture:1});
        assert.equal(edited.historyEntry,undefined);
        assert.deepEqual(f.owner.getSnapshot().history,history,'an excluded active gesture must not block unrelated Redo');
        await f.command({kind:'redo'});
        await f.command({kind:'end',key:'session',gesture:1});
        assert.equal(f.owner.getSnapshot().fields.project.value,1);
        assert.equal(f.publications.some(p=>p.operations.some(op=>op.key==='session')),false);
        await f.replace({project:4,session:99});
        assert.equal(f.owner.getSnapshot().fields.session.value,7,'project input cannot overwrite instance state');
        assert.equal(f.owner.getSnapshot().fields.project.value,4);
        assert.equal(f.owner.getSnapshot().history.canUndo,false);
        const other=await open(definition);
        assert.equal(other.owner.getSnapshot().fields.session.value,0,'new instance starts from authored default');
        await other.close();
    } finally {await f.close();}
});

test('configured history bounds apply to completed edits and interleaved gestures',async()=>{
    const f=await open(definePluginState({a:field(),b:field()}),{historyLimit:2});
    try {
        for(const value of [1,2,3])await f.command({kind:'edit',key:'a',value});
        await f.command({kind:'undo'});await f.command({kind:'undo'});await f.command({kind:'undo'});
        assert.equal(f.owner.getSnapshot().fields.a.value,1);
        assert.equal(f.owner.getSnapshot().history.canUndo,false);
        await f.command({kind:'begin',key:'a',gesture:1});await f.command({kind:'begin',key:'b',gesture:2});
        await f.command({kind:'edit',key:'a',value:5,gesture:1});await f.command({kind:'edit',key:'b',value:6,gesture:2});
        await f.command({kind:'end',key:'b',gesture:2});await f.command({kind:'end',key:'a',gesture:1});
        await f.command({kind:'undo'});
        assert.equal(f.owner.getSnapshot().fields.b.value,0,'latest edit wins over gesture release order');
        await f.command({kind:'undo'});assert.equal(f.owner.getSnapshot().fields.a.value,1);
    } finally {await f.close();}
});

test('a failed save retry preserves value version/history and cannot retry again after success or replacement',async()=>{
    const f=await open(definePluginState({a:field()}));
    try {
        await f.command({kind:'edit',key:'a',value:3});
        await f.receipt(f.publications.at(-1),{kind:'failed',reason:'disk unavailable'});
        const before=f.owner.getSnapshot(),guard={kind:'retry',key:'a',expectedVersion:before.fields.a.version,expectedGeneration:null,expectedPersistenceRequest:before.fields.a.persistenceRequest};
        const parsed=parseClientMessage(definePluginState({a:field()}),{kind:'update',scope:before.scope,revision:before.revision,state:encodeStateSnapshot(definePluginState({a:field()}),before)});
        assert.equal(parsed.kind,'ok');assert.equal(parsed.value.state.fields.a.persistenceRequest,guard.expectedPersistenceRequest,'save retry survives actual snapshot serialization/parsing');
        assert.equal((await f.command(guard)).kind,'accepted');
        const retried=f.publications.at(-1);
        assert.deepEqual(retried.operations,[{kind:'stored',key:'a',value:3}]);
        assert.equal(f.owner.getSnapshot().fields.a.version,before.fields.a.version);
        assert.deepEqual(f.owner.getSnapshot().history,before.history);
        await f.receipt(retried,{kind:'failed',reason:'disk unavailable'});
        const failedAgain=f.owner.getSnapshot().fields.a;
        assert.equal((await f.command(guard)).kind,'rejected','old retry cannot act on a newer same-value failure');
        const nextGuard={...guard,expectedPersistenceRequest:failedAgain.persistenceRequest};
        await f.command({kind:'begin',key:'a',gesture:1});await f.command({kind:'end',key:'a',gesture:1});
        assert.equal((await f.command(nextGuard)).kind,'accepted','empty gesture retains current save failure');
        await f.receipt(f.publications.at(-1),{kind:'observed'});
        const count=f.publications.length;
        assert.equal((await f.command(guard)).kind,'rejected');assert.equal(f.publications.length,count);
        await f.replace({a:9});assert.equal((await f.command(guard)).kind,'rejected');assert.equal(f.publications.length,count);
    } finally {await f.close();}
});

test('a preparation defect cannot be retried through the command channel and leaves other fields usable',async()=>{
    const replacements=[];
    const f=await open(definePluginState({broken:field(),other:field()}),{bindings:[{
        key:'broken',dependencies:[],replace(input,target){replacements.push({input,target});},cancel(){},stop(){},
    }]});
    try {
        const target=replacements.at(-1).target;
        await f.owner.dispatch({kind:'engine',target,status:{kind:'failed',error:{kind:'defect',message:'Decoder malfunctioned'}}});
        const before=f.owner.getSnapshot(),count=replacements.length;
        const retry=await f.command({kind:'retry',key:'broken',expectedVersion:before.fields.broken.version,
            expectedGeneration:target.generation,expectedPersistenceRequest:null});
        assert.deepEqual(retry,{kind:'rejected',reason:'not-ready'});
        assert.equal(replacements.length,count,'retry must not invoke the faulty preparation again');
        assert.deepEqual(f.owner.getSnapshot(),before,'rejected retry changes neither accepted values nor history');
        assert.equal((await f.command({kind:'edit',key:'other',value:7})).kind,'accepted');
        assert.equal(f.owner.getSnapshot().fields.other.value,7);
        assert.equal((await f.command({kind:'undo'})).kind,'accepted');
        assert.equal(f.owner.getSnapshot().fields.other.value,0);
    } finally {await f.close();}
});

test('own queued gesture versions remain valid until actual host automation advances their floor',async()=>{
    const definition=definePluginState({gain:parameter('gain')});
    const publications=[],scope={owner:'automation-guard',document:0};
    const owner=createPluginStateSession(definition,{native:{publish:p=>publications.push(p),update(){},close(){}},onDefect:error=>assert.fail(String(error))});
    let sequence=0;
    const intent=()=>publications.filter(publication=>publication.operations.some(operation=>operation.kind==='parameter')).at(-1).request;
    const command=command=>owner.dispatch({kind:'command',address:{...scope,client:1,sequence:++sequence},command});
    try {
        await owner.dispatch({kind:'opened',scope,native:{values:{},parameters:[{endpoint:'gain',value:1,min:0,max:10,step:1,defaultValue:1}]}});
        await command({kind:'begin',key:'gain',gesture:1});
        for(const value of [2,3])assert.equal((await command({kind:'edit',key:'gain',gesture:1,value,expectedVersion:0})).kind,'accepted');
        for(const [index,value] of [7,3].entries())await owner.dispatch({kind:'parameter',scope,endpoint:'gain',value,intent:intent(),origin:'external',observation:index+3});
        const count=publications.length;
        assert.deepEqual(await command({kind:'edit',key:'gain',gesture:1,value:9,expectedVersion:0}),{kind:'rejected',reason:'stale-version'});
        assert.equal(publications.length,count);
        const version=owner.getSnapshot().fields.gain.version;
        assert.equal((await command({kind:'edit',key:'gain',gesture:1,value:8,expectedVersion:version})).kind,'accepted');
        await command({kind:'end',key:'gain',gesture:1});
        await command({kind:'begin',key:'gain',gesture:2});
        await command({kind:'edit',key:'gain',gesture:2,value:6});
        await owner.dispatch({kind:'parameter',scope,endpoint:'gain',value:9,intent:intent(),origin:'external',observation:7});
        await command({kind:'end',key:'gain',gesture:2});
        assert.equal(owner.getSnapshot().fields.gain.value,9);
        await command({kind:'undo'});assert.equal(owner.getSnapshot().fields.gain.value,8);
        await command({kind:'redo'});assert.equal(owner.getSnapshot().fields.gain.value,6,'Redo restores the last user edit, not subsequent host automation');
    } finally {await owner.stop();}
});
