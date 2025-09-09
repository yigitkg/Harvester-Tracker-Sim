import { useEffect, useRef, useState } from 'react';
import { createInitialState, tick } from './engine';
import type { SimState } from './engine';

export interface SimControls {
  running: boolean;
  targetSpeedKmh: number;
}

export function useSimulation() {
  const [state, setState] = useState<SimState>(createInitialState());
  const [controls, setControls] = useState<SimControls>({ running: false, targetSpeedKmh: 5.5 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    const loop = (now: number) => {
      if (lastRef.current == null) lastRef.current = now;
      const dt = now - lastRef.current;
      lastRef.current = now;
      setState((s) => tick({ dtMs: Math.min(200, dt), state: s, controls }));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [controls]);

  const api = {
    start: () => setControls((c) => ({ ...c, running: true })),
    pause: () => setControls((c) => ({ ...c, running: false })),
    reset: () => { setState(createInitialState()); setControls({ running: false, targetSpeedKmh: 5.5 }); },
    setSpeed: (v: number) => setControls((c) => ({ ...c, targetSpeedKmh: v })),
    setTimeScale: (v: number) => setState((s) => ({ ...s, timeScale: v })),
  };

  return { state, controls, api };
}
