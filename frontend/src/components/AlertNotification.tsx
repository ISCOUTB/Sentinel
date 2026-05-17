import { AlertTriangle, Info, Lock, AlertOctagon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useIoTData } from '@/contexts/IoTContext';
import { LogEntry } from '@/types/iot.types';

// ─── Configuración visual por nivel ──────────────────────────────────────────

const levelConfig = {
  ERROR: {
    bg: 'bg-background border-l-red-500 border-border',
    icon: AlertOctagon,
    iconBg: 'bg-red-500',
    iconColor: 'text-white',
  },
  WARN: {
    bg: 'bg-background border-l-amber-500 border-border',
    icon: AlertTriangle,
    iconBg: 'bg-amber-500',
    iconColor: 'text-white',
  },
  INFO: {
    bg: 'bg-background border-l-primary border-border',
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

  // Temporizador para cerrar la alerta automáticamente después de 8 segundos
  useEffect(() => {
    let timer: any;
    if (visibleLog) {
      timer = setTimeout(() => {
        setDismissedId(visibleLog.log_id);
        setVisibleLog(null);
      }, 8000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visibleLog]);

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
        className={`${config.bg} border border-l-4 rounded-lg p-3 sm:p-4 flex items-start gap-2 sm:gap-3 w-[calc(100vw-32px)] sm:w-auto sm:min-w-[320px] max-w-[420px] shadow-2xl`}
      >
        {/* Ícono */}
        <div
          className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full shrink-0 ${config.iconBg}`}
        >
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${config.iconColor}`} />
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1 gap-2">
            <h4 className="font-semibold text-sm sm:text-base text-foreground truncate">
              [{visibleLog.nivel}] — Código {visibleLog.codigo}
            </h4>
            <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{timeLabel}</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-2">
            {visibleLog.mensaje}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3">USV: {visibleLog.usv_id}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            className="h-7 text-xs sm:h-9 sm:text-sm gap-1 sm:gap-2"
          >
            <Lock className="w-3 h-3" />
            Cerrar Alerta
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AlertNotification;
