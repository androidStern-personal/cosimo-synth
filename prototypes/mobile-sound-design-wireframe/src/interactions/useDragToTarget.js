import { useRef, useState } from "react";

/**
 * Browser prototype implementation of source-to-target assignment. The future
 * iOS bridge can replace target resolution without changing SourceShelf or
 * ParameterControl.
 */
export function useDragToTarget({ resolveTarget, onDrop, onTargetChange }) {
  const drag = useRef(null);
  const [draggedId, setDraggedId] = useState(null);
  const [targetId, setTargetId] = useState(null);

  const begin = (itemId) => {
    drag.current = { itemId, targetId: null };
    setDraggedId(itemId);
    setTargetId(null);
  };

  const move = (clientX, clientY) => {
    if (!drag.current) return;
    const nextTargetId = resolveTarget(clientX, clientY, drag.current.itemId);
    if (drag.current.targetId === nextTargetId) return;
    drag.current.targetId = nextTargetId;
    setTargetId(nextTargetId);
    onTargetChange?.(nextTargetId);
  };

  const finish = (cancelled = false) => {
    const current = drag.current;
    if (!cancelled && current?.targetId) onDrop(current.itemId, current.targetId);
    drag.current = null;
    setDraggedId(null);
    setTargetId(null);
  };

  return { begin, move, finish, draggedId, targetId };
}
