import { Droplet, Zap, Thermometer, Wind, FlaskConical, Gauge } from 'lucide-react';
import SensorChart from './SensorChart';
import { Card } from '@/components/ui/card';
import { useIoTData } from '@/contexts/IoTContext';

// ─── Icon mapping ─────────────────────────────────────────────────────────────

const SensorPanel = () => {
  const { usvStatus, misionData, logs, connectionStatus } = useIoTData();

  // ── Construir lista de sensores desde datos MQTT ──────────────────────────
  const sensors = misionData
    ? [
        {
          name: 'Temperatura Agua',
          value: misionData.temperatura_agua_c.toFixed(1),
          unit: '°C',
          icon: Thermometer,
          color: 'text-orange-400',
        },
        {
          name: 'pH Agua',
          value: misionData.ph_agua.toFixed(2),
          unit: 'pH',
          icon: FlaskConical,
          color: 'text-violet-400',
        },
        {
          name: 'Turbidez',
          value: misionData.turbidez_ntu.toFixed(1),
          unit: 'NTU',
          icon: Droplet,
          color: 'text-blue-400',
        },
        // {
        //   name: 'Oxígeno Disuelto',
        //   value: misionData.oxigeno_disuelto_ppm.toFixed(1),
        //   unit: 'ppm',
        //   icon: Wind,
        //   color: 'text-emerald-400',
        // },
      ]
    : [];

  // ── Métricas eléctricas desde usvStatus ──────────────────────────────────
  const metrics = usvStatus
    ? [
        {
          label: 'Corriente M1',
          value: usvStatus.corriente_motor_1_a.toFixed(1),
          unit: 'A',
          icon: Zap,
        },
        {
          label: 'Corriente M2',
          value: usvStatus.corriente_motor_2_a.toFixed(1),
          unit: 'A',
          icon: Zap,
        },
        {
          label: 'Voltaje Celda 1',
          value: usvStatus.voltaje_celda_1_v.toFixed(2),
          unit: 'V',
          icon: Gauge,
        },
      ]
    : [];

  // ── Estado de carga ───────────────────────────────────────────────────────
  if (connectionStatus === 'connecting') {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-muted-foreground animate-pulse">Conectando a IoT Core…</p>
      </div>
    );
  }

  if (connectionStatus === 'error') {
    return (
      <div className="flex justify-center items-center h-full text-red-500">
        <p>Error de conexión MQTT. Revisa las variables de entorno.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <h2 className="text-xl font-bold mb-3 flex-shrink-0">Datos Sensores</h2>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {/* ── Grid de sensores ambientales en columnas ── */}
        <div className="grid grid-cols-3 gap-2">
          {sensors.length === 0 ? (
            <p className="text-xs text-muted-foreground col-span-3">
              Esperando datos del tópico <code>mision</code>…
            </p>
          ) : (
            sensors.map((sensor) => {
              const Icon = sensor.icon;
              return (
                <div
                  key={sensor.name}
                  className="flex flex-col items-center gap-2 p-3 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors text-center"
                >
                  <div className="p-2 bg-primary/10 rounded">
                    <Icon className={`w-5 h-5 ${sensor.color}`} />
                  </div>
                  <span className="text-xs font-medium leading-tight">{sensor.name}</span>
                  <span className="text-lg font-semibold">
                    {sensor.value}
                    <span className="text-xs text-muted-foreground ml-1">{sensor.unit}</span>
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* ── Gráfica temporal ── */}
        <Card className="p-4 bg-card border-border">
          <SensorChart />
        </Card>

        {/* ── Métricas eléctricas ── */}
        {metrics.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <Card key={metric.label} className="p-3 bg-card border-border">
                  <div className="flex items-center gap-1 mb-1">
                    <Icon className="w-3 h-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                  </div>
                  <p className="text-lg font-bold">
                    {metric.value}
                    <span className="text-xs text-muted-foreground ml-1">{metric.unit}</span>
                  </p>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Log reciente ── */}
        <Card className="p-4 bg-card border-border">
          <div className="flex items-start gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
            <h3 className="font-semibold">Logs del Sistema</h3>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            {logs.length === 0 ? (
              <p className="text-xs">Sin logs recientes.</p>
            ) : (
              logs.slice(0, 5).map((log) => (
                <div key={log.log_id} className="flex justify-between gap-2">
                  <span
                    className={
                      log.nivel === 'ERROR'
                        ? 'text-red-400'
                        : log.nivel === 'WARN'
                          ? 'text-amber-400'
                          : 'text-muted-foreground'
                    }
                  >
                    [{log.nivel}] {log.mensaje}
                  </span>
                  <span className="text-xs shrink-0">
                    {new Date(log.timestamp_utc).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SensorPanel;