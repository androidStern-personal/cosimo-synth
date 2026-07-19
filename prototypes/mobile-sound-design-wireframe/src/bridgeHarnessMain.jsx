import React from "react";
import { createRoot } from "react-dom/client";
import { MockPatchConnection } from "../../../ui/shared/patch-connection-mock.ts";
import { createCosimoBridgeAdapter } from "../../../ui/shared/cosimo-bridge-adapter.ts";
import { CosimoMobileExperience } from "./App.jsx";
import { usePortAdapter } from "./adapters/usePortAdapter.js";
import "./styles.css";

/**
 * Phase-3 vertical-slice harness: the full mobile shell mounted over the
 * ENGINE BRIDGE speaking the real PatchConnection protocol into a recording
 * MockPatchConnection. Everything the UI does here flows through endpoint
 * events and stored-state writes exactly as it will on device.
 */
const connection = new MockPatchConnection({ name: "Cosimo bridge harness", version: 1 });
const bridge = createCosimoBridgeAdapter({ connection });

// Expose both for agent-browser protocol assertions.
window.__COSIMO_BRIDGE_HARNESS__ = { connection, bridge, pageErrors: [] };
window.addEventListener("error", (event) => {
  window.__COSIMO_BRIDGE_HARNESS__.pageErrors.push(String(event.error?.stack || event.message));
});
window.addEventListener("unhandledrejection", (event) => {
  window.__COSIMO_BRIDGE_HARNESS__.pageErrors.push(`rejection: ${event.reason}`);
});

class HarnessErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    window.__COSIMO_BRIDGE_HARNESS__.lastError = `${error.message}\n${error.stack}`;
  }

  render() {
    if (this.state.error) {
      return <pre style={{ padding: 16 }}>{String(this.state.error.message)}</pre>;
    }
    return this.props.children;
  }
}

function BridgeApp() {
  const adapter = usePortAdapter(bridge);
  return (
    <HarnessErrorBoundary>
      <CosimoMobileExperience adapter={adapter} />
    </HarnessErrorBoundary>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BridgeApp />
  </React.StrictMode>,
);
