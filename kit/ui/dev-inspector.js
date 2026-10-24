// Dev-only inspector; it fetches external fonts and phones home, so automated
// browsers (navigator.webdriver) skip it to keep test pages hermetic. Loaded
// only by the loader's dev path, never from a packaged production runtime, and
// a failure here must never break view loading.
if (import.meta.env.DEV && navigator.webdriver !== true) {
    try {
        await import("react-grab");
        await import("@react-grab/mcp/client");
    } catch (error) {
        console.warn("Could not load the React Grab dev inspector.", error);
    }
}
