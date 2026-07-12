'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// Create a custom numbered SVG icon for Leaflet
const createNumberedIcon = (num: number) => L.divIcon({
  html: `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="position: absolute; top: 0; left: 0;">
        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" 
              fill="#ffb800" 
              stroke="#131313" 
              stroke-width="1.5"
              style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));"
        />
      </svg>
      <span style="position: relative; z-index: 10; font-size: 11px; font-weight: 800; color: #271900; margin-bottom: 5px; font-family: sans-serif;">
        ${num}
      </span>
    </div>
  `,
  className: 'custom-numbered-leaflet-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// Component to dynamically fit bounds of the map to current route segments
function RouteBoundsFitter({ segments }: { segments: any[] }) {
  const map = useMap();

  useEffect(() => {
    if (segments && segments.length > 0) {
      const allCoords: [number, number][] = [];
      segments.forEach(seg => {
        if (seg.polyline && seg.polyline.length > 0) {
          seg.polyline.forEach((coord: [number, number]) => {
            allCoords.push(coord);
          });
        }
      });

      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords);
        map.invalidateSize();
        map.fitBounds(bounds, { padding: [50, 50], animate: false });
      }
    }
  }, [segments, map]);

  return null;
}

interface RoutePlanMapProps {
  stops: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    cost_per_day?: number;
  }[];
  segments: {
    from_location_id: string;
    to_location_id: string;
    polyline: [number, number][];
  }[];
}

export default function RoutePlanMap({ stops, segments }: RoutePlanMapProps) {
  const defaultCenter: [number, number] = [34.0928, -118.3287];

  return (
    <div className="w-full h-full relative bg-surface-container-lowest">
      <MapContainer
        center={stops.length > 0 ? [stops[0].latitude, stops[0].longitude] : defaultCenter}
        zoom={12}
        className="w-full h-full z-10"
        style={{ background: '#131313' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* Draw Polylines between consecutive stops */}
        {segments.map((seg, idx) => (
          <Polyline
            key={`seg-${idx}`}
            positions={seg.polyline}
            color="#ffb800"
            weight={4.5}
            opacity={0.85}
          />
        ))}
        
        {/* Draw Numbered Markers */}
        {stops.map((stop, idx) => (
          <Marker
            key={stop.id}
            position={[stop.latitude, stop.longitude]}
            icon={createNumberedIcon(idx + 1)}
          >
            <Popup className="custom-dark-popup">
              <div className="p-1 font-body-md text-sm text-[#e4e2e1]">
                <h3 className="font-bold text-primary-container font-headline-md text-base mb-1">
                  Stop {idx + 1}: {stop.name}
                </h3>
                <p className="text-on-surface-variant text-xs mb-2">
                  Cost Per Day: <span className="font-mono-data text-primary font-bold">${stop.cost_per_day?.toLocaleString() || '0'}</span>
                </p>
                <div className="pt-2 border-t border-outline-variant/20">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary-container font-bold hover:underline"
                  >
                    <span className="material-symbols-outlined text-[14px]">map</span>
                    Open in Google Maps
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <RouteBoundsFitter segments={segments} />
      </MapContainer>
    </div>
  );
}
