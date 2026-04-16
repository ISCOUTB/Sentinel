// ─────────────────────────────────────────────────────────────────────────────
// Sentinel HMI — IoT Core Type Definitions
// Mirrors the structure of /tests/iot-emulator/usv_simulation.json
// Each top-level key corresponds to one MQTT topic: {thingName}/<topic>
// ─────────────────────────────────────────────────────────────────────────────

/** Tópico: {thingName}/general_usv_status */
export interface USVStatus {
  usv_id: string;
  conexion: 'ONLINE' | 'OFFLINE' | string;
  actividad: 'EN_MISION' | 'EN_ESPERA' | 'DETENIDO' | string;

  // Batería y motores
  bateria_porcentaje: number;
  corriente_motor_1_a: number;
  corriente_motor_2_a: number;
  voltaje_celda_1_v: number;
  voltaje_celda_2_v: number;
  voltaje_celda_3_v: number;

  // Orientación IMU
  roll_grados: number;
  pitch_grados: number;
  yaw_grados: number;

  // Posición GPS
  latitud: number;
  longitud: number;

  timestamp_utc: string;
}

/** Tópico: {thingName}/mision */
export interface MisionData {
  mission_id: string;
  usv_id: string;
  tipo_mision: string;
  estado_mision: 'EN_PROGRESO' | 'COMPLETADA' | 'CANCELADA' | string;

  // Punto de muestreo
  punto_id: string;
  latitud: number;
  longitud: number;
  profundidad_m: number;

  // Parámetros de calidad de agua
  temperatura_agua_c: number;
  ph_agua: number;
  turbidez_ntu: number;
  oxigeno_disuelto_ppm: number;

  timestamp_utc: string;
}

/** Tópico: {thingName}/logs */
export interface LogEntry {
  log_id: string;
  usv_id: string;
  mission_id: string;
  nivel: 'INFO' | 'WARN' | 'ERROR' | string;
  mensaje: string;
  codigo: number;
  timestamp_utc: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado agregado del contexto IoT
// ─────────────────────────────────────────────────────────────────────────────

export type IoTConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface IoTState {
  connectionStatus: IoTConnectionStatus;
  /** Último mensaje recibido del tópico general_usv_status */
  usvStatus: USVStatus | null;
  /** Último mensaje recibido del tópico mision */
  misionData: MisionData | null;
  /** Historial de logs (máximo 50 entradas, más reciente primero) */
  logs: LogEntry[];
  /** Último error de conexión, si existe */
  error: string | null;
}
