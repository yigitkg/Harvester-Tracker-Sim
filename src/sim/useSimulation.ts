import { useEffect, useRef, useState } from 'react';
import { createInitialState, tick } from './engine';
import type { SimState } from './engine';

export interface SimControls {
  running: boolean;
  paused?: boolean;
  targetSpeedKmh: number;
}

export function useSimulation() {
  const [state, setState] = useState<SimState>(createInitialState());
  const [controls, setControls] = useState<SimControls>({ running: false, paused: false, targetSpeedKmh: 5.5 });

  // Autopilot speed profile (varies speed to simulate operator behavior)
  const autoEnabledRef = useRef(true);
  const desiredSpeedRef = useRef(5.5);
  const currentSpeedRef = useRef(5.5);
  const segmentMsRef = useRef(0);
  const timeScaleRef = useRef(1);
  const runningRef = useRef(false);

  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const accumRef = useRef<number>(0);

  function pickNextSegment() {
    // Segment types: cruise (5.2-5.8), push (7.2-8.2), overspeed (8.5-9.5)
    const r = Math.random();
    if (r < 0.7) {
      desiredSpeedRef.current = 5.2 + Math.random() * 0.6;
      segmentMsRef.current = 8000 + Math.random() * 7000; // 8-15s
    } else if (r < 0.92) {
      desiredSpeedRef.current = 7.2 + Math.random() * 1.0;
      segmentMsRef.current = 5000 + Math.random() * 6000; // 5-11s
    } else {
      desiredSpeedRef.current = 8.5 + Math.random() * 1.0;
      segmentMsRef.current = 3000 + Math.random() * 5000; // 3-8s
    }
  }

  // Keep refs in sync
  useEffect(() => { timeScaleRef.current = state.timeScale; }, [state.timeScale]);
  useEffect(() => { runningRef.current = controls.running; }, [controls.running]);

  useEffect(() => {
    // Start with an initial segment
    pickNextSegment();
    const loop = (now: number) => {
      if (lastRef.current == null) lastRef.current = now;
      let dt = now - lastRef.current;
      lastRef.current = now;
      // cap dt to avoid long sleeps
      dt = Math.min(dt, 200);

      // Update autopilot speeds
      const scale = timeScaleRef.current || 1;
      const effDt = dt * scale;
      if (autoEnabledRef.current && runningRef.current) {
        // Decrease remaining segment time
        segmentMsRef.current -= effDt;
        if (segmentMsRef.current <= 0) pickNextSegment();
        // Smooth towards desired (limit accel ~0.5 km/h per second)
        const accel = 0.5; // km/h per real second at 1x
        const delta = accel * (dt / 1000);
        const target = desiredSpeedRef.current;
        const cur = currentSpeedRef.current;
        if (cur < target) currentSpeedRef.current = Math.min(target, cur + delta);
        else if (cur > target) currentSpeedRef.current = Math.max(target, cur - delta);
      } else {
        currentSpeedRef.current = controls.targetSpeedKmh;
      }

      // Accumulate and tick at ~5 Hz to reduce React work
      accumRef.current += dt;
      if (accumRef.current >= 200) {
        accumRef.current = 0;
        // Build effective controls without triggering effect restarts
        const effectiveSpeed = autoEnabledRef.current ? currentSpeedRef.current : controls.targetSpeedKmh;
        setState((s) => tick({ dtMs: 200, state: s, controls: { running: controls.running, targetSpeedKmh: effectiveSpeed } }));
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // Only restart loop if running or timescale changes
  }, [controls.running, state.timeScale]);

  const api = {
    start: () => setControls((c) => ({ ...c, running: true, paused: false })),
    pause: () => setControls((c) => ({ ...c, running: false, paused: true })),
    reset: () => { setState(createInitialState()); setControls({ running: false, paused: false, targetSpeedKmh: 5.5 }); },
    setSpeed: (v: number) => setControls((c) => ({ ...c, targetSpeedKmh: v })),
    setTimeScale: (v: number) => setState((s) => ({ ...s, timeScale: v })),
    enableAutopilot: (on: boolean) => { autoEnabledRef.current = on; },
  };

  return { state, controls, api };
}
