import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WhatsAppStatusIndicatorProps {
  showLabel?: boolean;
}

export function WhatsAppStatusIndicator({ showLabel = false }: WhatsAppStatusIndicatorProps) {
  const [status, setStatus] = useState<string>('unknown');
  const [lastError, setLastError] = useState<string | null>(null);

  const fetchStatus = async () => {
    const { data } = await supabase
      .from('whatsapp_session')
      .select('status, last_error')
      .limit(1)
      .maybeSingle();

    if (data) {
      const prevStatus = status;
      setStatus(data.status);
      setLastError(data.last_error);

      // Alert on disconnect
      if (prevStatus === 'connected' && data.status === 'disconnected') {
        toast.error('WhatsApp desconectado! Verifique em Configurações.', { duration: 10000 });
      }
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Check every 30s

    // Realtime subscription for immediate updates
    const channel = supabase
      .channel('whatsapp-session-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_session' }, (payload) => {
        const newData = payload.new as { status: string; last_error: string | null };
        if (newData) {
          if (status === 'connected' && newData.status === 'disconnected') {
            toast.error('WhatsApp desconectado! Verifique em Configurações.', { duration: 10000 });
          }
          setStatus(newData.status);
          setLastError(newData.last_error);
        }
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'waiting_qr';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default">
            {isConnecting ? (
              <Loader2 className="h-3.5 w-3.5 text-warning animate-spin" />
            ) : isConnected ? (
              <Wifi className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-destructive" />
            )}
            {showLabel && (
              <span className="text-xs text-muted-foreground">
                {isConnected ? 'Online' : isConnecting ? 'Conectando...' : 'Offline'}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">
            WhatsApp: {isConnected ? 'Conectado' : isConnecting ? 'Conectando...' : 'Desconectado'}
          </p>
          {lastError && <p className="text-xs text-muted-foreground">{lastError}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
