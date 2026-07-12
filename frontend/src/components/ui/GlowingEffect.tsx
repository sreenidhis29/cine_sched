import React, { useRef, useState } from 'react';

interface GlowingEffectProps {
  spread?: number;
  glow?: boolean;
  disabled?: boolean;
  proximity?: number;
  inactiveZone?: number;
}

export function GlowingEffect({
  spread = 40,
  glow = true,
  disabled = false,
  proximity = 64,
  inactiveZone = 0.01,
}: GlowingEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (disabled || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="absolute inset-0 pointer-events-none rounded-inherit z-0 overflow-hidden"
    >
      {glow && isHovered && !disabled && (
        <div
          className="absolute rounded-full transition-opacity duration-300 opacity-60 pointer-events-none"
          style={{
            width: `${spread * 4}px`,
            height: `${spread * 4}px`,
            background: 'radial-gradient(circle, rgba(255,184,0,0.15) 0%, rgba(255,184,0,0) 70%)',
            left: `${coords.x - spread * 2}px`,
            top: `${coords.y - spread * 2}px`,
          }}
        />
      )}
      <div
        className="absolute inset-0 rounded-inherit border border-outline-variant/30 transition-colors duration-300"
      />
    </div>
  );
}
