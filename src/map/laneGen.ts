import * as turf from '@turf/turf';
import type { Feature, LineString as GJLineString, Polygon as GJPolygon } from 'geojson';

export type LineString = Feature<GJLineString>;
export type Polygon = Feature<GJPolygon>;

export interface LaneGenOptions {
  headerWidthM: number;
  bearingDeg?: number; // optional manual lane direction (0=N, 90=E)
  maxOffsets?: number; // safety cap
  minSegmentM?: number; // prune tiny segments
}

export function generateLanes(polygon: Polygon, opts: LaneGenOptions): LineString[] {
  const header = opts.headerWidthM || 7.5;
  const maxOffsets = opts.maxOffsets ?? 400;
  const minSeg = opts.minSegmentM ?? 10;

  const centroid = turf.centroid(polygon);
  const bbox = turf.bbox(polygon);
  const dx = bbox[2] - bbox[0];
  const dy = bbox[3] - bbox[1];
  // Choose bearing by bbox aspect: wider → N-S lanes (bearing 0), taller → E-W lanes (bearing 90)
  const bearing = opts.bearingDeg ?? (dx >= dy ? 0 : 90);

  // Create a long baseline line through the centroid
  const p1 = turf.destination(centroid, 10000, bearing - 180, { units: 'meters' });
  const p2 = turf.destination(centroid, 10000, bearing, { units: 'meters' });
  const base = turf.lineString([p1.geometry.coordinates as any, p2.geometry.coordinates as any]);

  const lanes: LineString[] = [];
  const boundary = turf.polygonToLine(polygon) as any;
  let emptyStreak = 0;
  for (let i = -maxOffsets; i <= maxOffsets; i++) {
    const offDist = i * header;
    const off = turf.lineOffset(base, offDist, { units: 'meters' });
    // Split offset line by polygon boundary lines, then keep inside segments
    const split = turf.lineSplit(off, boundary);
    let addedThisOffset = 0;
    for (const f of split.features) {
      if (f.geometry.type !== 'LineString') continue;
      const coords = (f.geometry as any).coordinates as number[][];
      if (!coords || coords.length < 2) continue;
      const lenKm = turf.length(f as any, { units: 'kilometers' });
      const lenM = lenKm * 1000;
      if (lenM < minSeg) continue;
      const mid = turf.along(f, lenKm / 2, { units: 'kilometers' });
      if (turf.booleanPointInPolygon(mid, polygon)) {
        lanes.push(f as any as LineString);
        addedThisOffset++;
      }
    }
    if (addedThisOffset === 0) emptyStreak++;
    else emptyStreak = 0;
    if (emptyStreak > 20 && i > 0) break; // no more intersections likely beyond this
  }

  // Sort by offset index order (approximate by average x/y along line projected onto normal)
  // For simplicity, sort by the first coordinate along perpendicular axis based on bearing.
  const perpAxis = (bearing + 90) % 180; // 0 or 90 in this scheme
  lanes.sort((a, b) => {
    const a0 = a.geometry.coordinates[0];
    const b0 = b.geometry.coordinates[0];
    return perpAxis === 0 ? a0[1] - b0[1] : a0[0] - b0[0];
  });

  // Boustrophedon: reverse every other lane for minimal turning
  for (let i = 0; i < lanes.length; i++) {
    if (i % 2 === 1) {
      const rev = [...lanes[i].geometry.coordinates].reverse();
      lanes[i] = turf.lineString(rev) as LineString;
    }
  }
  return lanes;
}
