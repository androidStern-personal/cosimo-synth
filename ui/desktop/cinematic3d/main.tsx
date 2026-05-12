import { createRoot } from "react-dom/client";

import { CosimoCinematic3DComposition } from "./CosimoCinematic3DComposition";

const root = document.getElementById("root");

if (!root) {
    throw new Error("Cinematic3D root element is missing.");
}

createRoot(root).render(<CosimoCinematic3DComposition />);
