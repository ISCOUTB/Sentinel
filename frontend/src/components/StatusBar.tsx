import { Battery, Activity, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useIoTData } from '@/contexts/IoTContext';
import { safeVal } from '@/utils/validators';

// Mapa de estado de conexión USV → UI
const conexionConfig = {
  ONLINE: { label: 'En línea', dot: 'bg-emerald-500', icon: Wifi },
  OFFLINE: { label: 'Fuera de línea', dot: 'bg-red-500', icon: WifiOff },
} as const;

/**
 * Barra de Estado Global de Telemetría.
 * 
 * Muestra información resumida en tres paneles:
 * 1. Batería: Carga porcentual y corriente total consumida por los motores (M1 y M2).
 * 2. Estado de Red: Estado del enlace físico del USV (ONLINE/OFFLINE) y del puente de WebSocket MQTT.
 * 3. Actividad: Actividad actual del USV y dirección angular (guiñada) en grados.
 */
const StatusBar = () => {
  const { usvStatus, connectionStatus } = useIoTData();

  const battery = usvStatus?.bateria_porcentaje ?? 0;
  const actividad = usvStatus?.actividad ?? '—';
  const conexion = usvStatus?.conexion ?? 'OFFLINE';

  const conexionUI = conexionConfig[conexion as keyof typeof conexionConfig] ?? {
    label: conexion,
    dot: 'bg-slate-400',
    icon: Wifi,
  };
  const ConexionIcon = conexionUI.icon;

  // Color de batería dinámico
  const batteryColor =
    battery > 50 ? 'hsl(var(--chart-2))' : battery > 20 ? '#f59e0b' : '#ef4444';

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* ── Batería ── */}
      <Card className="p-4 bg-card border-border">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Battery className="w-4 h-4 text-accent" />
            Batería
          </h3>
          {connectionStatus === 'connecting' && (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          {battery?.toFixed(0) ?? 0}%
          {usvStatus && (
            <span className="ml-2">
              · M1: {usvStatus.corriente_motor_1_a?.toFixed(1) ?? 0} A &nbsp;
              M2: {usvStatus.corriente_motor_2_a?.toFixed(1) ?? 0} A
            </span>
          )}
        </p>
        <Progress
          value={battery}
          className="h-2"
          style={{ '--progress-color': batteryColor } as React.CSSProperties}
        />
      </Card>

      {/* ── Estado de conexión ── */}
      <Card className="p-4 bg-card border-border">
        <h3 className="text-sm font-semibold mb-2">Estado</h3>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${conexionUI.dot} animate-pulse`} />
          <span className="text-xs text-muted-foreground">{conexionUI.label}</span>
          <ConexionIcon className="w-3 h-3 ml-auto text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          MQTT:{' '}
          <span
            className={
              connectionStatus === 'connected'
                ? 'text-emerald-500'
                : connectionStatus === 'error'
                  ? 'text-red-500'
                  : 'text-amber-500'
            }
          >
            {connectionStatus}
          </span>
        </p>
      </Card>

      {/* ── Actividad ── */}
      <Card className="p-4 bg-card border-border">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Actividad
        </h3>
        <div className="text-xs text-muted-foreground">{actividad?.replace(/_/g, ' ') || '—'}</div>
        {usvStatus && (
          <div className="text-xs text-muted-foreground mt-1">
            Yaw: {usvStatus.yaw_grados?.toFixed(1) ?? 0}°
          </div>
        )}
      </Card>
    </div>
  );
};

export default StatusBar;
