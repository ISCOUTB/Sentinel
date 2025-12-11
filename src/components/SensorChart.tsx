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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchSensorData } from "@/api/sensorData"; // 👈 Importa tu función de datos

// Tipo de dato para cada punto del gráfico
type SensorPoint = {
  time: string;
  temperatura: number;
  humedad: number;
  corriente: number;
};

const SensorChart = () => {
  const [data, setData] = useState<SensorPoint[]>([]);

  useEffect(() => {
    const updateData = async () => {
      const response = await fetchSensorData();

      const tempSensor = response.sensors.find((s) => s.name === "Temperatura");
      const humSensor = response.sensors.find((s) => s.name === "Humedad");
      const currSensor = response.sensors.find((s) => s.name === "Corriente");

      if (tempSensor && humSensor && currSensor) {
        const newPoint: SensorPoint = {
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          temperatura: parseFloat(tempSensor.value),
          humedad: parseFloat(humSensor.value),
          corriente: parseFloat(currSensor.value),
        };

        setData((prev) => {
          const updated = [...prev, newPoint];
          // Limita el historial a los últimos 24 puntos
          return updated.slice(-24);
        });
      }
    };

    updateData(); // Ejecuta al iniciar
    const interval = setInterval(updateData, 5000); // Actualiza cada 5 segundos

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Datos de sensores en tiempo real
        </h3>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))" }} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              color: "hsl(var(--popover-foreground))",
            }}
          />

          {/* 🌡️ Temperatura */}
          <Line
            type="monotone"
            dataKey="temperatura"
            stroke="#f87171"
            strokeWidth={2}
            dot={false}
            name="Temperatura (°C)"
          />

          {/* 💧 Humedad */}
          <Line
            type="monotone"
            dataKey="humedad"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
            name="Humedad (%)"
          />

          {/* ⚡ Corriente */}
          <Line
            type="monotone"
            dataKey="corriente"
            stroke="#34d399"
            strokeWidth={2}
            dot={false}
            name="Corriente (A)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SensorChart;
