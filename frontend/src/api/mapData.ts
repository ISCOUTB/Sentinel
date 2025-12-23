// src/api/mapData.ts
export async function fetchMapData() {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return {
    location: "Cartagena, Colombia",
    mode: Math.random() > 0.5 ? "2d" : "3d",
    coordinates: { lat: 10.3910, lng: -75.4794 }, // 📍 Coordenadas de Cartagena
  };
}

