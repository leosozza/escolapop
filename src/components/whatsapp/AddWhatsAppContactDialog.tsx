import { useState, useEffect } from 'react';
import { Loader2, Search, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Agent {
  id: string;
  full_name: string;
  is_active: boolean;
}

interface AddWhatsAppContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddWhatsAppContactDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddWhatsAppContactDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('manual');
  const [isLoading, setIsLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);

  // Manual form state
  const [guardianName, setGuardianName] = useState('');
  const [modelName, setModelName] = useState('');
  const [phone, setPhone] = useState('');
  const [agentId, setAgentId] = useState('');
  const [externalCode, setExternalCode] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAgents();
    }
  }, [open]);

  const fetchAgents = async () => {
    const { data } = await supabase
      .from('agents')
      .select('id, full_name, is_active')
      .eq('is_active', true)
      .order('full_name');

    setAgents(data || []);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const query = searchQuery.toLowerCase();
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, guardian_name, phone, external_id, status')
        .or(`full_name.ilike.%${query}%,external_id.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectExisting = async (leadId: string) => {
    setIsLoading(true);
    try {
      // Update status to agendado if needed
      const { error } = await supabase
        .from('leads')
        .update({ status: 'agendado' })
        .eq('id', leadId);

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível selecionar o contato.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!modelName.trim() || !phone.trim() || !agentId) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha o nome do modelo, telefone e agente.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('leads').insert({
        full_name: modelName.trim(),
        guardian_name: guardianName.trim() || null,
        phone: phone.replace(/\D/g, ''),
        assigned_agent_id: agentId,
        external_id: externalCode.trim() || null,
        external_source: externalCode ? 'bitrix' : null,
        status: 'agendado',
        source: 'whatsapp',
      });

      if (error) throw error;

      // Reset form
      setGuardianName('');
      setModelName('');
      setPhone('');
      setAgentId('');
      setExternalCode('');

      onSuccess();
    } catch (error: any) {
      console.error('Error creating contact:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar contato',
        description: error.message || 'Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setGuardianName('');
    setModelName('');
    setPhone('');
    setAgentId('');
    setExternalCode('');
    setSearchQuery('');
    setSearchResults([]);
    setActiveTab('manual');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Contato WhatsApp</DialogTitle>
          <DialogDescription>
            Busque um cliente existente ou adicione manualmente
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">
              <UserPlus className="h-4 w-4 mr-2" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="search">
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Mãe/Responsável</Label>
                <Input
                  placeholder="Nome do responsável"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Nome do Modelo <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Nome completo"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Telefone <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Código Bitrix</Label>
                <Input
                  placeholder="ID externo (opcional)"
                  value={externalCode}
                  onChange={(e) => setExternalCode(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Agente de Relacionamento <span className="text-destructive">*</span>
              </Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o agente" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleManualSubmit} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Adicionar Contato
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="search" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone ou código Bitrix..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Buscar'
                )}
              </Button>
            </div>

            <div className="min-h-[200px] max-h-[300px] overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? 'Nenhum resultado encontrado'
                    : 'Digite para buscar clientes'}
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="p-3 rounded-lg border hover:border-primary cursor-pointer transition-colors"
                      onClick={() => handleSelectExisting(result.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{result.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {result.phone}
                            {result.external_id && ` • ${result.external_id}`}
                          </p>
                        </div>
                        <Button size="sm" variant="outline">
                          Selecionar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
