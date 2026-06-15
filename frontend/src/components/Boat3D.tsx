// ─────────────────────────────────────────────────────────────────────────────
// Sentinel HMI — Boat3D (Procedural Render)
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Boat3DProps {
  /** Ángulo de guiñada en grados (yaw) proveniente del IMU */
  yaw?: number;
  /** Ángulo de balanceo en grados (roll) proveniente del IMU */
  roll?: number;
  /** Ángulo de cabeceo en grados (pitch) proveniente del IMU */
  pitch?: number;
}

/**
 * Renderizador procedimental 3D del vehículo USV.
 * 
 * Utiliza mallas básicas de Three.js (box, cylinder) y aplica interpolación lineal (`lerp`)
 * en cada cuadro de animación (useFrame) para suavizar los cambios angulares de orientación
 * reportados por la telemetría del IMU. Asimismo, agrega una oscilación sinusoidal vertical sutil
 * para simular el balanceo sobre el agua.
 */
const Boat3D = ({ yaw = 0, roll = 0, pitch = 0 }: Boat3DProps) => {
  const boatRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!boatRef.current) return;

    // Aplicar orientación real del IMU (suavizado exponencial para evitar saltos bruscos en la UI)
    const targetY = THREE.MathUtils.degToRad(yaw);
    const targetX = THREE.MathUtils.degToRad(pitch);
    const targetZ = THREE.MathUtils.degToRad(roll);

    boatRef.current.rotation.y = THREE.MathUtils.lerp(
      boatRef.current.rotation.y,
      targetY,
      0.08
    );
    boatRef.current.rotation.x = THREE.MathUtils.lerp(
      boatRef.current.rotation.x,
      targetX,
      0.08
    );
    boatRef.current.rotation.z = THREE.MathUtils.lerp(
      boatRef.current.rotation.z,
      targetZ,
      0.08
    );

    // Balanceo oceánico sutil independiente del IMU (efecto estético de flotación)
    boatRef.current.position.y = Math.sin(Date.now() * 0.002) * 0.05;
  });

  return (
    <mesh ref={boatRef} scale={[0.5, 0.5, 0.5]}>
      {/* Casco principal del bote */}
      <boxGeometry args={[1, 0.2, 2]} />
      <meshStandardMaterial color="#3B82F6" />

      {/* Cubierta/Cabina */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.8, 0.2, 1.5]} />
        <meshStandardMaterial color="#1E3A8A" />
      </mesh>

      {/* Antena del GPS/Transceptor */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.5]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
    </mesh>
  );
};

export default Boat3D;
