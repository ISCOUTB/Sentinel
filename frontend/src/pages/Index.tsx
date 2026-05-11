import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MapView, { MissionPoint } from '@/components/MapView';
import SensorPanel from '@/components/SensorPanel';
import StatusBar from '@/components/StatusBar';
import AlertNotification from '@/components/AlertNotification';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Trash2, MapPin, Play, Square } from "lucide-react";
import ReportGeneratorModal from '@/components/ReportGeneratorModal';
import { dataAPI } from '@/api/gateway';
import { toast } from 'sonner';
import { useIoTData } from '@/contexts/IoTContext';

const Index = () => {
  const navigate = useNavigate();
  const { logout, user, accessToken } = useAuth();
  const { publish } = useIoTData();

  // Guardamos el tiempo transcurrido en segundos
  const [elapsedTime, setElapsedTime] = useState(0);

  // Mission Points State
  const [missionPoints, setMissionPoints] = useState<MissionPoint[]>([]);
  const [isSelectingPoints, setIsSelectingPoints] = useState(false);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [loadingMission, setLoadingMission] = useState(false);

  useEffect(() => {
    const startTime = Date.now(); // Marca el momento en que se abre el HMI

    const timer = setInterval(() => {
      const now = Date.now();
      const seconds = Math.floor((now - startTime) / 1000);
      setElapsedTime(seconds);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

  const clearPoints = () => {
    if (activeMissionId) {
      toast.error('No puedes limpiar los puntos mientras la misión está en progreso.');
      return;
    }
    setMissionPoints([]);
  };

  const handleStartMission = async () => {
    if (missionPoints.length < 2) {
      toast.error('Necesitas al menos 2 puntos para iniciar la misión.');
      return;
    }
    
    setLoadingMission(true);
    try {
      const missionName = `Misión HMI ${formatDate(new Date())}`;
      const response = await dataAPI.createMission(missionName, accessToken!);
      setActiveMissionId(response.id);
      setIsSelectingPoints(false);
      
      // Publicar los waypoints al tópico MQTT
      const waypointsTopic = `${import.meta.env.VITE_IOT_THING_NAME || 'USV-001'}/waypoints`;
      await publish(waypointsTopic, {
        mission_id: response.id,
        points: missionPoints
      });

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
      toast.success('Misión finalizada correctamente.');
    } catch (err) {
      console.error(err);
      toast.error('Error al finalizar la misión');
    } finally {
      setLoadingMission(false);
    }
  };

  return (
    <div className="h-screen bg-background text-foreground p-4 flex flex-col overflow-hidden">
      <div className="max-w-[1920px] mx-auto w-full h-full flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center mb-4 flex-shrink-0">
          <h1 className="text-2xl font-bold">
            Sistema de Monitoreo de Aguas
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                Usuario: {user?.username || 'Cargando...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(new Date())}
              </p>
              <p className="text-sm font-semibold">
                Tiempo de actividad:{' '}
                <span className="font-mono text-primary">
                  {formatElapsed(elapsedTime)}
                </span>
              </p>
            </div>
            <ReportGeneratorModal />
            <Button onClick={handleLogout} variant="outline">
              Cerrar Sesión
            </Button>
          </div>
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 overflow-hidden">
          {/* Map Section - Takes 2 columns */}
          <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
            {/* Header for Map */}
            <div className="flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold">Mapa</h2>
                <Button 
                  variant={isSelectingPoints ? "default" : "secondary"} 
                  size="sm"
                  onClick={() => setIsSelectingPoints(!isSelectingPoints)}
                  disabled={activeMissionId !== null}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  {isSelectingPoints ? "Terminar Edición" : "Definir puntos de la mision"}
                </Button>
                {missionPoints.length > 0 && (
                  <Button variant="destructive" size="sm" onClick={clearPoints} disabled={activeMissionId !== null}>
                    <Trash2 className="w-4 h-4 mr-2" /> Limpiar Puntos
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
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="bg-red-600 hover:bg-red-700 text-white animate-pulse"
                    onClick={handleFinishMission}
                    disabled={loadingMission}
                  >
                    <Square className="w-4 h-4 mr-2" /> Finalizar Misión
                  </Button>
                )}
              </div>
              {isSelectingPoints && (
                <span className="text-sm text-primary font-semibold animate-pulse">
                  Haz clic en el mapa para añadir puntos
                </span>
              )}
            </div>

            <div className={`relative flex-1 min-h-0 border rounded-xl overflow-hidden shadow-sm ${isSelectingPoints ? 'cursor-crosshair' : ''}`}>
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
          <div className="lg:col-span-1 overflow-hidden">
            <SensorPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;