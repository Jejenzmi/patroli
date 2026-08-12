import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ago } from '../lib/format';

/** Penanda kustom berbasis HTML agar seragam dengan tema gelap. */
function pin(color: string, glyph: string, pulse = false) {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;display:grid;place-items:center;width:30px;height:30px">
      ${pulse ? `<span style="position:absolute;inset:0;border-radius:9999px;border:2px solid ${color};animation:pulseRing 2s cubic-bezier(.4,0,.6,1) infinite"></span>` : ''}
      <span style="display:grid;place-items:center;width:24px;height:24px;border-radius:9px;background:#111726;border:1.5px solid ${color};color:${color};font:700 10px/1 'JetBrains Mono',monospace;box-shadow:0 0 12px ${color}55">${glyph}</span>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const ICON_SITE = pin('#FFB020', 'S');
const ICON_CP = pin('#7A8AA6', '•');
const ICON_CP_DONE = pin('#34D399', '✓');
const ICON_GUARD = pin('#22D3EE', 'G', true);
const ICON_PANIC = pin('#FF5A5A', '!', true);

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17 });
  }, [JSON.stringify(points)]);
  return null;
}

export interface MapSite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM?: number;
  checkpoints?: { id: string; name: string; code?: string; lat: number; lng: number; radiusM?: number }[];
}

export interface MapGuard {
  guardId: string;
  name: string;
  lat: number;
  lng: number;
  at?: string;
  batteryPct?: number | null;
}

export default function MapView({
  sites = [],
  guards = [],
  panics = [],
  track = [],
  scannedIds = [],
  height = 460,
  zoom,
  center,
}: {
  sites?: MapSite[];
  guards?: MapGuard[];
  panics?: any[];
  track?: [number, number][];
  scannedIds?: string[];
  height?: number | string;
  zoom?: number;
  center?: [number, number];
}) {
  const points = useMemo(() => {
    const p: [number, number][] = [];
    sites.forEach((s) => {
      p.push([s.lat, s.lng]);
      s.checkpoints?.forEach((c) => p.push([c.lat, c.lng]));
    });
    guards.forEach((g) => p.push([g.lat, g.lng]));
    track.forEach((t) => p.push(t));
    return p;
  }, [sites, guards, track]);

  const scanned = new Set(scannedIds);
  const fallback: [number, number] = center || (points[0] ?? [-6.2, 106.9]);

  return (
    <div className="overflow-hidden rounded-2xl border border-line" style={{ height }}>
      <MapContainer
        center={fallback}
        zoom={zoom ?? 13}
        className="map-dark h-full w-full"
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />
        <FitBounds points={points} />

        {sites.map((s) => (
          <React.Fragment key={s.id}>
            <Circle
              center={[s.lat, s.lng]}
              radius={s.radiusM || 200}
              pathOptions={{ color: '#FFB020', weight: 1, fillColor: '#FFB020', fillOpacity: 0.05, dashArray: '5 6' }}
            />
            <Marker position={[s.lat, s.lng]} icon={ICON_SITE}>
              <Popup>
                <b>{s.name}</b>
                <br />
                <span style={{ fontSize: 11 }}>Radius geofence {s.radiusM || 200} m</span>
              </Popup>
            </Marker>
            {s.checkpoints?.map((c) => (
              <Marker key={c.id} position={[c.lat, c.lng]} icon={scanned.has(c.id) ? ICON_CP_DONE : ICON_CP}>
                <Popup>
                  <b>{c.name}</b>
                  <br />
                  <span style={{ fontSize: 11 }}>{c.code}</span>
                  {scanned.has(c.id) && <div style={{ color: '#34D399', fontSize: 11 }}>Sudah dipindai</div>}
                </Popup>
              </Marker>
            ))}
          </React.Fragment>
        ))}

        {track.length > 1 && (
          <Polyline positions={track} pathOptions={{ color: '#22D3EE', weight: 3, opacity: 0.75 }} />
        )}

        {guards.map((g) => (
          <Marker key={g.guardId} position={[g.lat, g.lng]} icon={ICON_GUARD}>
            <Popup>
              <b>{g.name}</b>
              <br />
              <span style={{ fontSize: 11 }}>Posisi {ago(g.at)}</span>
              {g.batteryPct != null && <div style={{ fontSize: 11 }}>Baterai {g.batteryPct}%</div>}
            </Popup>
          </Marker>
        ))}

        {panics
          .filter((p) => p.lat && p.lng)
          .map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={ICON_PANIC}>
              <Popup>
                <b style={{ color: '#FF5A5A' }}>SINYAL DARURAT</b>
                <br />
                {p.guard?.name} — {p.site?.name}
                <br />
                <span style={{ fontSize: 11 }}>{ago(p.createdAt)}</span>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
