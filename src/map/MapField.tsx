import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Polygon as RLPolygon } from 'react-leaflet';
import L from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import type { Feature, Polygon as TPolygon, LineString as TLineString, Position } from 'geojson';

// Fix default icon path issues in bundlers
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type LineString = Feature<TLineString>;
type Polygon = Feature<TPolygon>;

function coordsToLatLngs(coords: Position[]): LatLngExpression[] {
  return coords.map((c) => [c[1], c[0]]);
}

type LatLng = [number, number]; // [lat, lng]
function offsetLL(point: LatLng, distanceM: number, bearingDeg: number): LatLng {
  const pt = turf.point([point[1], point[0]]);
  const dest = turf.destination(pt, distanceM / 1000, bearingDeg, { units: 'kilometers' });
  const [lng, lat] = (dest.geometry.coordinates as [number, number]);
  return [lat, lng];
}
function lerpLL(a: LatLng, b: LatLng, t: number): LatLng {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export interface MapFieldProps {
  lanes: LineString[];
  position?: LatLngExpression | null;
  polygon: Polygon;
  laneState?: { laneIndex: number; distM: number } | null;
}

export function MapField({ lanes, position, polygon, laneState }: MapFieldProps) {
  const mapRef = useRef<L.Map | null>(null);
  const boostedZoomRef = useRef(false);
  const fittedRef = useRef(false);
  useEffect(() => {
    const target = polygon;
    if (mapRef.current && target && !fittedRef.current) {
      fittedRef.current = true;
      const b = turf.bbox(target as any);
      const sw = L.latLng(b[1], b[0]);
      const ne = L.latLng(b[3], b[2]);
      mapRef.current.fitBounds(L.latLngBounds(sw, ne), { padding: [8, 8], maxZoom: 19 });
      // Nudge zoom in after bounds fit to ensure closer initial view
      if (!boostedZoomRef.current) {
        boostedZoomRef.current = true;
        const m = mapRef.current;
        m?.once('moveend', () => {
          const targetZoom = (m.options as any).maxZoom ?? 19;
          const center = m.getCenter();
          m.setView(center, targetZoom, { animate: true } as any);
        });
      }
    }
  }, [polygon]);

  const laneLatLngs = useMemo(() => (
    (lanes ?? [])
      .filter(l => Array.isArray(l.geometry.coordinates) && (l.geometry.coordinates as any[]).length >= 2)
      .map(l => coordsToLatLngs(l.geometry.coordinates))
  ), [lanes]);

  // Precompute lane rectangles (full strips) for harvested coverage
  const headerWidthM = 7.5;
  const laneRects = useMemo(() => {
    return (lanes ?? []).map((ln) => {
      const coords = (ln.geometry.coordinates as [number, number][]);
      const Axy = coords[0];
      const Bxy = coords[coords.length - 1];
      const A: LatLng = [Axy[1], Axy[0]];
      const B: LatLng = [Bxy[1], Bxy[0]];
      const lenM = turf.length(ln as any, { units: 'kilometers' }) * 1000;
      const bearing = turf.bearing(turf.point(Axy), turf.point(Bxy));
      const leftBear = bearing - 90;
      const rightBear = bearing + 90;
      const half = headerWidthM / 2;
      const A_left = offsetLL(A, half, leftBear);
      const A_right = offsetLL(A, half, rightBear);
      const B_left = offsetLL(B, half, leftBear);
      const B_right = offsetLL(B, half, rightBear);
      const fullRect: LatLngExpression[] = [A_left, A_right, B_right, B_left];
      return { A, B, lenM, leftBear, rightBear, A_left, A_right, fullRect };
    });
  }, [lanes]);

  return (
    <div className="card p-3 w-full">
      <MapContainer
        ref={(m) => { mapRef.current = m; }}
        center={[37.6568, 27.366] as any}
        zoom={15}
        preferCanvas={true}
        updateWhenIdle={true}
        maxZoom={19}
        style={{ height: '70vh', minHeight: 560, maxHeight: 720, width: '100%' }}
      >
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} keepBuffer={1} />
        {polygon && (
          <RLPolygon positions={coordsToLatLngs(polygon.geometry.coordinates[0])} pathOptions={{ color: '#22c55e', weight: 2, fill: true, fillColor: '#16a34a', fillOpacity: 0.15 }} />
        )}
        {laneLatLngs.map((ll, idx) => (
          <Polyline key={idx} positions={ll} pathOptions={{ color: '#94a3b8', weight: 2, opacity: 0.6 }} />
        ))}
        {/* Coverage shading via rectangles: completed lanes + partial current lane */}
        {laneState && laneRects && laneRects.length > 0 && (
          <>
            {laneRects.map((lr, idx) => (
              idx < laneState.laneIndex ? (
                <RLPolygon
                  key={`cov-full-${idx}`}
                  positions={lr.fullRect}
                  pathOptions={{ color: '#10b981', weight: 0, fill: true, fillOpacity: 0.28, fillColor: '#10b981' }}
                />
              ) : null
            ))}
            {(() => {
              const idx = laneState.laneIndex;
              const lr = laneRects[idx];
              if (!lr) return null;
              const t = lr.lenM > 0 ? Math.max(0, Math.min(1, laneState.distM / lr.lenM)) : 0;
              if (t <= 0) return null;
              const P = lerpLL(lr.A, lr.B, t);
              const half = headerWidthM / 2;
              const P_left = offsetLL(P as LatLng, half, lr.leftBear);
              const P_right = offsetLL(P as LatLng, half, lr.rightBear);
              const partialRect: LatLngExpression[] = [lr.A_left, lr.A_right, P_right, P_left];
              return (
                <RLPolygon
                  key={`cov-part-${idx}`}
                  positions={partialRect}
                  pathOptions={{ color: '#10b981', weight: 0, fill: true, fillOpacity: 0.45, fillColor: '#10b981' }}
                />
              );
            })()}
          </>
        )}
        {position && (
          <Marker
            icon={L.icon({ iconUrl: '/harvestericon2.png', iconSize: [28, 28], iconAnchor: [14, 14] })}
            position={position as any}
          />
        )}
      </MapContainer>
    </div>
  );
}
