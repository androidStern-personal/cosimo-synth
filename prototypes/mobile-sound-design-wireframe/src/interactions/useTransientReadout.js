import { useCallback, useEffect, useRef, useState } from "react";

export function useTransientReadout(duration = 2200) {
  const [readout, setReadout] = useState("");
  const timer = useRef(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const showReadout = useCallback((message) => {
    setReadout(message);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setReadout(""), duration);
  }, [duration]);

  return { readout, showReadout };
}
