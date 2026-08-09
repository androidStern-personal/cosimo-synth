// Sites/web builds always load the checked-in compiled UI beside this module.
// Desktop HMR selection remains isolated in patch_gui/desktop/index.js.
// The content fingerprint prevents a prior deployment's immutable module response
// from surviving across a production publish at this otherwise stable asset path.
export { createDesktopPatchView } from "./app.js?v=__COSIMO_DESKTOP_APP_HASH__";
export { default } from "./app.js?v=__COSIMO_DESKTOP_APP_HASH__";
