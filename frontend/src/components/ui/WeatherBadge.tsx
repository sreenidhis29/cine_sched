/**
 * WeatherBadge — Phase 4 component
 *
 * Displays a weather risk indicator for a shoot day in the schedule view.
 * Shows a warning badge for high-risk days (heavy rain, thunderstorms, snow)
 * and a clear indicator for safe days.
 *
 * Props:
 *   date            - ISO date string of the shoot day (e.g. "2024-07-15")
 *   precipMm        - Precipitation sum in mm
 *   weatherCode     - WMO weather code (0=clear, 65=heavy rain, 95=thunderstorm, etc.)
 *   windSpeedKmh    - Max wind speed in km/h
 *   isHighRisk      - Pre-computed risk flag from weather_client
 *   compact         - If true, renders icon-only (no text), used in tight calendar cells
 */

'use client';

import React, { useState } from 'react';

interface WeatherBadgeProps {
  date?: string;
  precipMm?: number;
  weatherCode?: number;
  windSpeedKmh?: number;
  isHighRisk?: boolean;
  compact?: boolean;
  className?: string;
}

// WMO weather code → short label
const WMO_LABELS: Record<number, string> = {
  0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Violent showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm+hail', 99: 'Thunderstorm+heavy hail',
};

function getWeatherEmoji(code: number, isHighRisk: boolean): string {
  if (code === 0 || code === 1) return '☀️';
  if (code === 2 || code === 3) return '⛅';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 85 && code <= 86) return '🌨️';
  if (code >= 95) return '⛈️';
  return isHighRisk ? '⚠️' : '🌤️';
}

export function WeatherBadge({
  date,
  precipMm = 0,
  weatherCode = 0,
  windSpeedKmh = 0,
  isHighRisk = false,
  compact = false,
  className = '',
}: WeatherBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const emoji = getWeatherEmoji(weatherCode, isHighRisk);
  const label = WMO_LABELS[weatherCode] || 'Unknown';

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: compact ? '2px 6px' : '3px 8px',
    borderRadius: '12px',
    fontSize: compact ? '11px' : '12px',
    fontWeight: 500,
    cursor: 'default',
    position: 'relative',
    userSelect: 'none',
    transition: 'all 0.15s ease',
    border: '1px solid',
  };

  const riskStyle: React.CSSProperties = isHighRisk
    ? {
        backgroundColor: 'rgba(234, 88, 12, 0.15)',  // orange-600 at 15%
        borderColor: 'rgba(234, 88, 12, 0.4)',
        color: '#ea580c',
      }
    : {
        backgroundColor: 'rgba(22, 163, 74, 0.12)',  // green-600 at 12%
        borderColor: 'rgba(22, 163, 74, 0.3)',
        color: '#16a34a',
      };

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#1e1e2e',
    color: '#cdd6f4',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '12px',
    lineHeight: '1.5',
    whiteSpace: 'nowrap',
    zIndex: 1000,
    border: '1px solid rgba(205, 214, 244, 0.1)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    pointerEvents: 'none',
  };

  return (
    <span
      id={`weather-badge-${date || 'unknown'}`}
      style={{ ...baseStyle, ...riskStyle }}
      className={className}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title=""
    >
      <span role="img" aria-label={label}>{emoji}</span>
      {!compact && (
        <span>{isHighRisk ? label : 'Clear'}</span>
      )}

      {showTooltip && (
        <span style={tooltipStyle} role="tooltip">
          <strong>{label}</strong>
          {date && <><br />{date}</>}
          {precipMm > 0 && <><br />🌧 {precipMm.toFixed(1)} mm precipitation</>}
          {windSpeedKmh > 0 && <><br />💨 {windSpeedKmh.toFixed(0)} km/h wind</>}
          {isHighRisk && (
            <>
              <br />
              <span style={{ color: '#f38ba8' }}>
                ⚠️ High risk for exterior shoots
              </span>
            </>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * WeatherForecastStrip — shows a row of WeatherBadge for multiple shoot days.
 * Used at the top of the schedule view to give a quick weather overview.
 */
interface DayForecast {
  shoot_day: number;
  date: string;
  weather_code: number;
  precipitation_sum_mm: number;
  wind_speed_max_kmh: number;
  is_high_risk: boolean;
}

interface WeatherForecastStripProps {
  dayForecasts: Record<string, DayForecast>;  // shoot_day (string) -> forecast
}

export function WeatherForecastStrip({ dayForecasts }: WeatherForecastStripProps) {
  if (!dayForecasts || Object.keys(dayForecasts).length === 0) return null;

  const days = Object.entries(dayForecasts)
    .map(([day, fc]) => ({ day: parseInt(day), ...fc }))
    .sort((a, b) => a.day - b.day);

  const highRiskCount = days.filter(d => d.is_high_risk).length;

  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-4 mb-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-headline-sm text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">cloud</span> Weather Forecast
        </span>
        {highRiskCount > 0 && (
          <span className="bg-error-container/20 text-error-container px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-error-container/30">
            {highRiskCount} high-risk day{highRiskCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="flex gap-3 flex-wrap">
        {days.map(d => (
          <div key={d.day} className="text-center bg-surface-container p-2 rounded-xl border border-outline-variant/20 min-w-[60px]">
            <div className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">
              Day {d.day}
            </div>
            <WeatherBadge
              date={d.date}
              precipMm={d.precipitation_sum_mm}
              weatherCode={d.weather_code}
              windSpeedKmh={d.wind_speed_max_kmh}
              isHighRisk={d.is_high_risk}
              compact
            />
          </div>
        ))}
      </div>
    </div>
  );
}
