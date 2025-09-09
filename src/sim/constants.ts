export const CONFIG = {
  optimalSpeedKmh: 5.5,
  warningMinKmh: 6,
  alarmMinKmh: 8,
  speedMinKmh: 4,
  speedMaxKmh: 10,
  headerWidthM: 7.5,
  fieldWidthM: 200,
  fieldHeightM: 120,
  yieldKgPerM2: 0.65, // ~6.5 t/ha
  tankCapacityKg: 8000,
  unloadRateKgPerMin: 1200,
  tickSeconds: 0.2,
};

export const TRAILER = {
  x: CONFIG.fieldWidthM - 10,
  y: 10,
};

