import "leaflet";
// src/components/MapView.tsx
import React, { useEffect, useRef, useState, Suspense } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, useGLTF, Text } from '@react-three/drei';
import * as THREE from 'three';

import { useIoTData } from '@/contexts/IoTContext';
import MissionRoute, { MissionPoint } from './MissionRoute';
import { toast } from 'sonner';
import { isValidCoord, isLatLngValid } from '@/utils/validators';

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

// ─── Función para validar el color del píxel del mapa ────────────────────────
function checkWaterColor(lat: number, lng: number, zoom: number): Promise<boolean> {
  return new Promise((resolve) => {
    // 1. Matemáticas para convertir lat/lng a coordenadas de Tile de OSM
    const x = (lng + 180) / 360 * Math.pow(2, zoom);
    const y = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom);

    const tileX = Math.floor(x);
    const tileY = Math.floor(y);

    // 2. Píxel exacto dentro del tile de 256x256
    const pixelX = Math.floor((x - tileX) * 256);
    const pixelY = Math.floor((y - tileY) * 256);

    // 3. Cargar la imagen del Tile de OSM (usando un subdominio genérico 'a')
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = `https://a.tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(false);
        return;
      }
      ctx.drawImage(img, 0, 0);

      // 4. Obtener el color del píxel clickeado
      const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];

      // 5. Validar si el color corresponde a los tonos de agua de OSM
      // El agua en OSM típicamente es R:170, G:211, B:223 (varía un poco según la capa)
      // Ajuste de tolerancias:
      const isWater = r >= 150 && r <= 190 &&
        g >= 190 && g <= 230 &&
        b >= 200 && b <= 245;

      resolve(isWater);
    };

    img.onerror = () => {
      console.error("No se pudo cargar el tile para la validación de color.");
      resolve(false); // Falla segura, no permite poner el punto
    };
  });
}

// ─── Componente para manejar clicks en el mapa ───────────────────────────────
function MapClickHandler({
  isSelectingPoints,
  onAddPoint
}: {
  isSelectingPoints: boolean;
  onAddPoint?: (lat: number, lng: number) => void;
}) {
  const map = useMapEvents({
    async click(e) {
      if (isSelectingPoints && onAddPoint) {
        const zoom = map.getZoom();

        // Ejecutamos la validación visual de color
        const isWater = await checkWaterColor(e.latlng.lat, e.latlng.lng, zoom);

        if (isWater) {
          onAddPoint(e.latlng.lat, e.latlng.lng);
        } else {
          toast.error("Punto inválido: Solo se permite agregar puntos en el agua.");
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
  const coordinates = usvStatus && isLatLngValid(usvStatus.latitud, usvStatus.longitud)
    ? { lat: usvStatus.latitud, lng: usvStatus.longitud }
    : BASE_COORDS;

  const popupText = usvStatus
    ? `${usvStatus.usv_id} — ${usvStatus.actividad?.replace(/_/g, ' ') || 'N/A'}`
    : 'USV Desconectado';

  const yaw = isValidCoord(usvStatus?.yaw_grados) ? usvStatus!.yaw_grados : 0;
  const roll = isValidCoord(usvStatus?.roll_grados) ? usvStatus!.roll_grados : 0;
  const pitch = isValidCoord(usvStatus?.pitch_grados) ? usvStatus!.pitch_grados : 0;

  // Auto-centrado deshabilitado para evitar que mueva la vista al usuario

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
          <div className="font-semibold">📍 {popupText}</div>
          <div className="text-xs text-slate-200 font-mono mt-1">
            Lat: {coordinates.lat?.toFixed(5) ?? 0}, Lng: {coordinates.lng?.toFixed(5) ?? 0}
          </div>
          {usvStatus && (
            <div className="text-xs text-slate-300 font-mono mt-1">
              Roll: {usvStatus.roll_grados?.toFixed(1) ?? 0}° · Pitch: {usvStatus.pitch_grados?.toFixed(1) ?? 0}° · Yaw: {usvStatus.yaw_grados?.toFixed(1) ?? 0}°
            </div>
          )}
        </div>
      </div>

      {/* ── Overlay Distancia Total ── */}
      {missionPoints.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[10] pointer-events-none">
          <div className="bg-blue-600/90 backdrop-blur-sm text-white px-6 py-2 rounded-full shadow-lg font-bold border-2 border-white/50 flex items-center justify-between text-sm">
            <span>Ruta ({missionPoints.length} puntos)</span>
            <span className="font-mono text-blue-100 ml-2">
              Distancia Total: {totalDistance?.toFixed(0) ?? 0} m
            </span>
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

          <MapClickHandler isSelectingPoints={isSelectingPoints} onAddPoint={onAddPoint} />

          {/* Marcador de posición real del USV */}
          {usvStatus && isValidCoord(usvStatus.latitud) && isValidCoord(usvStatus.longitud) && (
            <Marker
              position={[usvStatus.latitud, usvStatus.longitud]}
              icon={defaultIcon}
            >
              <Popup>
                <div className="text-xs font-mono text-muted-foreground flex flex-col gap-1">
                  <span>Lat: {usvStatus.latitud?.toFixed(5) ?? 0}</span>
                  <span>Lng: {usvStatus.longitud?.toFixed(5) ?? 0}</span>
                  <span>Yaw: {usvStatus.yaw_grados?.toFixed(1) ?? 0}°</span>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Línea punteada desde el USV al primer punto de la misión */}
          {missionPoints.length > 0 && isValidCoord(coordinates.lat) && isValidCoord(coordinates.lng) && (
            <Polyline
              positions={[
                [coordinates.lat, coordinates.lng],
                [missionPoints[0].lat, missionPoints[0].lng]
              ]}
              color="#64748b"
              dashArray="5, 10"
              weight={2}
            />
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