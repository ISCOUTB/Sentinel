import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export default function Alert() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:3001/alerts");
      return res.data;
    },
    refetchInterval: 3000, // actualiza cada 3 s
  });

  if (isLoading) return <p>Cargando alertas...</p>;
  if (isError) return <p>Error al obtener las alertas</p>;

  return (
    <div className="alert bg-red-100 text-red-600 p-2 rounded-md">
      {data.message ? <p>{data.message}</p> : <p>Sin alertas activas</p>}
    </div>
  );
}
