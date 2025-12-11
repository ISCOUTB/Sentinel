/// <reference types="leaflet" />
// src/components/MapView.tsx
import React, { useEffect, useRef, useState, Suspense } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { useQuery } from "@tanstack/react-query";
import { fetchMapData } from "@/api/mapData";
import { Button } from "@/components/ui/button";
import { Map as MapIcon, Layers3 } from "lucide-react";

/* ----------------- Fallback simple (esfera azul) ----------------- */
function BoatFallback() {
  return (
    <mesh>
      <sphereGeometry args={[0.28, 32, 32]} />
      <meshStandardMaterial color="#2563eb" />
    </mesh>
  );
}

/* ----------------- Cargar modelo .glb ----------------- */
function BoatGLB() {
  const { scene } = useGLTF("/boat.glb");

  // Ajustar posición y escala
  scene.scale.set(1.5, 1.5, 1.5);
  scene.position.set(0, -0.2, 0);
  scene.rotation.y = Math.PI / 2;

  // Movimiento flotante
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    scene.position.y = Math.sin(t * 1.5) * 0.05 - 0.2;
  });

  return <primitive object={scene} />;
}

/* ----------------- Componente principal ----------------- */
export default function MapView() {
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const mapRef = useRef<any | null>(null);
  const panStepPx = 120;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mapData"],
    queryFn: fetchMapData,
    refetchInterval: 3000,
  });

  // Movimiento del mapa con animación fluida
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!mapRef.current) return;
      const k = e.key.toLowerCase();
      const step = panStepPx;
      const opts = { animate: true, duration: 0.5, easeLinearity: 0.25 };

      switch (k) {
        case "arrowup":
        case "w":
          e.preventDefault();
          mapRef.current.panBy([0, -step], opts);
          break;
        case "arrowdown":
        case "s":
          e.preventDefault();
          mapRef.current.panBy([0, step], opts);
          break;
        case "arrowleft":
        case "a":
          e.preventDefault();
          mapRef.current.panBy([-step, 0], opts);
          break;
        case "arrowright":
        case "d":
          e.preventDefault();
          mapRef.current.panBy([step, 0], opts);
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-full">
        Cargando mapa...
      </div>
    );
  if (isError || !data)
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Error al cargar datos
      </div>
    );

  // Ubicación base: Cartagena, Colombia
  const baseCoords = { lat: 10.3910, lng: -75.4794 };
  const coordinates = data.coordinates || baseCoords;
  const location = data.location || "Cartagena, Colombia";

  return (
    <div className="relative h-full w-full">
      {/* Controles */}
      <div className="absolute top-4 left-4 z-40 flex gap-2">
        <Button
          variant={viewMode === "3d" ? "default" : "secondary"}
          size="sm"
          onClick={() => setViewMode("3d")}
        >
          <Layers3 className="w-4 h-4" /> 3D
        </Button>
        <Button
          variant={viewMode === "2d" ? "default" : "secondary"}
          size="sm"
          onClick={() => setViewMode("2d")}
        >
          <MapIcon className="w-4 h-4" /> MAPA
        </Button>
      </div>

      {/* Mapa base */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[coordinates.lat, coordinates.lng]}
          zoom={15}
          style={{ width: "100%", height: "100%" }}
          whenCreated={(mapInstance) => {
            mapRef.current = mapInstance;
          }}
          scrollWheelZoom={true}
        >
          <TileLayer
            
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </MapContainer>
      </div>

      {/* Overlay 2D */}
      {viewMode === "2d" && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="bg-black/50 text-white p-3 rounded-md text-center">
            <div className="font-semibold">📍 {location}</div>
            <div className="text-xs">
              Lat: {coordinates.lat.toFixed(4)}, Lng:{" "}
              {coordinates.lng.toFixed(4)}
            </div>
            <div className="text-xs mt-1">
              Usa las flechas para moverte por el mapa.
            </div>
          </div>
        </div>
      )}

      {/* Overlay 3D */}
      {viewMode === "3d" && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
          <div style={{ width: 260, height: 260 }}>
            <Canvas
              shadows
              dpr={[1, 2]}
              style={{ background: "transparent" }}
            >
              <PerspectiveCamera makeDefault position={[0, 2, 5]} />
              <hemisphereLight
                groundColor={0x444444}
                intensity={0.7}
              />
              <ambientLight intensity={0.5} />
              <directionalLight
                castShadow
                position={[5, 10, 5]}
                intensity={1.2}
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
              />
              <Suspense fallback={<BoatFallback />}>
                <BoatGLB />
              </Suspense>
              <OrbitControls
                enablePan={false}
                enableZoom={false}
                enableRotate={false}
              />
            </Canvas>
          </div>
        </div>
      )}
    </div>
  );
}

useGLTF.preload("/boat.glb");
