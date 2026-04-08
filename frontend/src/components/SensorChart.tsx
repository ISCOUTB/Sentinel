import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchSensorData } from "@/api/sensorData";

type SensorPoint = {
  time: string;
  temperatura: number;
  oxigenoDissuelto: number;
  ph: number;
  turbidez: number;
};

type VisibleLines = {
  temperatura: boolean;
  oxigenoDissuelto: boolean;
  ph: boolean;
  turbidez: boolean;
};

const SENSOR_LINES = [
  { key: "temperatura" as const, label: "Temperatura (°C)", color: "#f87171" },
  { key: "oxigenoDissuelto" as const, label: "Oxígeno Disuelto (mg/L)", color: "#60a5fa" },
  { key: "ph" as const, label: "pH", color: "#34d399" },
  { key: "turbidez" as const, label: "Turbidez (NTU)", color: "#fbbf24" },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const SensorChart = () => {
  const [data, setData] = useState<SensorPoint[]>([]);
  const [visibleLines, setVisibleLines] = useState<VisibleLines>({
    temperatura: true,
    oxigenoDissuelto: true,
    ph: true,
    turbidez: true,
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  const visibleSensors = SENSOR_LINES.filter((line) => visibleLines[line.key]);

  const buildMockPoint = (prev?: SensorPoint): SensorPoint => {
    const base = prev ?? {
      time: "",
      temperatura: 24,
      oxigenoDissuelto: 6.8,
      ph: 7.2,
      turbidez: 8,
    };

    return {
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      temperatura: clamp(base.temperatura + (Math.random() - 0.5) * 1.2, 18, 32),
      oxigenoDissuelto: clamp(base.oxigenoDissuelto + (Math.random() - 0.5) * 0.35, 4.5, 9),
      ph: clamp(base.ph + (Math.random() - 0.5) * 0.12, 6.5, 8.5),
      turbidez: clamp(base.turbidez + (Math.random() - 0.5) * 1.8, 1, 25),
    };
  };

  useEffect(() => {
    const updateData = async () => {
      try {
        const response = await fetchSensorData();

        const tempSensor = response.sensors.find((s) => s.name === "Temperatura");
        const oxygenSensor = response.sensors.find(
          (s) => s.name === "Oxígeno Disuelto" || s.name === "Oxigeno Disuelto",
        );
        const phSensor = response.sensors.find((s) => s.name === "pH" || s.name === "PH");
        const turbSensor = response.sensors.find((s) => s.name === "Turbidez");

        if (tempSensor && oxygenSensor && phSensor && turbSensor) {
          const newPoint: SensorPoint = {
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
            temperatura: parseFloat(tempSensor.value),
            oxigenoDissuelto: parseFloat(oxygenSensor.value),
            ph: parseFloat(phSensor.value),
            turbidez: parseFloat(turbSensor.value),
          };

          setData((prev) => {
            const updated = [...prev, newPoint];
            return updated.slice(-24);
          });
          return;
        }
      } catch {
        // Fallback to simulated values when backend data is unavailable.
      }

      setData((prev) => {
        const nextPoint = buildMockPoint(prev[prev.length - 1]);
        const updated = [...prev, nextPoint];
        return updated.slice(-24);
      });
    };

    updateData();
    const interval = setInterval(updateData, 5000);

    return () => clearInterval(interval);
  }, []);

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
    setVisibleLines((prev) => ({
      ...prev,
      [sensorKey]: !prev[sensorKey],
    }));
    setCurrentIndex(0);
    setIsNavigating(false);
  };

  const handleReset = () => {
    setVisibleLines({
      temperatura: true,
      oxigenoDissuelto: true,
      ph: true,
      turbidez: true,
    });
    setCurrentIndex(0);
    setIsNavigating(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Datos de sensores en tiempo real
        </h3>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 rounded-lg border bg-background p-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-0 bg-transparent"
              onClick={() => handleNavigate("left")}
              disabled={visibleSensors.length === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-0 bg-transparent"
              onClick={() => handleNavigate("right")}
              disabled={visibleSensors.length === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Seleccionar datos ambientales</DropdownMenuLabel>
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
            title="Mostrar todos los datos"
          >
            <Globe className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="time"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            padding={{ left: 12, right: 12 }}
          />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} width={45} />
          <Tooltip
            cursor={false}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              color: "hsl(var(--popover-foreground))",
            }}
          />

          {isNavigating && visibleSensors.length > 0 ? (
            <Line
              type="monotone"
              dataKey={visibleSensors[currentIndex].key}
              stroke={visibleSensors[currentIndex].color}
              strokeWidth={2}
              dot={false}
              name={visibleSensors[currentIndex].label}
            />
          ) : (
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
