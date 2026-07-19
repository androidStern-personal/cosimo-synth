import { useRef } from "react";
import { createInitialMockCosimoState } from "../domain/fixtures.js";
import { createMockCosimoAdapter } from "./createMockCosimoAdapter.ts";
import { usePortAdapter } from "./usePortAdapter.js";

/** Subscribe React to one in-memory CosimoAdapterPort fixture instance. */
export function useMockCosimoAdapter({
  createInitialState = createInitialMockCosimoState,
} = {}) {
  const adapterRef = useRef(null);
  if (adapterRef.current === null) {
    adapterRef.current = createMockCosimoAdapter({ createInitialState });
  }

  return usePortAdapter(adapterRef.current);
}
