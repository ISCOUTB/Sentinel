import { AlertTriangle, Lock } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const AlertNotification = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-fade-in">
      <div className="bg-warning/10 border-2 border-warning rounded-lg p-4 flex items-start gap-3 min-w-[320px] shadow-lg">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-warning">
          <AlertTriangle className="w-5 h-5 text-warning-foreground" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-start justify-between mb-1">
            <h4 className="font-semibold text-foreground">Alert title</h4>
            <span className="text-xs text-muted-foreground">09:10:46</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Alert message that can be s...
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsVisible(false)}
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
