import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Boat3DProps {
  rotation?: number;
}

const Boat3D = ({ rotation = 0 }: Boat3DProps) => {
  const boatRef = useRef<THREE.Mesh>(null);

  // Animación suave en cada frame
  useFrame(() => {
    if (boatRef.current) {
      boatRef.current.rotation.y = THREE.MathUtils.degToRad(rotation);
      boatRef.current.position.y = Math.sin(Date.now() * 0.002) * 0.1; // pequeño balanceo
    }
  });

  return (
    <mesh ref={boatRef} scale={[0.5, 0.5, 0.5]}>
      {/* Barco simple hecho de primitivas 3D */}
      <boxGeometry args={[1, 0.2, 2]} />
      <meshStandardMaterial color="#3B82F6" />
      {/* Cubierta */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.8, 0.2, 1.5]} />
        <meshStandardMaterial color="#1E3A8A" />
      </mesh>
      {/* “Antena” */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.5]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
    </mesh>
  );
};

export default Boat3D;
