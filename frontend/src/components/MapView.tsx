/// <reference types="leaflet" />
// src/components/MapView.tsx
import React, { useEffect, useRef, useState, Suspense } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

import { Button } from '@/components/ui/button';
import { Map as MapIcon, Layers3 } from 'lucide-react';

import { useIoTData } from '@/contexts/IoTContext';
import Boat3D from './Boat3D';

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

  return <primitive object={scene} ref={ref} />;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MapView() {
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const mapRef = useRef<any | null>(null);
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
    if (mapRef.current && usvStatus) {
      mapRef.current.setView([usvStatus.latitud, usvStatus.longitud], undefined, {
        animate: true,
        duration: 1,
      });
    }
  }, [usvStatus?.latitud, usvStatus?.longitud]);

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
    <div className="relative h-full w-full">
      {/* ── Controles modo ── */}
      <div className="absolute top-4 left-4 z-40 flex gap-2">
        <Button
          variant={viewMode === '3d' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setViewMode('3d')}
        >
          <Layers3 className="w-4 h-4" /> 3D
        </Button>
        <Button
          variant={viewMode === '2d' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setViewMode('2d')}
        >
          <MapIcon className="w-4 h-4" /> MAPA
        </Button>
      </div>

      {/* ── Mapa base ── */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[coordinates.lat, coordinates.lng]}
          zoom={15}
          style={{ width: '100%', height: '100%' }}
          ref={mapRef}
          scrollWheelZoom={true}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

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
        </MapContainer>
      </div>

      {/* ── Overlay 2D info ── */}
      {viewMode === '2d' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-end justify-start p-4">
          <div className="bg-black/60 text-white p-3 rounded-md text-center">
            <div className="font-semibold">📍 {location}</div>
            <div className="text-xs">
              Lat: {coordinates.lat.toFixed(5)}, Lng: {coordinates.lng.toFixed(5)}
            </div>
            {usvStatus && (
              <div className="text-xs mt-1">
                Roll: {roll.toFixed(1)}° · Pitch: {pitch.toFixed(1)}° · Yaw: {yaw.toFixed(1)}°
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Overlay 3D ── */}
      {viewMode === '3d' && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
          <div style={{ width: 280, height: 280 }}>
            <Canvas shadows dpr={[1, 2]} style={{ background: 'transparent' }}>
              <PerspectiveCamera makeDefault position={[0, 2, 5]} />
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
              <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
            </Canvas>
          </div>
        </div>
      )}
    </div>
  );
}

useGLTF.preload('/boat.glb');