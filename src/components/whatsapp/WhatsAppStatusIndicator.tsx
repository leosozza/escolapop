import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WhatsAppStatusIndicatorProps {
  showLabel?: boolean;
}

export function WhatsAppStatusIndicator({ showLabel = false }: WhatsAppStatusIndicatorProps) {
  const [connectedCount, setConnectedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [prevConnected, setPrevConnected] = useState(0);

  const fetchStatus = async () => {
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('status');

    if (data) {
      const connected = data.filter(d => d.status === 'connected').length;
      
      // Alert on disconnect
      if (prevConnected > 0 && connected === 0 && data.length > 0) {
        toast.error('Todas as instâncias WhatsApp desconectaram!', { duration: 10000 });
      }
      
      setPrevConnected(connected);
      setConnectedCount(connected);
      setTotalCount(data.length);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);

    const channel = supabase
      .channel('whatsapp-instances-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_instances' }, () => {
        fetchStatus();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const isConnected = connectedCount > 0;
  const isPartial = connectedCount > 0 && connectedCount < totalCount;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default">
            {totalCount === 0 ? (
              <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
            ) : isConnected ? (
              <Wifi className={`h-3.5 w-3.5 ${isPartial ? 'text-yellow-500' : 'text-green-500'}`} />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-destructive" />
            )}
            {showLabel && (
              <span className="text-xs text-muted-foreground">
                {totalCount === 0 ? 'Sem instâncias' : `${connectedCount}/${totalCount}`}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">
            WhatsApp: {connectedCount}/{totalCount} instâncias conectadas
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
