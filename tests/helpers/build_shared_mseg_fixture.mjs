import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { stageCustomerStateFixture, buildCustomerStateFixture } from "./build_customer_state_fixture.mjs";

const root=path.resolve(import.meta.dirname,'../..');
export async function buildSharedMsegFixture() {
    const buildRoot=path.join(root,'build/shared_mseg');
    const staging = await stageCustomerStateFixture(buildRoot, 'plugin_state_shared_data', 'shared_mseg');
    const { manifestPath: manifest } = await buildCustomerStateFixture(staging, 'shared-mseg',
        'build/fx/shared_mseg_runtime/SharedMseg.cmajorpatch');
    await writeFile(path.join(buildRoot,'manifest-path.txt'),manifest+'\n');
    return {staging,manifest,runtime:path.dirname(manifest)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
    console.log((await buildSharedMsegFixture()).manifest);
