import { useState } from 'react';
import {
  MessageCircle,
  Phone,
  User,
  Users,
  Calendar,
  ExternalLink,
  Edit3,
  Save,
  X,
  Clock,
  Tag,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tables } from '@/integrations/supabase/types';

type LeadStatus = Tables<'leads'>['status'];

interface Agent {
  id: string;
  full_name: string;
}

interface WhatsAppContact {
  id: string;
  full_name: string;
  guardian_name: string | null;
  phone: string;
  email: string | null;
  source: string;
  status: LeadStatus;
  external_id: string | null;
  external_source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assigned_agent_id: string | null;
  agent?: Agent | null;
}

interface WhatsAppConversationProps {
  contact: WhatsAppContact;
  onStatusChange: (contactId: string, newStatus: LeadStatus) => void;
  onOpenWhatsApp: () => void;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'lead', label: 'Novo Lead', color: 'bg-blue-500' },
  { value: 'em_atendimento', label: 'Em Atendimento', color: 'bg-yellow-500' },
  { value: 'agendado', label: 'Agendado', color: 'bg-purple-500' },
  { value: 'confirmado', label: 'Confirmado', color: 'bg-green-500' },
  { value: 'compareceu', label: 'Compareceu', color: 'bg-emerald-600' },
  { value: 'proposta', label: 'Proposta', color: 'bg-orange-500' },
  { value: 'perdido', label: 'Perdido', color: 'bg-destructive' },
];

export function WhatsAppConversation({
  contact,
  onStatusChange,
  onOpenWhatsApp,
}: WhatsAppConversationProps) {
  const { toast } = useToast();
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState(contact.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ notes })
        .eq('id', contact.id);

      if (error) throw error;

      toast({
        title: 'Notas salvas',
        description: 'As observações foram atualizadas.',
      });
      setIsEditingNotes(false);
    } catch (error) {
      console.error('Error saving notes:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatPhoneForDisplay = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const currentStatusConfig = STATUS_OPTIONS.find((s) => s.value === contact.status);

  return (
    <Card className="flex-1 flex flex-col border-0 shadow-md">
      {/* Header */}
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
              {contact.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div>
              <CardTitle className="text-xl">{contact.full_name}</CardTitle>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {formatPhoneForDisplay(contact.phone)}
                </span>
                {contact.external_id && (
                  <span className="flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" />
                    {contact.external_id}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={onOpenWhatsApp}
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            Abrir WhatsApp
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-6 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Status/Tabulação */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tabulação do Atendimento
                </h3>
                <Badge
                  className={cn(
                    'text-white',
                    currentStatusConfig?.color || 'bg-muted'
                  )}
                >
                  {currentStatusConfig?.label || contact.status}
                </Badge>
              </div>
              <Select
                value={contact.status}
                onValueChange={(value) => onStatusChange(contact.id, value as LeadStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Alterar tabulação" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn('h-2.5 w-2.5 rounded-full', status.color)} />
                        {status.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Informações do Contato */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Nome da Mãe/Responsável
                </p>
                <p className="font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {contact.guardian_name || 'Não informado'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Agente de Relacionamento
                </p>
                <p className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {contact.agent?.full_name || 'Não atribuído'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Origem
                </p>
                <p className="font-medium capitalize">{contact.source}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Cadastrado em
                </p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(contact.created_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>

            {/* Código Externo */}
            {contact.external_id && (
              <div className="p-4 rounded-lg border border-dashed">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Código Bitrix / ID Externo
                </p>
                <p className="font-mono text-lg font-semibold text-primary">
                  {contact.external_id}
                </p>
                {contact.external_source && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Fonte: {contact.external_source}
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Notas/Observações */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Edit3 className="h-4 w-4" />
                  Observações do Atendimento
                </h3>
                {!isEditingNotes ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingNotes(true)}
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNotes(contact.notes || '');
                        setIsEditingNotes(false);
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={isSaving}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Salvar
                    </Button>
                  </div>
                )}
              </div>

              {isEditingNotes ? (
                <Textarea
                  placeholder="Adicione observações sobre este atendimento..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
              ) : (
                <div className="p-4 rounded-lg bg-muted/30 min-h-[120px]">
                  {contact.notes ? (
                    <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Nenhuma observação registrada
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Timeline de Status */}
            <div>
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4" />
                Histórico de Atualizações
              </h3>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3 text-sm">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Última atualização:</span>
                  <span className="font-medium">
                    {format(new Date(contact.updated_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
