const instrumentDocuments = new Set([
    "/", "/index", "/index.html", "/synth-page", "/synth-page.html", "/synth", "/synth.html",
]);

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const isDocument = instrumentDocuments.has(url.pathname);
        if (isDocument) {
            // A non-HTML asset avoids the host's automatic clean-URL redirect,
            // which otherwise sends the browser around this isolation boundary.
            url.pathname = "/cosimo-document.bin";
        } else if (url.pathname === "/favicon.ico") {
            url.pathname = "/favicon.svg";
        }
        const asset = await env.ASSETS.fetch(new Request(url, request));
        const response = new Response(asset.body, asset);
        response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
        response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
        if (isDocument) {
            response.headers.set("Content-Type", "text/html; charset=utf-8");
            response.headers.set("Cache-Control", "no-store");
        }
        return response;
    },
};
