import { useState, useEffect } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface TeamMember {
  id: string;
  full_name: string;
  sector: string;
  avatar_url: string | null;
}

interface Lead {
  id: string;
  full_name: string;
  phone: string;
  guardian_name: string | null;
  status: string;
}

interface AddStudioSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producers: TeamMember[];
  selectedDate: Date;
  onSuccess: () => void;
}

export function AddStudioSessionDialog({
  open,
  onOpenChange,
  producers,
  selectedDate,
  onSuccess,
}: AddStudioSessionDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [producerId, setProducerId] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [code, setCode] = useState('');
  const [plan, setPlan] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchAvailableLeads();
      // Generate a random code
      setCode(String(Math.floor(100000 + Math.random() * 900000)));
    }
  }, [open]);

  const fetchAvailableLeads = async () => {
    try {
      // Fetch leads with status 'fechado' that can go to studio
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, phone, guardian_name, status')
        .eq('status', 'fechado')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAvailableLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  const filteredLeads = availableLeads.filter(
    (lead) =>
      lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery)
  );

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLead) {
      toast({
        variant: 'destructive',
        title: 'Cliente obrigatório',
        description: 'Selecione um cliente para a sessão.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('studio_sessions').insert({
        lead_id: selectedLead.id,
        session_date: format(selectedDate, 'yyyy-MM-dd'),
        check_in_time: checkInTime || null,
        producer_id: producerId || null,
        code: code || null,
        plan: plan || null,
        status: 'a_ver',
      });

      if (error) throw error;

      toast({
        title: 'Sessão criada',
        description: `${selectedLead.full_name} foi adicionado ao studio.`,
      });

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating studio session:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar sessão',
        description: 'Não foi possível criar a sessão.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedLead(null);
    setProducerId('');
    setCheckInTime('');
    setCode('');
    setPlan('');
    setSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Cliente ao Studio</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Lead Selection */}
          <div className="space-y-2">
            <Label>Cliente (Fechado) *</Label>
            {selectedLead ? (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(selectedLead.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{selectedLead.full_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedLead.phone}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLead(null)}
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-48 border rounded-lg">
                  {filteredLeads.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Nenhum cliente fechado encontrado
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {filteredLeads.map((lead) => (
                        <button
                          key={lead.id}
                          type="button"
                          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                          onClick={() => setSelectedLead(lead)}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getInitials(lead.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{lead.full_name}</p>
                            <p className="text-xs text-muted-foreground">{lead.phone}</p>
                          </div>
                          <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600">
                            Fechado
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Producer Selection */}
          <div className="space-y-2">
            <Label>Produtor</Label>
            <Select value={producerId} onValueChange={setProducerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produtor" />
              </SelectTrigger>
              <SelectContent>
                {producers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time and Code */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Horário Check-in</Label>
              <Input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Código</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
            </div>
          </div>

          {/* Plan */}
          <div className="space-y-2">
            <Label>Plano</Label>
            <Input
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="Ex: POP 1 12X"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !selectedLead}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
