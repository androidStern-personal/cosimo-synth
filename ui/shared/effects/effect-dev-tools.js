// Dev-only inspector; it fetches external fonts and phones home, so automated
// browsers (navigator.webdriver) skip it to keep test pages hermetic.
if (import.meta.env.DEV && navigator.webdriver !== true) {
    await import("react-grab");
    await import("@react-grab/mcp/client");
}
