/// <reference types="leaflet" />
// src/components/MapView.tsx
import React, { useEffect, useRef, useState, Suspense } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, useGLTF, Text } from '@react-three/drei';
import * as THREE from 'three';

import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

import { useIoTData } from '@/contexts/IoTContext';
import MissionRoute, { MissionPoint } from './MissionRoute';

// ─── GeoJSON de Agua ──────────────────────────────────────────────────────────
import waterGeoJson from '@/assets/water.json';

// ─── Fix icono de Leaflet en Vite ─────────────────────────────────────────────
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// ─── Fallback 3D ──────────────────────────────────────────────────────────────
function BoatFallback() {
  return (
    <mesh>
      <sphereGeometry args={[0.28, 32, 32]} />
      <meshStandardMaterial color="#2563eb" />
    </mesh>
  );
}

// ─── Ejes X, Y, Z Gruesos ─────────────────────────────────────────────────────
function ThickAxes({ length = 2.5, thickness = 0.06 }) {
  return (
    <group>
      {/* X Axis - Red */}
      <group>
        <mesh position={[length / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[thickness, thickness, length, 8]} />
          <meshBasicMaterial color="red" />
        </mesh>
        <Text position={[length + 0.3, 0, 0]} color="red" fontSize={0.5} outlineWidth={0.02} outlineColor="black">X</Text>
      </group>
      {/* Y Axis - Green */}
      <group>
        <mesh position={[0, length / 2, 0]}>
          <cylinderGeometry args={[thickness, thickness, length, 8]} />
          <meshBasicMaterial color="green" />
        </mesh>
        <Text position={[0, length + 0.3, 0]} color="green" fontSize={0.5} outlineWidth={0.02} outlineColor="black">Y</Text>
      </group>
      {/* Z Axis - Blue */}
      <group>
        <mesh position={[0, 0, length / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[thickness, thickness, length, 8]} />
          <meshBasicMaterial color="blue" />
        </mesh>
        <Text position={[0, 0, length + 0.3]} color="blue" fontSize={0.5} outlineWidth={0.02} outlineColor="black">Z</Text>
      </group>
    </group>
  );
}

// ─── Modelo GLB con orientación real ─────────────────────────────────────────
function BoatGLBOriented({ yaw, roll, pitch }: { yaw: number; roll: number; pitch: number }) {
  const { scene } = useGLTF('/boat.glb');
  const ref = useRef<THREE.Object3D>(scene);

  scene.scale.set(1.5, 1.5, 1.5);
  scene.position.set(0, -0.2, 0);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    ref.current.rotation.y = THREE.MathUtils.lerp(
      ref.current.rotation.y,
      THREE.MathUtils.degToRad(yaw),
      0.08
    );
    ref.current.rotation.x = THREE.MathUtils.lerp(
      ref.current.rotation.x,
      THREE.MathUtils.degToRad(pitch),
      0.08
    );
    ref.current.rotation.z = THREE.MathUtils.lerp(
      ref.current.rotation.z,
      THREE.MathUtils.degToRad(roll),
      0.08
    );
    ref.current.position.y = Math.sin(t * 1.5) * 0.05 - 0.2;
  });

  return (
    <group>
      <primitive object={scene} ref={ref} />
      <ThickAxes />
    </group>
  );
}

// ─── Componente para manejar clicks en el mapa ───────────────────────────────
function MapClickHandler({ 
  isSelectingPoints, 
  onAddPoint 
}: { 
  isSelectingPoints: boolean; 
  onAddPoint?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (isSelectingPoints && onAddPoint) {
        // Turf uses [longitude, latitude]
        const clickedPoint = point([e.latlng.lng, e.latlng.lat]);
        let isWater = false;

        // Check if the point falls inside any polygon in the water GeoJSON
        const features = (waterGeoJson as any).features;
        for (const feature of features) {
          if (booleanPointInPolygon(clickedPoint, feature)) {
            isWater = true;
            break;
          }
        }

        if (isWater) {
          onAddPoint(e.latlng.lat, e.latlng.lng);
        } else {
          // Utilizar un toast o un alert temporal
          alert("Punto inválido: Solo se permite agregar puntos en el agua.");
        }
      }
    },
  });
  return null;
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface MapViewProps {
  missionPoints?: MissionPoint[];
  isSelectingPoints?: boolean;
  onAddPoint?: (lat: number, lng: number) => void;
}

export default function MapView({ 
  missionPoints = [], 
  isSelectingPoints = false,
  onAddPoint 
}: MapViewProps) {
  const mapRef = useRef<any | null>(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const panStepPx = 120;

  // Datos IoT en tiempo real
  const { usvStatus } = useIoTData();

  // Coordenadas GPS reales (fallback a Cartagena si aún no hay datos)
  const BASE_COORDS = { lat: 10.391, lng: -75.4794 };
  const coordinates = usvStatus
    ? { lat: usvStatus.latitud, lng: usvStatus.longitud }
    : BASE_COORDS;

  const location = usvStatus
    ? `${usvStatus.usv_id} — ${usvStatus.actividad.replace(/_/g, ' ')}`
    : 'Cartagena, Colombia';

  const yaw = usvStatus?.yaw_grados ?? 0;
  const roll = usvStatus?.roll_grados ?? 0;
  const pitch = usvStatus?.pitch_grados ?? 0;

  // Centrar mapa cuando cambian las coordenadas GPS
  useEffect(() => {
    if (mapRef.current && usvStatus && !isSelectingPoints) {
      mapRef.current.setView([usvStatus.latitud, usvStatus.longitud], undefined, {
        animate: true,
        duration: 1,
      });
    }
  }, [usvStatus?.latitud, usvStatus?.longitud, isSelectingPoints]);

  // Pan con teclas
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!mapRef.current) return;
      const k = e.key.toLowerCase();
      const step = panStepPx;
      const opts = { animate: true, duration: 0.5, easeLinearity: 0.25 };

      switch (k) {
        case 'arrowup':
        case 'w':
          e.preventDefault();
          mapRef.current.panBy([0, -step], opts);
          break;
        case 'arrowdown':
        case 's':
          e.preventDefault();
          mapRef.current.panBy([0, step], opts);
          break;
        case 'arrowleft':
        case 'a':
          e.preventDefault();
          mapRef.current.panBy([-step, 0], opts);
          break;
        case 'arrowright':
        case 'd':
          e.preventDefault();
          mapRef.current.panBy([step, 0], opts);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`relative h-full w-full rounded-md overflow-hidden border ${isSelectingPoints ? 'cursor-crosshair' : ''}`}>
      {/* ── Overlay 2D info ── */}
      <div className="absolute top-4 left-4 z-[400] pointer-events-none flex flex-col gap-2">
        <div className="bg-black/70 backdrop-blur-sm text-white p-3 rounded-md shadow-lg">
          <div className="font-semibold">📍 {location}</div>
          <div className="text-xs text-gray-200">
            Lat: {coordinates.lat.toFixed(5)}, Lng: {coordinates.lng.toFixed(5)}
          </div>
          {usvStatus && (
            <div className="text-xs text-gray-300 mt-1">
              Roll: {roll.toFixed(1)}° · Pitch: {pitch.toFixed(1)}° · Yaw: {yaw.toFixed(1)}°
            </div>
          )}
        </div>
      </div>
      
      {/* ── Overlay Distancia Total ── */}
      {missionPoints.length > 1 && (
        <div className="absolute top-4 right-4 z-[400] pointer-events-none">
          <div className="bg-blue-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg font-bold border border-blue-400">
            Distancia Total: {totalDistance.toFixed(0)} m
          </div>
        </div>
      )}

      {/* ── Mapa base ── */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[coordinates.lat, coordinates.lng]}
          zoom={15}
          style={{ width: '100%', height: '100%', cursor: isSelectingPoints ? 'crosshair' : 'grab' }}
          ref={mapRef}
          scrollWheelZoom={true}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {/* Capa Visual del Agua */}
          <GeoJSON 
            data={waterGeoJson as any} 
            style={{ 
              fillColor: '#3b82f6', 
              color: '#1d4ed8', 
              weight: 1, 
              fillOpacity: 0.15,
              interactive: false // So it doesn't block map clicks
            }} 
          />

          <MapClickHandler isSelectingPoints={isSelectingPoints} onAddPoint={onAddPoint} />

          {/* Marcador de posición real del USV */}
          {usvStatus && (
            <Marker
              position={[usvStatus.latitud, usvStatus.longitud]}
              icon={defaultIcon}
            >
              <Popup>
                <strong>{usvStatus.usv_id}</strong>
                <br />
                Lat: {usvStatus.latitud.toFixed(5)}
                <br />
                Lng: {usvStatus.longitud.toFixed(5)}
                <br />
                Yaw: {usvStatus.yaw_grados.toFixed(1)}°
              </Popup>
            </Marker>
          )}

          {/* Componente Modular de Puntos y Ruta de la Misión */}
          <MissionRoute missionPoints={missionPoints} onTotalDistanceChange={setTotalDistance} />

        </MapContainer>
      </div>

      {/* ── Overlay 3D Esquina Inferior Derecha ── */}
      <div className="absolute bottom-4 right-4 z-[400] w-48 h-48 bg-black/20 backdrop-blur-sm rounded-full overflow-hidden border-2 border-white/20 shadow-xl pointer-events-auto cursor-grab active:cursor-grabbing">
        <Canvas shadows dpr={[1, 2]} style={{ background: 'transparent' }}>
          <PerspectiveCamera makeDefault position={[0, 4, 8]} />
          <hemisphereLight groundColor={0x444444} intensity={0.7} />
          <ambientLight intensity={0.5} />
          <directionalLight
            castShadow
            position={[5, 10, 5]}
            intensity={1.2}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <Suspense fallback={<BoatFallback />}>
            <BoatGLBOriented yaw={yaw} roll={roll} pitch={pitch} />
          </Suspense>
          <OrbitControls enablePan={false} enableZoom={true} />
        </Canvas>
      </div>
    </div>
  );
}

useGLTF.preload('/boat.glb');
export type { MissionPoint } from './MissionRoute';