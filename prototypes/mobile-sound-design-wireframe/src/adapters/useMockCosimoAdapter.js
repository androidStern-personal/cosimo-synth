import { useRef, useSyncExternalStore } from "react";
import { createInitialMockCosimoState } from "../domain/fixtures.js";
import { createMockCosimoAdapter } from "./createMockCosimoAdapter.ts";

/** Subscribe React to one in-memory CosimoAdapterPort fixture instance. */
export function useMockCosimoAdapter({
  createInitialState = createInitialMockCosimoState,
} = {}) {
  const adapterRef = useRef(null);
  if (adapterRef.current === null) {
    adapterRef.current = createMockCosimoAdapter({ createInitialState });
  }

  const adapter = adapterRef.current;
  const snapshot = useSyncExternalStore(
    adapter.subscribe,
    adapter.getSnapshot,
    adapter.getSnapshot,
  );

  return { snapshot, commands: adapter.commands };
}
