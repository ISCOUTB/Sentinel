// ─────────────────────────────────────────────────────────────────────────────
// Sentinel HMI — useIoTConnection hook
//
// Hook puro (sin JSX) que gestiona el ciclo de vida completo de la
// conexión MQTT a AWS IoT Core y mantiene el estado de los tres tópicos USV.
//
// Uso:
//   const { connectionStatus, usvStatus, misionData, logs } =
//     useIoTConnection({ idToken, thingName });
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback, useReducer } from 'react';
import { mqtt } from 'aws-iot-device-sdk-v2';
import { createIoTConnection, MqttConnection } from '@/services/iot-config';
import {
  USVStatus,
  MisionData,
  LogEntry,
  IoTState,
  IoTConnectionStatus,
} from '@/types/iot.types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_LOG_HISTORY = 50;

// ─── Reducer para el estado IoT ───────────────────────────────────────────────

type IoTAction =
  | { type: 'SET_STATUS'; payload: IoTConnectionStatus }
  | { type: 'SET_USV_STATUS'; payload: USVStatus }
  | { type: 'SET_MISION'; payload: MisionData }
  | { type: 'ADD_LOG'; payload: LogEntry }
  | { type: 'SET_ERROR'; payload: string };

const initialState: IoTState = {
  connectionStatus: 'disconnected',
  usvStatus: null,
  misionData: null,
  logs: [],
  error: null,
};

function iotReducer(state: IoTState, action: IoTAction): IoTState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, connectionStatus: action.payload, error: null };
    case 'SET_USV_STATUS':
      return { ...state, usvStatus: action.payload };
    case 'SET_MISION':
      return { ...state, misionData: action.payload };
    case 'ADD_LOG':
      return {
        ...state,
        logs: [action.payload, ...state.logs].slice(0, MAX_LOG_HISTORY),
      };
    case 'SET_ERROR':
      return { ...state, connectionStatus: 'error', error: action.payload };
    default:
      return state;
  }
}

// ─── Hook params ─────────────────────────────────────────────────────────────

interface UseIoTConnectionParams {
  /** ID Token de Cognito. Si es null/undefined la conexión no se inicia. */
  idToken: string | null;
  /** Nombre del Thing en AWS IoT Core (p. ej. "USV-001"). */
  thingName: string;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useIoTConnection({ idToken, thingName }: UseIoTConnectionParams): IoTState {
  const [state, dispatch] = useReducer(iotReducer, initialState);

  // Referencia estable a la conexión activa para usarla en el cleanup
  const connectionRef = useRef<MqttConnection | null>(null);

  // Handler genérico de mensajes MQTT
  const handleMessage = useCallback(
    (topic: string, payload: ArrayBuffer) => {
      try {
        const text = new TextDecoder('utf-8').decode(payload);
        const data = JSON.parse(text);

        if (topic.endsWith('/general_usv_status')) {
          dispatch({ type: 'SET_USV_STATUS', payload: data as USVStatus });
        } else if (topic.endsWith('/mision')) {
          dispatch({ type: 'SET_MISION', payload: data as MisionData });
        } else if (topic.endsWith('/logs')) {
          dispatch({ type: 'ADD_LOG', payload: data as LogEntry });
        }
      } catch (err) {
        console.error('[IoT] Error parsing MQTT message on', topic, err);
      }
    },
    []
  );

  useEffect(() => {
    // No conectar si no hay token
    if (!idToken || !thingName) return;

    let cancelled = false;

    const connect = async () => {
      dispatch({ type: 'SET_STATUS', payload: 'connecting' });
      try {
        const conn = await createIoTConnection(idToken);
        if (cancelled) {
          // Si el componente se desmontó antes de conectar, desconectar limpio
          conn.disconnect().catch(console.error);
          return;
        }

        connectionRef.current = conn;
        dispatch({ type: 'SET_STATUS', payload: 'connected' });

        // Suscribir a los tres tópicos del USV
        const topics = [
          `${thingName}/general_usv_status`,
          `${thingName}/mision`,
          `${thingName}/logs`,
        ] as const;

        for (const topic of topics) {
          await conn.subscribe(topic, mqtt.QoS.AtLeastOnce, handleMessage);
          console.log(`[IoT] Suscrito a: ${topic}`);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[IoT] Error de conexión:', message);
          dispatch({ type: 'SET_ERROR', payload: message });
        }
      }
    };

    connect();

    // Cleanup: desconectar al desmontar o cuando cambien idToken/thingName
    return () => {
      cancelled = true;
      if (connectionRef.current) {
        connectionRef.current.disconnect().catch(console.error);
        connectionRef.current = null;
        dispatch({ type: 'SET_STATUS', payload: 'disconnected' });
      }
    };
  }, [idToken, thingName, handleMessage]);

  return state;
}