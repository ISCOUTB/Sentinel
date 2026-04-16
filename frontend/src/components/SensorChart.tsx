import { useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { useIoTData } from '@/contexts/IoTContext';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ChartPoint {
  time: string;
  /** Temperatura del agua en °C */
  temperatura: number;
  /** pH del agua */
  ph: number;
  /** Oxígeno disuelto en ppm */
  oxigeno: number;
}

const MAX_POINTS = 24;

// ─── Componente ───────────────────────────────────────────────────────────────

const SensorChart = () => {
  const { misionData } = useIoTData();

  // Acumular puntos históricos sin depender del estado del padre
  const historyRef = useRef<ChartPoint[]>([]);
  const renderRef = useRef<ChartPoint[]>([]);

  // Cada vez que llega un nuevo mensaje MQTT, agregamos un punto
  const prevTimestamp = useRef<string | null>(null);

  useEffect(() => {
    if (!misionData) return;

    // Evitar duplicados si llega el mismo timestamp
    if (misionData.timestamp_utc === prevTimestamp.current) return;
    prevTimestamp.current = misionData.timestamp_utc;

    const newPoint: ChartPoint = {
      time: new Date(misionData.timestamp_utc).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      temperatura: misionData.temperatura_agua_c,
      ph: misionData.ph_agua,
      oxigeno: misionData.oxigeno_disuelto_ppm,
    };

    const updated = [...historyRef.current, newPoint].slice(-MAX_POINTS);
    historyRef.current = updated;
    renderRef.current = updated;
  }, [misionData]);

  // Forzar re-render cuando cambia el historial (sin useState para evitar loop)
  const data = misionData ? renderRef.current : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Parámetros de calidad del agua — tiempo real
        </h3>
        <span className="text-xs text-muted-foreground">
          {data.length > 0 ? `${data.length} muestras` : 'Sin datos'}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="time" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              color: 'hsl(var(--popover-foreground))',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} />

          {/* 🌡️ Temperatura del agua */}
          <Line
            type="monotone"
            dataKey="temperatura"
            stroke="#f87171"
            strokeWidth={2}
            dot={false}
            name="Temp. Agua (°C)"
          />

          {/* ⚗️ pH */}
          <Line
            type="monotone"
            dataKey="ph"
            stroke="#a78bfa"
            strokeWidth={2}
            dot={false}
            name="pH"
          />

          {/* 💧 Oxígeno disuelto */}
          <Line
            type="monotone"
            dataKey="oxigeno"
            stroke="#34d399"
            strokeWidth={2}
            dot={false}
            name="O₂ Disuelto (ppm)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SensorChart;
