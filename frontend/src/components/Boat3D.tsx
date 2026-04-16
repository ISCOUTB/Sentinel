import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Boat3DProps {
  /** Ángulo de guiñada en grados (yaw) */
  yaw?: number;
  /** Ángulo de balanceo en grados (roll) */
  roll?: number;
  /** Ángulo de cabeceo en grados (pitch) */
  pitch?: number;
}

const Boat3D = ({ yaw = 0, roll = 0, pitch = 0 }: Boat3DProps) => {
  const boatRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!boatRef.current) return;

    // Aplicar orientación real del IMU (suavizado exponencial para evitar saltos)
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

    // Balanceo oceánico sutil independiente del IMU (efecto visual)
    boatRef.current.position.y = Math.sin(Date.now() * 0.002) * 0.05;
  });

  return (
    <mesh ref={boatRef} scale={[0.5, 0.5, 0.5]}>
      {/* Casco principal */}
      <boxGeometry args={[1, 0.2, 2]} />
      <meshStandardMaterial color="#3B82F6" />

      {/* Cubierta */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.8, 0.2, 1.5]} />
        <meshStandardMaterial color="#1E3A8A" />
      </mesh>

      {/* Antena */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.5]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
    </mesh>
  );
};

export default Boat3D;
