import React, { useMemo } from 'react';
import { Marker, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { isValidCoord, isLatLngValid } from '@/utils/validators';

const createCustomIcon = (color: string) => L.divIcon({
  className: 'custom-pin-wrapper',
  html: `<div class="custom-pin" style="background-color: ${color};"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24]
});

const startIcon = createCustomIcon('#22c55e'); // Green
const endIcon = createCustomIcon('#ef4444'); // Red
const midIcon = createCustomIcon('#3b82f6'); // Blue

const invisibleIcon = L.divIcon({
  className: 'invisible-icon',
  html: '',
  iconSize: [0, 0]
});

export type MissionPoint = { lat: number; lng: number };

interface MissionRouteProps {
  missionPoints: MissionPoint[];
  onTotalDistanceChange?: (dist: number) => void;
  currentWaypointIndex?: number;
}

export default function MissionRoute({ 
  missionPoints, 
  onTotalDistanceChange,
  currentWaypointIndex = 0 
}: MissionRouteProps) {
  const validPoints = useMemo(() => 
    missionPoints.filter(p => isLatLngValid(p.lat, p.lng)),
    [missionPoints]
  );
  
  const routeData = useMemo(() => {
    let totalDist = 0;
    const segments = [];
    
    for (let i = 0; i < validPoints.length - 1; i++) {
      const p1 = validPoints[i];
      const p2 = validPoints[i + 1];
      
      const ll1 = L.latLng(p1.lat, p1.lng);
      const ll2 = L.latLng(p2.lat, p2.lng);
      
      const dist = ll1.distanceTo(ll2);
      totalDist += dist;
      
      const midLat = (p1.lat + p2.lat) / 2;
      const midLng = (p1.lng + p2.lng) / 2;
      
      segments.push({
        start: p1,
        end: p2,
        midpoint: { lat: midLat, lng: midLng },
        distance: dist,
        isCompleted: i < currentWaypointIndex - 1
      });
    }

    return { totalDist, segments };
  }, [validPoints, currentWaypointIndex]);

  React.useEffect(() => {
    if (onTotalDistanceChange) {
      onTotalDistanceChange(routeData.totalDist);
    }
  }, [routeData.totalDist, onTotalDistanceChange]);

  if (validPoints.length === 0) return null;

  return (
    <>
      {/* Trazado de ruta con colores según progreso */}
      {routeData.segments.map((segment, index) => (
        <Polyline 
          key={`segment-line-${index}`}
          positions={[[segment.start.lat, segment.start.lng], [segment.end.lat, segment.end.lng]]} 
          color={segment.isCompleted ? "#94a3b8" : "#3b82f6"} // Gray for completed, Blue for remaining
          weight={5} 
          dashArray={segment.isCompleted ? "" : "8, 8"} 
          opacity={segment.isCompleted ? 0.6 : 1}
        />
      ))}
      
      {validPoints.map((point, index) => {
        let label = `Punto ${index + 1}`;
        let icon = midIcon;

        const isCompleted = index < currentWaypointIndex;
        const isNext = index === currentWaypointIndex;

        if (index === 0) {
          label = "Inicio";
          icon = startIcon;
        } else if (index === validPoints.length - 1 && validPoints.length > 1) {
          label = "Final";
          icon = endIcon;
        }
        
        // Icono especial para el punto actual/siguiente si se desea
        const finalIcon = isNext ? L.divIcon({
          className: 'custom-pin-wrapper active-waypoint',
          html: `<div class="custom-pin animate-pulse" style="background-color: #f59e0b; scale: 1.2; border: 2px solid white;"></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28]
        }) : icon;

        return (
          <Marker 
            key={`point-${index}`} 
            position={[point.lat, point.lng]} 
            icon={finalIcon}
            opacity={isCompleted && !isNext ? 0.5 : 1}
          >
            <Tooltip permanent direction="bottom" offset={[0, 4]} className={`custom-waypoint-tooltip ${isNext ? 'font-bold text-amber-600' : ''}`}>
              {label} {isNext ? "(Siguiente)" : ""}
            </Tooltip>
          </Marker>
        );
      })}

      {routeData.segments.map((segment, index) => (
        isValidCoord(segment.midpoint.lat) && isValidCoord(segment.midpoint.lng) && (
          <Marker 
            key={`segment-${index}`} 
            position={[segment.midpoint.lat, segment.midpoint.lng]} 
            icon={invisibleIcon}
          >
            <Tooltip permanent direction="center" className="custom-distance-tooltip">
              {isValidCoord(segment.distance) ? segment.distance.toFixed(0) : '0'} m
            </Tooltip>
          </Marker>
        )
      ))}
    </>
  );
}
