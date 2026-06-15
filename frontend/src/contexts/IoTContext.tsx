// ─────────────────────────────────────────────────────────────────────────────
// Sentinel HMI — IoT Context
//
// Provider global que expone el estado MQTT a todos los componentes hijos.
// Elimina prop-drilling: cualquier componente dentro de <IoTProvider> puede
// llamar a useIoTData() para leer usvStatus, misionData y logs en tiempo real.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIoTConnection, IoTState } from '@/hooks/useIoTconnection';

// ─── Configuración ────────────────────────────────────────────────────────────

const DEFAULT_THING_NAME =
  (import.meta.env.VITE_IOT_THING_NAME as string) ?? 'USV-001';

// ─── Context ─────────────────────────────────────────────────────────────────

// Context
const IoTContext = createContext<IoTState | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface IoTProviderProps {
  children: React.ReactNode;
  /** Sobrescribir el thingName (opcional; por defecto usa VITE_IOT_THING_NAME) */
  thingName?: string;
}

/**
 * Proveedor del Contexto IoT.
 * 
 * Vincula el ciclo de vida del WebSocket de AWS IoT Core con la sesión autenticada del usuario,
 * distribuyendo de forma centralizada la telemetría en tiempo real a todos los componentes del HMI.
 */
export const IoTProvider: React.FC<IoTProviderProps> = ({
  children,
  thingName = DEFAULT_THING_NAME,
}) => {
  // Obtenemos el idToken del contexto de autenticación existente
  const { idToken } = useAuth();

  const iotState = useIoTConnection({ idToken, thingName });

  return <IoTContext.Provider value={iotState}>{children}</IoTContext.Provider>;
};

// ─── Hook de consumo ─────────────────────────────────────────────────────────

/**
 * Accede al estado de telemetría IoT desde cualquier componente hijo dentro de `<IoTProvider>`.
 * 
 * Permite leer `connectionStatus`, `usvStatus`, `misionData` y `logs` en tiempo real sin prop-drilling.
 *
 * @example
 * const { connectionStatus, usvStatus, misionData, logs } = useIoTData();
 * 
 * @returns El estado consolidado de la conexión MQTT.
 * @throws Error si se invoca fuera del proveedor `<IoTProvider>`.
 */
export function useIoTData(): IoTState {
  const ctx = useContext(IoTContext);
  if (!ctx) {
    throw new Error('useIoTData debe usarse dentro de <IoTProvider>');
  }
  return ctx;
}
