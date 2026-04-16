import { AlertTriangle, Info, Lock, AlertOctagon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useIoTData } from '@/contexts/IoTContext';
import { LogEntry } from '@/types/iot.types';

// ─── Configuración visual por nivel ──────────────────────────────────────────

const levelConfig = {
  ERROR: {
    bg: 'bg-red-500/10 border-red-500',
    icon: AlertOctagon,
    iconBg: 'bg-red-500',
    iconColor: 'text-white',
  },
  WARN: {
    bg: 'bg-amber-500/10 border-amber-500',
    icon: AlertTriangle,
    iconBg: 'bg-amber-500',
    iconColor: 'text-white',
  },
  INFO: {
    bg: 'bg-primary/10 border-primary',
    icon: Info,
    iconBg: 'bg-primary',
    iconColor: 'text-primary-foreground',
  },
} as const;

// ─── Componente ───────────────────────────────────────────────────────────────

const AlertNotification = () => {
  const { logs } = useIoTData();

  // Guardamos el log actualmente visible y si fue dismisseado
  const [visibleLog, setVisibleLog] = useState<LogEntry | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  // Cuando llega un log nuevo de nivel WARN o ERROR, mostrarlo
  useEffect(() => {
    const latest = logs[0];
    if (!latest) return;
    if (latest.nivel === 'INFO') return; // INFO no genera alerta
    if (latest.log_id === dismissedId) return; // ya fue cerrada

    setVisibleLog(latest);
  }, [logs, dismissedId]);

  const handleDismiss = () => {
    if (visibleLog) setDismissedId(visibleLog.log_id);
    setVisibleLog(null);
  };

  if (!visibleLog) return null;

  const nivel = visibleLog.nivel as keyof typeof levelConfig;
  const config = levelConfig[nivel] ?? levelConfig.INFO;
  const Icon = config.icon;

  const timeLabel = new Date(visibleLog.timestamp_utc).toLocaleTimeString();

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div
        className={`${config.bg} border-2 rounded-lg p-4 flex items-start gap-3 min-w-[320px] max-w-[420px] shadow-lg`}
      >
        {/* Ícono */}
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${config.iconBg}`}
        >
          <Icon className={`w-5 h-5 ${config.iconColor}`} />
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1 gap-2">
            <h4 className="font-semibold text-foreground truncate">
              [{visibleLog.nivel}] — Código {visibleLog.codigo}
            </h4>
            <span className="text-xs text-muted-foreground shrink-0">{timeLabel}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {visibleLog.mensaje}
          </p>
          <p className="text-xs text-muted-foreground mb-3">USV: {visibleLog.usv_id}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            className="gap-2"
          >
            <Lock className="w-3 h-3" />
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AlertNotification;
