'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Create a custom SVG icon for Leaflet using the app's tungsten-amber accent color
const customTungstenIcon = L.divIcon({
  html: `
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" 
            fill="#ffb800" 
            stroke="#131313" 
            stroke-width="1.5"
            style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));"
      />
    </svg>
  `,
  className: 'custom-tungsten-leaflet-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

// Component to dynamically fit bounds of the map to current markers
function MapBoundsFitter({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates);
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: false });
    }
  }, [coordinates, map]);

  return null;
}

interface LocationMapViewProps {
  locations: {
    id: string;
    name: string;
    cost_per_day?: number;
    latitude?: number;
    longitude?: number;
  }[];
}

export default function LocationMapView({ locations }: LocationMapViewProps) {
  // Filter out locations with null latitude or longitude
  const mappedLocations = locations.filter(
    (loc) => loc.latitude !== null && loc.longitude !== null && loc.latitude !== undefined && loc.longitude !== undefined
  );

  const coordinates = mappedLocations.map(
    (loc) => [loc.latitude!, loc.longitude!] as [number, number]
  );

  // Default center if no coordinates are available (e.g. Hollywood, CA)
  const defaultCenter: [number, number] = [34.0928, -118.3287];

  return (
    <div className="w-full h-[500px] rounded-xl border border-outline-variant/30 overflow-hidden relative shadow-2xl bg-surface-container-lowest">
      <MapContainer
        center={coordinates.length > 0 ? coordinates[0] : defaultCenter}
        zoom={12}
        className="w-full h-full z-10"
        style={{ background: '#131313' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        {mappedLocations.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.latitude!, loc.longitude!]}
            icon={customTungstenIcon}
          >
            <Popup className="custom-dark-popup">
              <div className="p-1 font-body-md text-sm text-[#e4e2e1]">
                <h3 className="font-bold text-primary-container font-headline-md text-base mb-1">
                  {loc.name}
                </h3>
                <p className="text-on-surface-variant text-xs mb-2">
                  Cost Per Day: <span className="font-mono-data text-primary font-bold">${loc.cost_per_day?.toLocaleString() || '0'}</span>
                </p>
                <div className="pt-2 border-t border-outline-variant/20">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
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

        <MapBoundsFitter coordinates={coordinates} />
      </MapContainer>
    </div>
  );
}
