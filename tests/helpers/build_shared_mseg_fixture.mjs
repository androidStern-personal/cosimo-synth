import { cp, mkdir, mkdtemp, symlink, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root=path.resolve(import.meta.dirname,'../..');
export async function buildSharedMsegFixture() {
    const buildRoot=path.join(root,'build/shared_mseg');
    await mkdir(buildRoot,{recursive:true});
    const staging=await mkdtemp(path.join(buildRoot,'fixture-'));
    await mkdir(path.join(staging,'kit'));
    await Promise.all([
        cp(path.join(root,'kit/fx'),path.join(staging,'kit/fx'),{recursive:true}),
        cp(path.join(root,'kit/ui'),path.join(staging,'kit/ui'),{recursive:true}),
        ...['index.ts','package.json','kit.json'].map(file=>cp(path.join(root,'kit',file),path.join(staging,'kit',file))),
        cp(path.join(root,'tests/native/fixtures/plugin_state_shared_data'),path.join(staging,'fx/shared_mseg'),{recursive:true}),
        mkdir(path.join(staging,'ui/shared'),{recursive:true}),
        symlink(path.join(root,'node_modules'),path.join(staging,'node_modules')),
        writeFile(path.join(staging,'package.json'),JSON.stringify({private:true,type:'module'})),
    ]);
    await cp(path.join(root,'ui/shared/mseg.ts'),path.join(staging,'ui/shared/mseg.ts'));
    execFileSync(process.execPath,['kit/fx/build-effect.mjs','shared-mseg'],{cwd:staging,stdio:'pipe',timeout:30000});
    const manifest=path.join(staging,'build/fx/shared_mseg_runtime/SharedMseg.cmajorpatch');
    const config=JSON.parse(await readFile(manifest,'utf8'));
    if(config.worker!=='worker.js')throw Error('Production builder did not create the state worker');
    await writeFile(path.join(buildRoot,'manifest-path.txt'),manifest+'\n');
    return {staging,manifest,runtime:path.dirname(manifest)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
    console.log((await buildSharedMsegFixture()).manifest);
