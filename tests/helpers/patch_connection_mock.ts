/**
 * Browser-test entry for the shared synth patch-connection fake. Import it
 * from a page served by `startStaticRepoServer({ bundleTypeScript: true })`:
 *
 *     const { MockPatchConnection } = await import("/tests/helpers/patch_connection_mock.ts");
 *
 * The mock implements the full PatchConnectionLike surface (parameters,
 * endpoints, status, stored state, gestures) with a debug snapshot, so
 * browser suites can reuse it instead of hand-rolling a fake. It is
 * DOM-bound (its keyboard utility extends HTMLElement) and models the synth
 * engine, so Node-side unit tests keep their own minimal recorders.
 */
export { MockPatchConnection, loadHarnessManifest } from "../../ui/shared/patch-connection-mock";
