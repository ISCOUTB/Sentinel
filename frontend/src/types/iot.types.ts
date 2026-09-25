// ─────────────────────────────────────────────────────────────────────────────
// Sentinel HMI — IoT Core Type Definitions
// Mirrors the structure of /tests/iot-emulator/usv_simulation.json
// Each top-level key corresponds to one MQTT topic: {thingName}/<topic>
// ─────────────────────────────────────────────────────────────────────────────

/** 
 * Representa la telemetría del estado físico general del USV.
 * Tópico: `{thingName}/general_usv_status`
 */
export interface USVStatus {
  /** Identificador único del vehículo de superficie */
  usv_id: string;
  /** Estado de conexión en red del transceptor */
  conexion: 'ONLINE' | 'OFFLINE' | string;
  /** Actividad o estado operativo del vehículo */
  actividad: 'EN_MISION' | 'EN_ESPERA' | 'DETENIDO' | string;

  // Batería y motores
  /** Porcentaje de carga restante de la batería principal (0-100) */
  bateria_porcentaje: number;
  /** Consumo de corriente del motor babor en Amperes */
  corriente_motor_1_a: number;
  /** Consumo de corriente del motor estribor en Amperes */
  corriente_motor_2_a: number;
  /** Voltaje de la celda de batería 1 en Voltios */
  voltaje_celda_1_v: number;
  /** Voltaje de la celda de batería 2 en Voltios */
  voltaje_celda_2_v: number;
  /** Voltaje de la celda de batería 3 en Voltios */
  voltaje_celda_3_v: number;

  // Orientación IMU
  /** Ángulo de balanceo en grados */
  roll_grados: number;
  /** Ángulo de cabeceo en grados */
  pitch_grados: number;
  /** Dirección angular respecto al norte (guiñada) en grados (0-360) */
  yaw_grados: number;

  // Posición GPS
  /** Coordenada de latitud decimal de la ubicación actual */
  latitud: number;
  /** Coordenada de longitud decimal de la ubicación actual */
  longitud: number;
  /** Índice del waypoint de ruta actual que persigue el sistema de navegación autónomo */
  current_waypoint_index?: number;

  /** Marca de tiempo de la lectura en formato ISO UTC */
  timestamp_utc: string;
}

/** 
 * Representa lecturas de sensores de calidad de agua asociadas a una misión.
 * Tópico: `{thingName}/mision`
 */
export interface MisionData {
  /** Identificador único de la misión en curso */
  mission_id: string;
  /** Identificador del vehículo */
  usv_id: string;
  /** Tipo o configuración de la misión */
  tipo_mision: string;
  /** Estado de progreso de la trayectoria */
  estado_mision: 'EN_PROGRESO' | 'COMPLETADA' | 'CANCELADA' | string;

  // Punto de muestreo
  /** Identificador del waypoint actual en ruta */
  punto_id: string;
  /** Latitud del punto de muestreo */
  latitud: number;
  /** Longitud del punto de muestreo */
  longitud: number;
  /** Profundidad estimada de la columna de agua en metros */
  profundidad_m: number;

  // Parámetros de calidad de agua
  /** Temperatura medida en grados Celsius */
  temperatura_agua_c: number;
  /** Medición del potencial de hidrógeno (pH) */
  ph_agua: number;
  /** Nivel de turbidez medido en Unidades Nefelométricas de Turbidez (NTU) */
  turbidez_ntu: number;
  /** Concentración de oxígeno disuelto medida en mg/L (ppm) */
  oxigeno_disuelto_ppm: number;

  /** Marca de tiempo en formato ISO UTC */
  timestamp_utc: string;
}

/** 
 * Entrada de log generada por el firmware del USV.
 * Tópico: `{thingName}/logs`
 */
export interface LogEntry {
  /** Identificador único del evento de log */
  log_id: string;
  /** Identificador del vehículo */
  usv_id: string;
  /** Identificador de la misión */
  mission_id: string;
  /** Nivel de severidad del log */
  nivel: 'INFO' | 'WARN' | 'ERROR' | string;
  /** Mensaje textual explicativo del evento */
  mensaje: string;
  /** Código de estado del sistema */
  codigo: number;
  /** Marca de tiempo del suceso */
  timestamp_utc: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado agregado del contexto IoT
// ─────────────────────────────────────────────────────────────────────────────

/** Estado de la conexión del WebSocket con AWS IoT Core */
export type IoTConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/** Estado consolidado que expone el contexto de telemetría de Sentinel */
export interface IoTState {
  /** Estado actual de conexión */
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
