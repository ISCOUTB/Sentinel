import { Battery, Activity } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const StatusBar = () => {
  const batteryLevel = 78;
  const hoursLeft = 3;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Battery Status */}
      <Card className="p-4 bg-card border-border">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Battery className="w-4 h-4 text-accent" />
            Battery
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          {batteryLevel}% On battery, {hoursLeft} hours left
        </p>
        <Progress value={batteryLevel} className="h-2" />
      </Card>

      {/* Estados */}
      <Card className="p-4 bg-card border-border">
        <h3 className="text-sm font-semibold mb-2">Estados</h3>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent animate-pulse"></div>
          <span className="text-xs text-muted-foreground">Activo</span>
        </div>
      </Card>

      {/* Actividad */}
      <Card className="p-4 bg-card border-border">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Actividad
        </h3>
        <div className="text-xs text-muted-foreground">
          Monitoreo en curso
        </div>
      </Card>
    </div>
  );
};

export default StatusBar;
