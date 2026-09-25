import { apiRequest } from './auth';

export interface SensorItem {
  name: string;
  value: string;
  unit: string;
}

export interface MetricItem {
  label: string;
  value: string;
  unit: string;
}

export interface LogItem {
  text: string;
  time: string;
}

export interface SensorDataResponse {
  sensors: SensorItem[];
  metrics: MetricItem[];
  logs: LogItem[];
}

export async function fetchSensorData(): Promise<SensorDataResponse> {
  const token = localStorage.getItem('accessToken');
  if (!token) {
     // Si no hay token, retornamos datos vacíos o lanzamos error.
     // Para evitar romper la UI si no está logueado (aunque debería estar protegido por ruta), retornamos mock o error.
     // Dado que ProtectedRoute se usa, debería haber token.
     throw new Error("No authorization token found");
  }

  try {
    return await apiRequest<SensorDataResponse>('/data/sensors', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  } catch (error) {
    console.error("Error fetching sensor data:", error);
    // Fallback temporal si falla el backend para no romper la demo completamente
    throw error;
  }
}