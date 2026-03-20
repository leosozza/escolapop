import { useState, useEffect } from 'react';
import { Wifi, WifiOff, QrCode, RefreshCcw, Loader2, Copy, CheckCircle2, Plus, Trash2, Users, Shield, Bug, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { WhatsAppInstanceAccessDialog } from './WhatsAppInstanceAccessDialog';

interface Instance {
  id: string;
  name: string;
  connection_type: string;
  status: string;
  phone_number: string | null;
  qr_code: string | null;
  last_error: string | null;
  updated_at: string;
}

export function WhatsAppSettings() {
  const { hasRole } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('qrcode');
  const [creating, setCreating] = useState(false);
  const [accessDialogInstance, setAccessDialogInstance] = useState<Instance | null>(null);
  const [copied, setCopied] = useState(false);

  const canManage = hasRole('admin') || hasRole('gestor');
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const fetchInstances = async () => {
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .order('created_at', { ascending: false });
    setInstances((data as Instance[]) || []);
  };

  useEffect(() => {
    fetchInstances();
    const channel = supabase
      .channel('whatsapp-instances-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_instances' }, () => {
        fetchInstances();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const setLoading = (id: string, val: boolean) =>
    setIsLoading(prev => ({ ...prev, [id]: val }));

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: { action: 'create-instance', name: newName, connectionType: newType },
      });
      if (error) throw error;
      toast.success(`Instância "${newName}" criada!`);
      setShowCreateDialog(false);
      setNewName('');
      await fetchInstances();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar instância');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (inst: Instance) => {
    if (!confirm(`Excluir instância "${inst.name}"? Esta ação é irreversível.`)) return;
    setLoading(inst.id, true);
    try {
      await supabase.functions.invoke('whatsapp-api', {
        body: { action: 'delete-instance', instanceId: inst.id },
      });
      toast.success('Instância excluída');
      await fetchInstances();
    } catch {
      toast.error('Erro ao excluir');
    } finally {
      setLoading(inst.id, false);
    }
  };

  const handleAction = async (inst: Instance, action: string) => {
    setLoading(inst.id, true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: { action, instanceId: inst.id },
      });
      if (error) throw error;

      if (action === 'connect') {
        // Wait and fetch QR
        await new Promise(r => setTimeout(r, 2000));
        const { data: qrData } = await supabase.functions.invoke('whatsapp-api', {
          body: { action: 'get-qr', instanceId: inst.id },
        });
        if (qrData?.QRCode) {
          toast.info('Escaneie o QR Code com seu WhatsApp');
        } else {
          toast.success('Sessão conectada!');
        }
      } else if (action === 'check-status') {
        toast.success(data?.connected ? 'Conectado!' : 'Desconectado.');
      } else if (action === 'disconnect') {
        toast.success('Desconectado');
      } else if (action === 'get-qr') {
        if (data?.QRCode) {
          toast.info('QR Code atualizado!');
        } else {
          toast.warning('QR Code não disponível. Tente conectar primeiro.');
        }
      }

      await fetchInstances();
    } catch (err) {
      console.error(err);
      toast.error('Erro na operação');
    } finally {
      setLoading(inst.id, false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success('URL copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Instâncias WhatsApp</h3>
          <p className="text-sm text-muted-foreground">Gerencie suas conexões WhatsApp via WuzAPI</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Instância
          </Button>
        )}
      </div>

      {/* Instances List */}
      {instances.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <QrCode className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma instância configurada</p>
            {canManage && (
              <Button variant="outline" className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira instância
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {instances.map(inst => {
            const loading = isLoading[inst.id] || false;
            const isConnected = inst.status === 'connected';
            const isConnecting = inst.status === 'connecting' || inst.status === 'waiting_qr';

            return (
              <Card key={inst.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-destructive'}`} />
                      <div>
                        <CardTitle className="text-base">{inst.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {inst.connection_type === 'qrcode' ? 'QR Code' : 'Oficial'}
                          </Badge>
                          {inst.phone_number && (
                            <span className="text-xs">{inst.phone_number}</span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={isConnected ? 'default' : 'destructive'} className={isConnected ? 'bg-green-600' : ''}>
                      {isConnected ? 'Conectado' : isConnecting ? 'Conectando...' : 'Desconectado'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {inst.last_error && (
                    <div className="p-2 rounded bg-destructive/10 text-xs text-destructive">
                      <strong>Erro:</strong> {inst.last_error}
                    </div>
                  )}

                  {/* QR Code display */}
                  {!isConnected && inst.qr_code && (
                    <div className="flex justify-center p-4 bg-white rounded-lg border">
                      <img
                        src={inst.qr_code.startsWith('data:') ? inst.qr_code : `data:image/png;base64,${inst.qr_code}`}
                        alt="QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleAction(inst, 'check-status')} disabled={loading}>
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCcw className="h-3.5 w-3.5 mr-1" />}
                      Status
                    </Button>

                    {!isConnected && (
                      <>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleAction(inst, 'connect')} disabled={loading}>
                          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Wifi className="h-3.5 w-3.5 mr-1" />}
                          Conectar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleAction(inst, 'get-qr')} disabled={loading}>
                          <QrCode className="h-3.5 w-3.5 mr-1" />
                          QR Code
                        </Button>
                      </>
                    )}

                    {isConnected && (
                      <Button variant="outline" size="sm" onClick={() => handleAction(inst, 'disconnect')} disabled={loading}>
                        <WifiOff className="h-3.5 w-3.5 mr-1" />
                        Desconectar
                      </Button>
                    )}

                    {canManage && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setAccessDialogInstance(inst)}>
                          <Users className="h-3.5 w-3.5 mr-1" />
                          Acessos
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(inst)} disabled={loading}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Excluir
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Separator />

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook para Receber Mensagens</CardTitle>
          <CardDescription>Configurado automaticamente ao criar instâncias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Instance Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Instância WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input
                placeholder="Ex: Comercial, Acadêmico, Suporte..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Conexão</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qrcode">QR Code</SelectItem>
                  <SelectItem value="oficial">API Oficial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar Instância
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Access Management Dialog */}
      {accessDialogInstance && (
        <WhatsAppInstanceAccessDialog
          instance={accessDialogInstance}
          open={!!accessDialogInstance}
          onOpenChange={(open) => !open && setAccessDialogInstance(null)}
        />
      )}
    </div>
  );
}
