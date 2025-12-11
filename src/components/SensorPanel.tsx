import { useQuery } from "@tanstack/react-query";
import { fetchSensorData } from "@/api/sensorData";
import { Droplet, Zap, Thermometer } from "lucide-react";
import SensorChart from "./SensorChart";
import { Card } from "@/components/ui/card";

const iconMap: Record<string, any> = {
  Humedad: Droplet,
  Corriente: Zap,
  Temperatura: Thermometer,
};

const SensorPanel = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["sensorData"],
    queryFn: fetchSensorData,
    refetchInterval: 5000, // actualiza cada 5 segundos
  });

  if (isLoading)
    return (
      <div className="flex justify-center items-center h-full">
        <p>Cargando datos de sensores...</p>
      </div>
    );

  if (isError)
    return (
      <div className="flex justify-center items-center h-full text-red-500">
        <p>Error al cargar datos de sensores.</p>
      </div>
    );

  const { sensors, metrics, logs } = data!;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <h2 className="text-xl font-bold mb-3 flex-shrink-0">Datos Sensores</h2>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {/* Lista de Sensores */}
        <div className="space-y-2">
          {sensors.map((sensor) => {
            const Icon = iconMap[sensor.name] || Droplet;
            return (
              <div
                key={sensor.name}
                className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <div className="p-2 bg-primary/10 rounded">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-medium">{sensor.name}</span>
                <span className="ml-auto text-lg font-semibold">
                  {sensor.value}
                  {sensor.unit}
                </span>
              </div>
            );
          })}
        </div>

        {/* Gráfica */}
        <Card className="p-4 bg-card border-border">
          <SensorChart />
        </Card>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-3">
          {metrics.map((metric) => (
            <Card key={metric.label} className="p-3 bg-card border-border">
              <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
              <p className="text-lg font-bold">
                {metric.value}
                <span className="text-xs text-muted-foreground ml-1">{metric.unit}</span>
              </p>
            </Card>
          ))}
        </div>

        {/* Logs */}
        <Card className="p-4 bg-card border-border">
          <div className="flex items-start gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5"></div>
            <h3 className="font-semibold">Logs</h3>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            {logs.map((log, i) => (
              <div key={i} className="flex justify-between">
                <span>{log.text}</span>
                <span>{log.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SensorPanel;