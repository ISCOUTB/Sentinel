import { useQuery } from "@tanstack/react-query";

export default function BatteryStatus() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["batteryStatus"],
    queryFn: async () => {
      if (!("getBattery" in navigator)) {
        // ⚠️ Si el navegador no soporta la API
        throw new Error("Battery API no soportada");
      }

      // @ts-ignore — la API no está tipada en todos los navegadores
      const battery = await navigator.getBattery();

      const percentage = Math.round(battery.level * 100);
      const status = battery.charging ? "Charging" : "On battery";

      return {
        percentage,
        status,
        timeLeft: battery.dischargingTime
          ? `${Math.round(battery.dischargingTime / 3600)} hours left`
          : "Calculating...",
      };
    },
    refetchInterval: 10000, // 🔁 cada 10 s
    retry: false, // evita que siga intentando si no existe la API
  });

  if (isLoading) return <p>Cargando batería...</p>;
  if (isError)
    return <p>El navegador no soporta la API de batería.</p>;

  return (
    <div className="battery">
      <p>
        {data.percentage}% — {data.status}, {data.timeLeft}
      </p>
    </div>
  );
}