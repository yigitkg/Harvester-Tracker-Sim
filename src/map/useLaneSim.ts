import { useEffect, useRef, useState } from 'react';
import * as turf from '@turf/turf';
import type { Feature, LineString as GJLineString } from 'geojson';

type LineString = Feature<GJLineString>;

export interface LaneSimState {
  laneIndex: number;
  distM: number;
}

export interface LaneSimControls {
  running: boolean;
  speedKmh: number;
  timeScale?: number;
}

export function useLaneSim(lanes: LineString[] | null, controls: LaneSimControls) {
  const [state, setState] = useState<LaneSimState>({ laneIndex: 0, distM: 0 });
  const [position, setPosition] = useState<[number, number] | null>(null); // [lat,lng]
  const [headingDeg, setHeadingDeg] = useState<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    if (!lanes || lanes.length === 0) return;
    const loop = (now: number) => {
      if (lastRef.current == null) lastRef.current = now;
      const dt = now - lastRef.current;
      lastRef.current = now;

      setState((s) => {
        let { laneIndex, distM } = s;
        const speedMps = (controls.speedKmh / 3.6) * (controls.timeScale ?? 1);
        if (controls.running) {
          distM += speedMps * Math.min(dt, 200) / 1000;
        }
        // Advance through lanes
        let lane = lanes[laneIndex];
        let laneLenM = turf.length(lane, { units: 'kilometers' }) * 1000;
        while (lanes && distM > laneLenM && laneIndex < lanes.length - 1) {
          distM -= laneLenM;
          laneIndex++;
          lane = lanes[laneIndex];
          laneLenM = turf.length(lane, { units: 'kilometers' }) * 1000;
        }
        const alongKm = Math.max(0, Math.min(laneLenM, distM)) / 1000;
        const pt = turf.along(lane, alongKm, { units: 'kilometers' });
        // heading by looking slightly ahead
        const pt2 = turf.along(lane, Math.min(laneLenM/1000, alongKm + 0.005), { units: 'kilometers' });
        const b = turf.bearing(pt, pt2);
        setPosition([pt.geometry.coordinates[1], pt.geometry.coordinates[0]]);
        setHeadingDeg(b);
        return { laneIndex, distM };
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [lanes, controls.running, controls.speedKmh]);

  useEffect(() => { setState({ laneIndex: 0, distM: 0 }); }, [lanes]);

  return { position, headingDeg, laneState: state };
}
