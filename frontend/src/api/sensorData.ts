// src/api/sensorData.ts

export async function fetchSensorData() {
  // Simulamos una API con retardo
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Retornamos valores dinámicos
  return {
    sensors: [
      { name: 'Humedad', value: (70 + Math.random() * 30).toFixed(1), unit: '%' },
      { name: 'Corriente', value: (1 + Math.random() * 3).toFixed(2), unit: 'A' },
      { name: 'Temperatura', value: (22 + Math.random() * 6).toFixed(1), unit: '°C' },
    ],
    metrics: [
      { label: 'Parameter', value: (900 + Math.random() * 50).toFixed(1), unit: 'hPa' },
      { label: 'Air pressure', value: (900 + Math.random() * 50).toFixed(1), unit: 'hPa' },
      { label: 'Air humidity', value: (70 + Math.random() * 30).toFixed(1), unit: '%' },
    ],
    logs: [
      { text: 'Sensores actualizados correctamente', time: new Date().toLocaleTimeString() },
      { text: 'Lectura estable', time: new Date().toLocaleTimeString() },
    ],
  };
}