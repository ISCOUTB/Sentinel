import React, { useMemo } from 'react';
import { Marker, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';

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
}

export default function MissionRoute({ missionPoints, onTotalDistanceChange }: MissionRouteProps) {
  
  const routeData = useMemo(() => {
    let totalDist = 0;
    const segments = [];
    
    for (let i = 0; i < missionPoints.length - 1; i++) {
      const p1 = missionPoints[i];
      const p2 = missionPoints[i + 1];
      
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
        distance: dist
      });
    }

    return { totalDist, segments };
  }, [missionPoints]);

  React.useEffect(() => {
    if (onTotalDistanceChange) {
      onTotalDistanceChange(routeData.totalDist);
    }
  }, [routeData.totalDist, onTotalDistanceChange]);

  if (missionPoints.length === 0) return null;

  return (
    <>
      <Polyline 
        positions={missionPoints.map(p => [p.lat, p.lng])} 
        color="#3b82f6" 
        weight={5} 
        dashArray="8, 8" 
      />
      
      {missionPoints.map((point, index) => {
        let label = `Punto ${index + 1}`;
        let icon = midIcon;

        if (index === 0) {
          label = "Inicio";
          icon = startIcon;
        } else if (index === missionPoints.length - 1 && missionPoints.length > 1) {
          label = "Final";
          icon = endIcon;
        }
        
        return (
          <Marker 
            key={`point-${index}`} 
            position={[point.lat, point.lng]} 
            icon={icon}
          >
            <Tooltip permanent direction="bottom" offset={[0, 4]} className="custom-waypoint-tooltip">
              {label}
            </Tooltip>
          </Marker>
        );
      })}

      {routeData.segments.map((segment, index) => (
        <Marker 
          key={`segment-${index}`} 
          position={[segment.midpoint.lat, segment.midpoint.lng]} 
          icon={invisibleIcon}
        >
          <Tooltip permanent direction="center" className="custom-distance-tooltip">
            {segment.distance.toFixed(0)} m
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
