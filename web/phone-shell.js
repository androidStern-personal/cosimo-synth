// Give the instrument a real phone-sized viewport, so its existing media
// queries and component selection agree. synth.html remains the bare host.
if (window.parent !== window || location.pathname.endsWith('/synth.html')) {
    await import('./cosimo-web-host.js');
} else {
    const style = document.createElement('style');
    style.textContent = `
        body { display: flex; flex-direction: column; align-items: center;
            height: 100dvh; background: #090c14; }
        .phone-note { display: none; margin: 0; color: #b6b8ca;
            font-size: 12px; letter-spacing: .03em; }
        #cosimo-phone { display: block; width: min(100%, 430px); height: 100%;
            min-height: 0; flex: 1; border: 0; background: #080b14; }
        @media (min-width: 640px) {
            body { justify-content: center; gap: 14px; padding: 20px;
                background: radial-gradient(ellipse at 16% 20%, #34305a 0, transparent 52%),
                    radial-gradient(ellipse at 88% 78%, #123f46 0, transparent 52%), #090c14; }
            .phone-note { display: block; }
            #cosimo-phone { max-height: 900px; border-radius: 26px;
                box-shadow: 0 0 0 1px #ffffff12, 0 24px 100px #0008; }
        }
    `;
    document.head.append(style);
    const note = document.createElement('p');
    note.className = 'phone-note';
    note.textContent = 'Better on a phone';
    const frame = document.createElement('iframe');
    frame.id = 'cosimo-phone';
    frame.title = 'Cosimo Synth';
    frame.allow = 'autoplay; midi; clipboard-write; web-share';
    frame.src = location.href;
    document.body.replaceChildren(note, frame);
    // Navigation to another shared sound should reach the running instrument.
    window.addEventListener('hashchange', () => {
        frame.contentWindow.location.hash = location.hash;
    });
}
