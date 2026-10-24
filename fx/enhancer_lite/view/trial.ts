declare global {
    interface Window {
        /** Product-native bridge; opens only the fixed Song Machines checkout. */
        enhance_openCheckout?: () => Promise<boolean>;
    }
}

/** Mount the trial reminder only inside an opened editor; never touches audio or state. */
export function createTrialReminder(): HTMLDialogElement {
    const dialog = document.createElement("dialog");
    dialog.className = "enhance-trial";
    dialog.setAttribute("aria-labelledby", "enhance-trial-title");
    dialog.innerHTML = `
        <style>
        .enhance-trial { box-sizing:border-box; width:min(420px,90vw); padding:28px;
            border:1px solid #42464d; border-radius:14px; background:#14171b; color:#fdfff5;
            font:15px/1.5 system-ui,sans-serif; box-shadow:0 18px 60px #0009; }
        .enhance-trial::backdrop { background:#0009; }
        .enhance-trial h2 { margin:0 0 12px; font-size:24px; letter-spacing:-.6px; }
        .enhance-trial p { margin:0 0 22px; color:#c4c9cd; }
        .enhance-trial .trial-actions { display:flex; gap:10px; flex-wrap:wrap; }
        .enhance-trial a,.enhance-trial button { box-sizing:border-box; padding:11px 16px;
            border-radius:24px; font:600 14px system-ui,sans-serif; cursor:pointer; }
        .enhance-trial a { background:#c4f323; color:#171b0c; text-decoration:none; }
        .enhance-trial button { border:1px solid #575c63; background:transparent; color:#fdfff5; }
        .enhance-trial :focus-visible { outline:2px solid #fdfff5; outline-offset:3px; }
        </style>
        <h2 id="enhance-trial-title">You're using the trial version.</h2>
        <p>Enjoying Enhance That? Get the full version with Builder Kit to remove this reminder and make it your own.</p>
        <div class="trial-actions">
            <a href="https://song-machines.com/enhance-that/checkout" target="_blank" rel="noopener noreferrer">Buy Builder Kit</a>
            <button type="button" autofocus>Continue trial</button>
        </div>`;
    dialog.querySelector("button")?.addEventListener("click", () => dialog.close());
    dialog.querySelector("a")?.addEventListener("click", async event => {
        if (!window.enhance_openCheckout) return;
        event.preventDefault();
        try {
            if (await window.enhance_openCheckout()) return;
        } catch { /* Keep the editor usable if the operating system declines. */ }
        const message = dialog.querySelector("p");
        if (message) message.textContent = "Open song-machines.com in your browser to buy Builder Kit.";
    });
    return dialog;
}
