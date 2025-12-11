import { useState, useEffect } from 'react';
import MapView from '@/components/MapView';
import SensorPanel from '@/components/SensorPanel';
import StatusBar from '@/components/StatusBar';
import AlertNotification from '@/components/AlertNotification';

const Index = () => {
  // Guardamos el tiempo transcurrido en segundos
  const [elapsedTime, setElapsedTime] = useState(0);

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

  return (
    <div className="h-screen bg-background text-foreground p-4 flex flex-col overflow-hidden">
      <div className="max-w-[1920px] mx-auto w-full h-full flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center mb-4 flex-shrink-0">
          <h1 className="text-2xl font-bold">
            Sistema de Monitoreo de Aguas
          </h1>
          <div className="text-right">
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
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 overflow-hidden">
          {/* Map Section - Takes 2 columns */}
          <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 min-h-0">
              <MapView />
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

      {/* Alert Notification */}
      <AlertNotification />
    </div>
  );
};

export default Index;