import { useSyncExternalStore } from "react";

/**
 * Subscribe React to any CosimoAdapterPort. The composition root owns the
 * port instance (mock fixture, engine bridge); this hook only wires reads.
 */
export function usePortAdapter(port) {
  const snapshot = useSyncExternalStore(port.subscribe, port.getSnapshot, port.getSnapshot);
  return { snapshot, commands: port.commands };
}
