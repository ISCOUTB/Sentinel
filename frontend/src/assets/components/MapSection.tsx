import { useState } from "react";
import Alert from "./Alert";
import BatteryStatus from "./BatteryStatus";
import ControlButtons from "./ControlButtons";
import MapView from "../../components/MapView";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

export type MissionPoint = { lat: number; lng: number };

function MapSection() {
  const [missionPoints, setMissionPoints] = useState<MissionPoint[]>([]);
  const [tempPoints, setTempPoints] = useState<MissionPoint[]>([]);
  const [open, setOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setTempPoints([...missionPoints]);
      setErrorMsg("");
    }
  };

  const addPoint = () => {
    setTempPoints([...tempPoints, { lat: 0, lng: 0 }]);
  };

  const removePoint = (index: number) => {
    setTempPoints(tempPoints.filter((_, i) => i !== index));
  };

  const updatePoint = (index: number, field: "lat" | "lng", value: string) => {
    const parsed = parseFloat(value);
    const newPoints = [...tempPoints];
    newPoints[index] = { ...newPoints[index], [field]: isNaN(parsed) ? 0 : parsed };
    setTempPoints(newPoints);
  };

  const validateAndSave = () => {
    for (const p of tempPoints) {
      if (p.lat < -90 || p.lat > 90) {
        setErrorMsg("La latitud debe estar entre -90 y 90.");
        return;
      }
      if (p.lng < -180 || p.lng > 180) {
        setErrorMsg("La longitud debe estar entre -180 y 180.");
        return;
      }
    }
    setErrorMsg("");
    setMissionPoints(tempPoints);
    setOpen(false);
  };

  return (
    <section className="map-section flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 px-2">
        <h2 className="text-xl font-bold">Mapa</h2>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="outline">Definir puntos de la mision</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Puntos de la Misión</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {tempPoints.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-semibold">Latitud</label>
                    <Input
                      type="number"
                      step="any"
                      value={p.lat}
                      onChange={(e) => updatePoint(i, "lat", e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-semibold">Longitud</label>
                    <Input
                      type="number"
                      step="any"
                      value={p.lng}
                      onChange={(e) => updatePoint(i, "lng", e.target.value)}
                    />
                  </div>
                  <Button variant="destructive" size="icon" className="mt-5" onClick={() => removePoint(i)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="secondary" onClick={addPoint} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Agregar Punto
              </Button>
              {errorMsg && <p className="text-red-500 text-sm font-semibold">{errorMsg}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={validateAndSave}>Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="map-container flex-grow relative min-h-[300px]">
        <MapView missionPoints={missionPoints} />
      </div>
      <Alert />
      <BatteryStatus />
      <ControlButtons />
    </section>
  );
}

export default MapSection;
