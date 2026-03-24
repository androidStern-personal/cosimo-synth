import { loadWavetableFramesFromUrls, getFactoryBankValue } from "./wavetable-bank.mjs";
import { CanvasWavetableDisplay } from "./wavetable-display.mjs";

async function loadManifest() {
    const response = await fetch("../WavetableSynth.cmajorpatch");

    if (!response.ok) {
        throw new Error(`Could not load patch manifest: ${response.status}`);
    }

    return response.json();
}

const stage = document.getElementById("stage");
const canvas = document.getElementById("canvas");
const positionInput = document.getElementById("position");
const positionValue = document.getElementById("position-value");
const animateInput = document.getElementById("animate");
const status = document.getElementById("status");
const display = new CanvasWavetableDisplay(canvas);

function resizeDisplay() {
    const bounds = stage.getBoundingClientRect();
    display.resize(bounds.width, bounds.height, window.devicePixelRatio || 1);
}

function setPosition(value) {
    const numericValue = Number(value);
    positionInput.value = numericValue.toFixed(3);
    positionValue.textContent = numericValue.toFixed(3);
    display.setPosition(numericValue);
}

if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(() => resizeDisplay());
    observer.observe(stage);
} else {
    window.addEventListener("resize", resizeDisplay);
}

resizeDisplay();

const manifest = await loadManifest();
const manifestValue = getFactoryBankValue(manifest);
const sampleBlobUrl = new URL(`../${manifestValue.sampleBlob}`, import.meta.url);
const bank = await loadWavetableFramesFromUrls({
    manifestValue,
    sampleBlobUrl,
});

display.setFrames(bank.frames);
setPosition(positionInput.value);
status.textContent = `Loaded ${bank.frameCount} frames from the real display-demo bank`;

positionInput.addEventListener("input", () => setPosition(positionInput.value));

let animationFrame = null;
let animationStart = performance.now();

function tick(now) {
    const phase = ((now - animationStart) / 4000) % 1;
    setPosition(phase);
    animationFrame = requestAnimationFrame(tick);
}

animateInput.addEventListener("change", () => {
    if (animateInput.checked) {
        animationStart = performance.now();
        animationFrame = requestAnimationFrame(tick);
    } else if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
});
