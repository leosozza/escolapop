import { useState, useEffect } from 'react';
import { Wifi, WifiOff, QrCode, RefreshCcw, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function WhatsAppSettings() {
  const [status, setStatus] = useState<string>('unknown');
  const [lastError, setLastError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const fetchSessionStatus = async () => {
    const { data } = await supabase
      .from('whatsapp_session')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (data) {
      setStatus(data.status);
      setLastError(data.last_error);
      setQrCode(data.qr_code);
    }
  };

  useEffect(() => {
    fetchSessionStatus();
    const channel = supabase
      .channel('whatsapp-session-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_session' }, () => {
        fetchSessionStatus();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleCheckStatus = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: { action: 'check-status' },
      });
      if (error) throw error;
      toast.success(data?.connected ? 'WhatsApp conectado!' : 'WhatsApp desconectado.');
      await fetchSessionStatus();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao verificar status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('whatsapp-api', {
        body: { action: 'connect' },
      });
      if (error) throw error;

      // Wait a moment then fetch QR
      await new Promise(r => setTimeout(r, 2000));
      const { data: qrData } = await supabase.functions.invoke('whatsapp-api', {
        body: { action: 'get-qr' },
      });
      if (qrData?.QRCode) {
        setQrCode(qrData.QRCode);
        setStatus('waiting_qr');
        toast.info('Escaneie o QR Code com seu WhatsApp');
      } else {
        toast.success('Sessão conectada!');
      }
      await fetchSessionStatus();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao conectar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await supabase.functions.invoke('whatsapp-api', {
        body: { action: 'disconnect' },
      });
      toast.success('WhatsApp desconectado');
      await fetchSessionStatus();
    } catch {
      toast.error('Erro ao desconectar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetQR = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.functions.invoke('whatsapp-api', {
        body: { action: 'get-qr' },
      });
      if (data?.QRCode) {
        setQrCode(data.QRCode);
        toast.info('QR Code atualizado! Escaneie com o WhatsApp.');
      } else {
        toast.warning('QR Code não disponível. Tente conectar primeiro.');
      }
    } catch {
      toast.error('Erro ao obter QR Code');
    } finally {
      setIsLoading(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success('URL copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'waiting_qr';

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {isConnected ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-destructive" />
                )}
                Status da Conexão
              </CardTitle>
              <CardDescription>Gerencie a conexão com o WhatsApp</CardDescription>
            </div>
            <Badge variant={isConnected ? 'default' : 'destructive'} className={isConnected ? 'bg-green-600' : ''}>
              {isConnected ? 'Conectado' : isConnecting ? 'Conectando...' : 'Desconectado'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <strong>Último erro:</strong> {lastError}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleCheckStatus} variant="outline" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
              Verificar Status
            </Button>
            {!isConnected && (
              <Button onClick={handleConnect} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
                Conectar
              </Button>
            )}
            {isConnected && (
              <Button onClick={handleDisconnect} variant="destructive" disabled={isLoading}>
                <WifiOff className="h-4 w-4 mr-2" />
                Desconectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* QR Code Card */}
      {!isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code
            </CardTitle>
            <CardDescription>Escaneie com o WhatsApp do celular para conectar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {qrCode ? (
              <div className="flex justify-center p-6 bg-white rounded-lg border">
                <img src={`data:image/png;base64,${qrCode}`} alt="QR Code WhatsApp" className="w-64 h-64" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-muted/30 rounded-lg border border-dashed">
                <QrCode className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">Clique abaixo para gerar o QR Code</p>
              </div>
            )}
            <Button onClick={handleGetQR} variant="outline" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
              {qrCode ? 'Atualizar QR Code' : 'Gerar QR Code'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Webhook Config */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook para Receber Mensagens</CardTitle>
          <CardDescription>
            Configure esta URL no painel da WuzAPI para receber mensagens automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>URL do Webhook</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cole esta URL no campo de webhook da WuzAPI para receber mensagens inbound automaticamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
