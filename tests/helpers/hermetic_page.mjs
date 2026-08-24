/**
 * Browser-suite pages must render from the local harness alone, so results
 * cannot vary with the network. Remotion's web renderer fires a licensing
 * ping at remotion.pro on every render; it is fulfilled empty so a render
 * neither waits on nor errors through the real network. Any other external
 * request aborts, which surfaces as a console error in the suite's failure
 * capture with the offending page state.
 *
 * Accepts a Playwright Page or BrowserContext.
 */
export async function routeHermeticPage(pageOrContext, baseUrl) {
    const localHost = new URL(baseUrl).host;
    await pageOrContext.route("**/*", (route) => {
        const host = new URL(route.request().url()).host;
        if (host === localHost) return route.continue();
        if (host === "www.remotion.pro") {
            // The licensing client requires this exact success shape.
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ success: true, billable: null, classification: null }),
            });
        }
        return route.abort();
    });
}
