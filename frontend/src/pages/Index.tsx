import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MapView, { MissionPoint } from '@/components/MapView';
import SensorPanel from '@/components/SensorPanel';
import StatusBar from '@/components/StatusBar';
import AlertNotification from '@/components/AlertNotification';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Trash2, MapPin, Play, Square, Power, ChevronDown, FileText, Moon, Sun } from "lucide-react";
import ReportGeneratorModal from '@/components/ReportGeneratorModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { dataAPI } from '@/api/gateway';
import { toast } from 'sonner';
import { useIoTData } from '@/contexts/IoTContext';

const Index = () => {
  const navigate = useNavigate();
  const { logout, user, accessToken, fullName, username } = useAuth();
  const { publish } = useIoTData();

  // Guardamos el tiempo transcurrido en segundos y el momento de inicio de misión
  const [elapsedTime, setElapsedTime] = useState(0);
  const [missionStartTime, setMissionStartTime] = useState<number | null>(null);

  // Mission Points State
  const [missionPoints, setMissionPoints] = useState<MissionPoint[]>([]);
  const [isSelectingPoints, setIsSelectingPoints] = useState(false);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [isMissionPaused, setIsMissionPaused] = useState(false);
  const [loadingMission, setLoadingMission] = useState(false);
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }
  };

  useEffect(() => {
    let timer: any;

    if (activeMissionId && missionStartTime && !isMissionPaused) {
      timer = setInterval(() => {
        const now = Date.now();
        const seconds = Math.floor((now - missionStartTime) / 1000);
        setElapsedTime(seconds);
      }, 1000);
    } else if (!activeMissionId) {
      setElapsedTime(0);
      setMissionStartTime(null);
      setIsMissionPaused(false);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeMissionId, missionStartTime]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatElapsed = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Mission Points Handlers
  const handleAddPoint = (lat: number, lng: number) => {
    setMissionPoints(prev => [...prev, { lat, lng }]);
  };

  const removeLastPoint = () => {
    if (activeMissionId) {
      toast.error('No puedes modificar los puntos mientras la misión está en progreso.');
      return;
    }
    setMissionPoints(prev => prev.slice(0, -1));
  };

  const handleStartMission = async () => {
    if (missionPoints.length < 2) {
      toast.error('Necesitas al menos 2 puntos para iniciar la misión.');
      return;
    }

    setLoadingMission(true);
    try {
      const missionName = `Misión HMI ${formatDate(new Date())}`;
      const response = await dataAPI.createMission(missionName, missionPoints, accessToken!);
      setActiveMissionId(response.id);
      setMissionStartTime(Date.now());
      setIsSelectingPoints(false);

      toast.success('Misión iniciada. El sistema guardará la telemetría y el vehículo se pondrá en marcha.');
    } catch (err) {
      console.error(err);
      toast.error('Error al iniciar la misión');
    } finally {
      setLoadingMission(false);
    }
  };

  const handleFinishMission = async () => {
    if (!activeMissionId) return;

    setLoadingMission(true);
    try {
      await dataAPI.finishMission(activeMissionId, accessToken!);
      setActiveMissionId(null);
      setIsMissionPaused(false);
      setMissionPoints([]); // Limpiar mapa
      toast.success('Misión finalizada correctamente.');
    } catch (err) {
      console.error(err);
      toast.error('Error al finalizar la misión');
    } finally {
      setLoadingMission(false);
    }
  };

  const handlePauseMission = async () => {
    if (!activeMissionId) return;
    setLoadingMission(true);
    try {
      await dataAPI.pauseMission(activeMissionId, accessToken!);
      setIsMissionPaused(true);
      toast.info('Misión pausada.');
    } catch (err) {
      console.error(err);
      toast.error('Error al pausar la misión');
    } finally {
      setLoadingMission(false);
    }
  };

  const handleResumeMission = async () => {
    if (!activeMissionId) return;
    setLoadingMission(true);
    try {
      await dataAPI.resumeMission(activeMissionId, accessToken!);
      setIsMissionPaused(false);
      toast.success('Misión reanudada.');
    } catch (err) {
      console.error(err);
      toast.error('Error al reanudar la misión');
    } finally {
      setLoadingMission(false);
    }
  };

  const handleDownloadCSV = async () => {
    if (!accessToken) return;
    setLoadingMission(true);
    try {
      let targetMissionId = activeMissionId;

      if (!targetMissionId) {
        const missions = await dataAPI.getMissions(accessToken);
        const finishedMissions = missions.filter((m: any) => m.status === 'FINALIZADO');
        if (finishedMissions.length > 0) {
          targetMissionId = finishedMissions[0].id;
        }
      }

      if (!targetMissionId) {
        toast.error('No hay ninguna misión disponible para generar el reporte.');
        return;
      }

      toast.info('Generando reporte CSV...');
      const blob = await dataAPI.generateCsvReport(targetMissionId, accessToken);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Reporte_Mision_${targetMissionId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Reporte CSV descargado con éxito.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error al generar el reporte CSV');
    } finally {
      setLoadingMission(false);
    }
  };

  return (
    <div className="min-h-screen overflow-auto p-4 lg:h-screen lg:overflow-hidden lg:p-6 bg-background text-foreground flex flex-col">
      <div className="max-w-[1920px] mx-auto w-full flex-1 lg:h-full flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center mb-2 flex-shrink-0">
          <h1 className="text-2xl font-bold">
            Sistema de Monitoreo de Aguas
          </h1>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm font-medium">
                {fullName || username || user?.username || 'Cargando...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(new Date())}
              </p>
            </div>
            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="icon"
              title={isDarkMode ? "Modo Claro" : "Modo Oscuro"}
            >
              {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
            </Button>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="icon"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              title="Cerrar Sesión"
            >
              <Power className="w-6 h-6" />
            </Button>
          </div>
        </header>

        <Separator className="bg-gray-200 mb-6" />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 lg:overflow-hidden">
          {/* Map Section - Takes 2 columns */}
          <div className="lg:col-span-2 flex flex-col gap-4 lg:overflow-hidden">
            {/* Header for Map */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-shrink-0 px-2 gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <p className="text-sm font-semibold">
                  Tiempo de actividad:{' '}
                  <span className="font-mono text-primary">
                    {formatElapsed(elapsedTime)}
                  </span>
                </p>

                {/* Botón para alternar edición */}
                {isSelectingPoints ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsSelectingPoints(false)}
                    className="bg-blue-600"
                  >
                    Definir ruta
                  </Button>
                ) : (
                  /* Mostrar "Volver a ruta" si hay puntos pero no ha iniciado misión */
                  missionPoints.length > 0 && !activeMissionId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSelectingPoints(true)}
                    >
                      Volver a ruta
                    </Button>
                  )
                )}

                {/* Quitar último punto solo si está editando */}
                {isSelectingPoints && missionPoints.length > 0 && (
                  <Button variant="destructive" size="sm" onClick={removeLastPoint}>
                    <Trash2 className="w-4 h-4 mr-1" /> Quitar último punto
                  </Button>
                )}

                {missionPoints.length >= 2 && !activeMissionId && !isSelectingPoints && (
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleStartMission}
                    disabled={loadingMission}
                  >
                    <Play className="w-4 h-4 mr-2" /> Iniciar Misión
                  </Button>
                )}

                {activeMissionId && (
                  <div className="flex flex-wrap items-center gap-2">
                    {isMissionPaused ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-amber-500 hover:bg-amber-600 text-white border-none"
                        onClick={handleResumeMission}
                        disabled={loadingMission}
                      >
                        <Play className="w-4 h-4 mr-2" /> Reanudar misión
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-amber-500 hover:bg-amber-600 text-white border-none"
                        onClick={handlePauseMission}
                        disabled={loadingMission}
                      >
                        <Play className="w-4 h-4 mr-2" /> Pausar misión
                      </Button>
                    )}

                    <Button
                      variant="default"
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white animate-pulse"
                      onClick={handleFinishMission}
                      disabled={loadingMission}
                    >
                      <Square className="w-4 h-4 mr-2" /> Finalizar Misión
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      Acciones de Misión <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[500]">
                    <DropdownMenuItem
                      onClick={() => setIsSelectingPoints(true)}
                      disabled={activeMissionId !== null || isSelectingPoints}
                    >
                      <MapPin className="w-4 h-4 mr-2" /> Iniciar nueva misión
                    </DropdownMenuItem>
                    <ReportGeneratorModal
                      trigger={
                        <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full">
                          <FileText className="w-4 h-4 mr-2" /> Generar reporte (IA)
                        </div>
                      }
                    />
                    <DropdownMenuItem onClick={handleDownloadCSV} disabled={loadingMission}>
                      <FileText className="w-4 h-4 mr-2" /> Generar archivo (CSV)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className={`relative h-[400px] flex-none lg:h-auto lg:flex-1 lg:min-h-0 border rounded-xl overflow-hidden shadow-sm ${isSelectingPoints ? 'cursor-crosshair' : ''}`}>
              {isSelectingPoints && (
                <div className="absolute top-4 right-4 z-[450] pointer-events-none animate-in fade-in zoom-in duration-300">
                  <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-2xl font-bold border-2 border-white flex items-center gap-3 animate-pulse">
                    <MapPin className="w-5 h-5" />
                    <span>Modo Edición: Haz clic en el mapa para añadir puntos</span>
                  </div>
                </div>
              )}

              <MapView
                missionPoints={missionPoints}
                isSelectingPoints={isSelectingPoints}
                onAddPoint={handleAddPoint}
              />
              <AlertNotification />
            </div>
            <div className="flex-shrink-0">
              <StatusBar />
            </div>
          </div>

          {/* Sensor Panel - Takes 1 column */}
          <div className="lg:col-span-1 lg:overflow-hidden pb-6 lg:pb-0">
            <SensorPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;