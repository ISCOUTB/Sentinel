import { useEffect, useRef, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { ChevronLeft, ChevronRight, Globe, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIoTData } from '@/contexts/IoTContext';

// ─── Tipos e Interfaces ──────────────────────────────────────────────────────

interface ChartPoint {
  time: string;
  temperatura: number;
  ph: number;
  oxigeno: number;
  turbidez: number;
}

type VisibleLines = {
  temperatura: boolean;
  ph: boolean;
  oxigeno: boolean;
  turbidez: boolean;
};

const MAX_POINTS = 24;

const SENSOR_LINES = [
  { key: "temperatura" as const, label: "Temp. Agua (°C)", color: "#f87171" },
  { key: "oxigeno" as const, label: "O₂ Disuelto (ppm)", color: "#34d399" },
  { key: "ph" as const, label: "pH", color: "#a78bfa" },
  { key: "turbidez" as const, label: "Turbidez (NTU)", color: "#fbbf24" },
];

// ─── Componente Principal ─────────────────────────────────────────────────────

const SensorChart = () => {
  const { misionData } = useIoTData();
  
  // Estados para la funcionalidad de navegación y visibilidad
  const [visibleLines, setVisibleLines] = useState<VisibleLines>({
    temperatura: true,
    oxigeno: true,
    ph: true,
    turbidez: true,
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  // Referencias para manejar el historial de datos en tiempo real (MQTT)
  const historyRef = useRef<ChartPoint[]>([]);
  const prevTimestamp = useRef<string | null>(null);
  const [, forceUpdate] = useState({}); // Para disparar re-render cuando llega MQTT

  const visibleSensors = SENSOR_LINES.filter((line) => visibleLines[line.key]);

  // Efecto para procesar datos del Hook IoT
  useEffect(() => {
    if (!misionData) return;

    // Evitar duplicados por timestamp
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
      turbidez: misionData.turbidez_ntu || 0,
    };

    historyRef.current = [...historyRef.current, newPoint].slice(-MAX_POINTS);
    forceUpdate({}); // Sincronizamos con el ciclo de vida de React

  }, [misionData]);

  const data = historyRef.current;

  // Manejadores de Interfaz
  const handleNavigate = (direction: "left" | "right") => {
    if (visibleSensors.length === 0) return;
    setIsNavigating(true);
    if (direction === "left") {
      setCurrentIndex((prev) => (prev - 1 + visibleSensors.length) % visibleSensors.length);
    } else {
      setCurrentIndex((prev) => (prev + 1) % visibleSensors.length);
    }
  };

  const handleToggleSensor = (sensorKey: keyof VisibleLines) => {
    setVisibleLines((prev) => ({ ...prev, [sensorKey]: !prev[sensorKey] }));
    setCurrentIndex(0);
    setIsNavigating(false);
  };

  const handleReset = () => {
    setVisibleLines({ temperatura: true, ph: true, oxigeno: true, turbidez: true });
    setCurrentIndex(0);
    setIsNavigating(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-muted-foreground">
            Parámetros de calidad del agua — tiempo real
          </h3>
          <p className="text-xs text-muted-foreground/70">
            {data.length > 0 ? `${data.length} muestras recibidas` : 'Esperando datos de sensores...'}
          </p>
        </div>

        <div className="flex gap-2 items-center">
          {/* Navegación entre sensores */}
          <div className="flex gap-1 rounded-lg border bg-background p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleNavigate("left")}
              disabled={visibleSensors.length === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleNavigate("right")}
              disabled={visibleSensors.length === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Menú de selección */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filtros de variables</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SENSOR_LINES.map((sensor) => (
                <DropdownMenuCheckboxItem
                  key={sensor.key}
                  checked={visibleLines[sensor.key]}
                  onCheckedChange={() => handleToggleSensor(sensor.key)}
                >
                  {sensor.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleReset}
            title="Ver todas las dimensiones"
          >
            <Globe className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 8, right: 20, left: 20, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis 
            dataKey="time" 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
            minTickGap={30}
          />
          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} width={30} />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--muted))', strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              fontSize: '12px'
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

          {isNavigating && visibleSensors.length > 0 ? (
            // Modo Enfoque (Navegando con flechas)
            <Line
              type="monotone"
              dataKey={visibleSensors[currentIndex].key}
              stroke={visibleSensors[currentIndex].color}
              strokeWidth={2.5}
              dot={false}
              name={visibleSensors[currentIndex].label}
              animationDuration={300}
            />
          ) : (
            // Modo Multidimensional (Filtros del Dropdown)
            SENSOR_LINES.map((sensor) => (
              visibleLines[sensor.key] && (
                <Line
                  key={sensor.key}
                  type="monotone"
                  dataKey={sensor.key}
                  stroke={sensor.color}
                  strokeWidth={2}
                  dot={false}
                  name={sensor.label}
                  animationDuration={300}
                />
              )
            ))
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SensorChart;