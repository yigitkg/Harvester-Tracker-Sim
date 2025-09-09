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

export interface MapFieldProps {
  lanes: LineString[];
  position?: LatLngExpression | null;
  polygon: Polygon;
  laneState?: { laneIndex: number; distM: number } | null;
}

export function MapField({ lanes, position, polygon, laneState }: MapFieldProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [localPoly, setLocalPoly] = useState<Polygon | null>(polygon ?? null);
  useEffect(() => { if (polygon) setLocalPoly(polygon); }, [polygon]);
  useEffect(() => {
    const target = polygon || localPoly;
    if (mapRef.current && target) {
      const b = turf.bbox(target as any);
      const sw = L.latLng(b[1], b[0]);
      const ne = L.latLng(b[3], b[2]);
      mapRef.current.fitBounds(L.latLngBounds(sw, ne), { padding: [20, 20] });
    }
  }, [polygon, localPoly]);

  const laneLatLngs = useMemo(() => (
    (lanes ?? [])
      .filter(l => Array.isArray(l.geometry.coordinates) && (l.geometry.coordinates as any[]).length >= 2)
      .map(l => coordsToLatLngs(l.geometry.coordinates))
  ), [lanes]);

  return (
    <div className="card p-3 w-full">
      <MapContainer ref={(m) => { mapRef.current = m; }} center={[37.6568, 27.366] as any} zoom={15} style={{ height: 560, width: '100%' }}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {localPoly && (
          <RLPolygon positions={coordsToLatLngs(localPoly.geometry.coordinates[0])} pathOptions={{ color: '#22c55e', weight: 2, fill: true, fillColor: '#16a34a', fillOpacity: 0.15 }} />
        )}
        {laneLatLngs.map((ll, idx) => (
          <Polyline key={idx} positions={ll} pathOptions={{ color: '#94a3b8', weight: 2, opacity: 0.6 }} />
        ))}
        {/* Coverage shading */}
        {laneState && lanes && lanes.length > 0 && (
          <>
            {lanes.map((ln, idx) => {
              const coords = (ln.geometry as any).coordinates as any[];
              if (!coords || coords.length < 2) return null;
              if (idx < laneState.laneIndex) {
                return <Polyline key={`cov-full-${idx}`} positions={coordsToLatLngs(ln.geometry.coordinates)} pathOptions={{ color: '#10b981', weight: 6, opacity: 0.35 }} />
              }
              if (idx === laneState.laneIndex) {
                const lenM = turf.length(ln as any, { units: 'kilometers' }) * 1000;
                const distKm = Math.max(0, Math.min(lenM, laneState.distM)) / 1000;
                if (distKm <= 0) return null;
                const seg = turf.lineSliceAlong(ln as any, 0, distKm, { units: 'kilometers' });
                const segCoords = (seg as any).geometry.coordinates as any[];
                if (!segCoords || segCoords.length < 2) return null;
                return <Polyline key={`cov-part-${idx}`} positions={coordsToLatLngs(segCoords)} pathOptions={{ color: '#10b981', weight: 6, opacity: 0.5 }} />
              }
              return null;
            })}
          </>
        )}
        {position && (
          <Marker
            icon={L.icon({ iconUrl: '/harvestericon1.png', iconSize: [28, 28], iconAnchor: [14, 14] })}
            position={position as any}
          />
        )}
      </MapContainer>
    </div>
  );
}
