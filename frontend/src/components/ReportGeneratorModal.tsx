import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { dataAPI } from '@/api/gateway';
import { FileText } from 'lucide-react';

export default function ReportGeneratorModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMissions, setLoadingMissions] = useState(false);
  const [error, setError] = useState('');
  const [missions, setMissions] = useState<any[]>([]);
  const [selectedMission, setSelectedMission] = useState('');
  const { accessToken } = useAuth();
  
  useEffect(() => {
    if (isOpen && accessToken) {
      fetchMissions();
    }
  }, [isOpen, accessToken]);

  const fetchMissions = async () => {
    try {
      setLoadingMissions(true);
      const data = await dataAPI.getMissions(accessToken!);
      setMissions(data);
      if (data.length > 0) {
        const firstFinished = data.find((m: any) => m.status === 'FINALIZADO');
        setSelectedMission(firstFinished ? firstFinished.id : data[0].id);
      }
    } catch (err) {
      console.error('Failed to load missions', err);
      setError('Error al cargar misiones');
    } finally {
      setLoadingMissions(false);
    }
  };

  const handleGenerate = async () => {
    if (!accessToken || !selectedMission) return;
    
    setLoading(true);
    setError('');
    
    try {
      const blob = await dataAPI.generateReport(
        selectedMission, 
        accessToken
      );
      
      // Crear URL para el blob y descargar
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      // Nombre del archivo de descarga
      a.download = `Reporte_IA_Mision_${selectedMission}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Limpiar
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setIsOpen(false);
    } catch (err: any) {
      setError(err.message || 'Error al generar el reporte');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2">
          <FileText className="w-4 h-4" /> Generar Reporte IA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generador de Reportes con IA</DialogTitle>
          <DialogDescription>
            Selecciona una misión finalizada para generar un análisis avanzado de los sensores y gráficos de tendencias en PDF.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Misión</label>
            {loadingMissions ? (
              <p className="text-sm text-muted-foreground">Cargando misiones...</p>
            ) : missions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay misiones disponibles.</p>
            ) : (
              <select 
                value={selectedMission} 
                onChange={(e) => setSelectedMission(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                {missions.map((m) => (
                  <option key={m.id} value={m.id} disabled={m.status !== 'FINALIZADO'}>
                    {m.name} ({new Date(m.start_time).toLocaleDateString()}) - {m.status}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={loading || missions.length === 0 || !selectedMission} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Generando PDF...' : 'Generar PDF'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
