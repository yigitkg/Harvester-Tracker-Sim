export type OperatorStatus = 'Idle' | 'Harvesting' | 'Unloading' | 'Alarm';

export interface FieldConfig {
  width: number; // meters
  height: number; // meters
  headerWidth: number; // meters
  trailer: { x: number; y: number }; // meters (field coords)
}

export interface MachineConfig {
  tankCapacityKg: number;
  unloadRateKgPerMin: number; // kg/min
  optimalMinKmh: number;
  optimalMaxKmh: number;
  warnMaxKmh: number; // start yellow band upper bound
  alarmMinKmh: number; // > triggers alarm
  yieldKgPerM2: number; // baseline yield density
}

export interface Metrics {
  speedKmh: number;
  distanceM: number;
  throughputKgPerS: number;
  harvestingRateTPerH: number;
  harvestingRateKgPerMin: number;
  tankKg: number;
  tankFillPct: number;
  lossPct: number; // percentage of potential throughput lost
  lossKgPerHa: number;
  areaHarvestedHa: number;
}

export interface Pose { x: number; y: number; headingDeg: number; }

export interface SimState {
  status: OperatorStatus;
  field: FieldConfig;
  machine: MachineConfig;
  pose: Pose;
  laneIndex: number;
  goingRight: boolean;
  metrics: Metrics;
  timeScale: number; // 1x, 2x, 5x
  summary?: {
    totalHarvestedKg: number;
    avgSpeedKmh: number;
    avgLossPct: number;
    areaHa: number;
  } | null;
}

export const defaultField: FieldConfig = {
  width: 600, // 600 m wide (bigger field)
  height: 400, // 400 m tall
  headerWidth: 7.5,
  trailer: { x: 580, y: 20 },
};

export const defaultMachine: MachineConfig = {
  tankCapacityKg: 8000,
  unloadRateKgPerMin: 1200,
  optimalMinKmh: 5,
  optimalMaxKmh: 6,
  warnMaxKmh: 8,
  alarmMinKmh: 8,
  yieldKgPerM2: 0.65, // ~6.5 t/ha
};

export function createInitialState(): SimState {
  return {
    status: 'Idle',
    field: defaultField,
    machine: defaultMachine,
    pose: { x: 10, y: 10, headingDeg: 0 },
    laneIndex: 0,
    goingRight: true,
    metrics: {
      speedKmh: 5.5,
      distanceM: 0,
      throughputKgPerS: 0,
      harvestingRateTPerH: 0,
      harvestingRateKgPerMin: 0,
      tankKg: 0,
      tankFillPct: 0,
      lossPct: 0.8,
      lossKgPerHa: 0,
      areaHarvestedHa: 0,
    },
    timeScale: 1,
    summary: null,
  };
}

export function kmhToMps(kmh: number) { return kmh / 3.6; }

function computeLossPct(speedKmh: number, optimalMax: number, alarmMin: number): number {
  // Baseline 0.8% at optimal; quadratic rise above optimal; stronger beyond 8 km/h
  if (speedKmh <= optimalMax) return 0.8;
  const over = Math.max(0, speedKmh - optimalMax);
  let pct = 0.8 + 0.25 * over * over; // quadratic rise
  if (speedKmh > alarmMin) pct += 0.4 * (speedKmh - alarmMin); // steeper in red zone
  return Math.min(10, pct); // clamp
}

export interface TickInput {
  dtMs: number;
  state: SimState;
  controls: {
    targetSpeedKmh: number;
    running: boolean;
  };
}

export function tick({ dtMs, state, controls }: TickInput): SimState {
  const s = structuredClone(state) as SimState;
  const dtSec = (dtMs / 1000) * s.timeScale;
  const speedKmh = controls.running ? controls.targetSpeedKmh : 0;
  const speedMps = kmhToMps(speedKmh);

  // Status transitions
  const atAlarm = speedKmh > s.machine.alarmMinKmh;
  if (!controls.running && s.status !== 'Unloading') s.status = 'Idle';
  else if (s.status !== 'Unloading') s.status = atAlarm ? 'Alarm' : 'Harvesting';

  // Movement & harvesting only when not unloading and running
  if (s.status !== 'Unloading' && controls.running) {
    const nextX = s.pose.x + (s.goingRight ? 1 : -1) * speedMps * dtSec;
    const laneY = 10 + s.laneIndex * s.field.headerWidth;
    s.pose.y = Math.min(s.field.height - 5, laneY);
    s.pose.x = nextX;
    s.pose.headingDeg = s.goingRight ? 0 : 180;

    // Lane switching
    if (s.goingRight && s.pose.x >= s.field.width - 10) {
      s.goingRight = false; s.laneIndex += 1; s.pose.headingDeg = 180;
    }
    if (!s.goingRight && s.pose.x <= 10) {
      s.goingRight = true; s.laneIndex += 1; s.pose.headingDeg = 0;
    }

    // Wrap if beyond field height (simple loop)
    const maxLanes = Math.floor((s.field.height - 20) / s.field.headerWidth);
    if (s.laneIndex > maxLanes) { s.laneIndex = 0; s.pose.y = 10; }

    // Distance and area
    s.metrics.distanceM += Math.abs(speedMps * dtSec);
    const sweptAreaM2 = speedMps * dtSec * s.field.headerWidth;
    s.metrics.areaHarvestedHa += Math.max(0, sweptAreaM2) / 10000;

    // Throughput and tank
    const potentialKgPerS = speedMps * s.field.headerWidth * s.machine.yieldKgPerM2;
    const lossPct = computeLossPct(speedKmh, s.machine.optimalMaxKmh, s.machine.alarmMinKmh);
    const capturedKgPerS = potentialKgPerS * (1 - lossPct / 100);
    s.metrics.throughputKgPerS = capturedKgPerS;
    s.metrics.harvestingRateTPerH = (capturedKgPerS * 3.6) / 1000; // kg/s -> t/h
    s.metrics.harvestingRateKgPerMin = capturedKgPerS * 60;
    s.metrics.lossPct = lossPct;
    // Approximate loss kg/ha using current loss rate scaled to yield density baseline
    s.metrics.lossKgPerHa = s.machine.yieldKgPerM2 * 10000 * (lossPct / 100);

    s.metrics.tankKg += capturedKgPerS * dtSec;
    s.metrics.tankFillPct = Math.min(100, (s.metrics.tankKg / s.machine.tankCapacityKg) * 100);

    // Tank full -> unloading
    if (s.metrics.tankKg >= s.machine.tankCapacityKg) {
      s.status = 'Unloading';
    }
  }

  // Unloading state: move toward trailer and unload
  if (s.status === 'Unloading') {
    // Move towards trailer at a fixed travel speed
    const travelMps = kmhToMps(8);
    const dx = s.field.trailer.x - s.pose.x;
    const dy = s.field.trailer.y - s.pose.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.1) {
      const ux = dx / dist, uy = dy / dist;
      const step = Math.min(dist, travelMps * dtSec);
      s.pose.x += ux * step; s.pose.y += uy * step;
      s.pose.headingDeg = (Math.atan2(uy, ux) * 180) / Math.PI;
    } else {
      // At trailer: unload
      const unloadKgPerS = s.machine.unloadRateKgPerMin / 60;
      const delta = unloadKgPerS * dtSec;
      s.metrics.tankKg = Math.max(0, s.metrics.tankKg - delta);
      s.metrics.tankFillPct = (s.metrics.tankKg / s.machine.tankCapacityKg) * 100;
      if (s.metrics.tankKg <= 0.01) {
        // summary snapshot
        s.summary = {
          totalHarvestedKg: s.machine.tankCapacityKg,
          avgSpeedKmh: s.metrics.distanceM > 0 ? undefined as unknown as number : 0,
          // For MVP, compute rough avg speed as current target; refined later
          avgLossPct: s.metrics.lossPct,
          areaHa: s.metrics.areaHarvestedHa,
        };
        // Reset tank and resume harvesting at next lane
        s.metrics.tankKg = 0; s.metrics.tankFillPct = 0;
        s.status = 'Harvesting';
      }
    }
  }

  // Maintain displayed speed
  s.metrics.speedKmh = speedKmh;
  return s;
}
