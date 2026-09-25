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
  IoTState as BaseIoTState,
  IoTConnectionStatus,
} from '@/types/iot.types';

export interface IoTState extends BaseIoTState {
  publish: (topic: string, payload: any) => Promise<void>;
}

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
  publish: async () => { console.warn('MQTT not connected yet'); },
};

/**
 * Reducer puro de React para gestionar de forma determinista el estado de telemetría IoT.
 * 
 * Filtra los datos MQTT y los distribuye según el tópico al que correspondan.
 */
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

/**
 * Hook de bajo nivel que gestiona la conexión WebSocket con AWS IoT Core.
 * 
 * Implementa la conexión mediante firmas SigV4, realiza suscripciones automáticas
 * a los tópicos de telemetría del USV, procesa y decodifica las tramas JSON recibidas,
 * y expone una función para publicar órdenes MQTT de vuelta al vehículo.
 * 
 * @param params Parámetros de token e identificador del vehículo.
 * @returns El estado consolidado IoT y la función `publish`.
 */
export function useIoTConnection({ idToken, thingName }: UseIoTConnectionParams): IoTState {
  const [state, dispatch] = useReducer(iotReducer, initialState);

  // Referencia estable a la conexión activa para usarla en el cleanup
  const connectionRef = useRef<MqttConnection | null>(null);

  // Handler genérico de mensajes MQTT
  /**
   * Procesa las tramas de bytes recibidas de AWS IoT Core, las decodifica a UTF-8
   * y las despacha al Reducer según el subsegmento del tópico.
   */
  const handleMessage = useCallback(
    (topic: string, payload: ArrayBuffer) => {
      try {
        const text = new TextDecoder('utf-8').decode(payload);
        const data = JSON.parse(text);
        
        if (topic.endsWith('/general_usv_status')) {
          const payload = data.general_usv_status ?? data;
          dispatch({ type: 'SET_USV_STATUS', payload: payload as USVStatus });
        } else if (topic.endsWith('/mision')) {
          const payload = data.mision ?? data;
          dispatch({ type: 'SET_MISION', payload: payload as MisionData });
        } else if (topic.endsWith('/logs')) {
          const payload = data.logs ?? data;
          dispatch({ type: 'ADD_LOG', payload: payload as LogEntry });
        }
      } catch (err) {
        console.error('[IoT] Message parse error:', err);
      }
    },
    []
  );

  useEffect(() => {
    // No conectar si no hay token
    if (!idToken || !thingName) {
      return;
    }

    let cancelled = false;

    /**
     * Establece la conexión asíncrona mediante el WebSocket presignado.
     * Al conectarse con éxito, se suscribe a los tópicos `{thingName}/general_usv_status`,
     * `{thingName}/mision` y `{thingName}/logs`.
     */
    const connect = async () => {
      dispatch({ type: 'SET_STATUS', payload: 'connecting' });
      try {
        const conn = await createIoTConnection(idToken);
        if (cancelled) {
          conn.disconnect().catch(() => {});
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
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[IoT] Connection failed:', message);
          dispatch({ type: 'SET_ERROR', payload: message });
        }
      }
    };

    connect();

    // Cleanup: desconectar al desmontar o cuando cambien idToken/thingName
    return () => {
      cancelled = true;
      if (connectionRef.current) {
        connectionRef.current.disconnect().catch(() => {});
        connectionRef.current = null;
        dispatch({ type: 'SET_STATUS', payload: 'disconnected' });
      }
    };
  }, [idToken, thingName, handleMessage]);

  /**
   * Publica un mensaje serializado en JSON en un tópico de MQTT.
   * 
   * @param topic El tópico MQTT de destino.
   * @param payload Objeto JSON que constituye el mensaje.
   */
  const publish = useCallback(async (topic: string, payload: any) => {
    if (connectionRef.current) {
      const message = JSON.stringify(payload);
      await connectionRef.current.publish(topic, message, mqtt.QoS.AtLeastOnce);
    } else {
      console.warn('[IoT] Cannot publish, no active connection');
    }
  }, []);

  return { ...state, publish };
}