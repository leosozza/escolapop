import { useState } from 'react';
import {
  MessageCircle,
  Phone,
  GraduationCap,
  User,
  RefreshCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { openWhatsApp, getWhatsAppLink } from '@/lib/whatsapp';

interface AcademicContact {
  id: string;
  lead_id: string;
  full_name: string;
  phone: string;
  status: string;
  course_name: string | null;
  class_name: string | null;
  referral_agent_code: string | null;
  enrollment_type: string | null;
  updated_at: string;
  absences_count: number;
}

interface AcademicConversationPanelProps {
  contact: AcademicContact;
  onStatusChange: (enrollmentId: string, newStatus: string) => void;
  operatorName: string;
}

const ACADEMIC_STATUSES = [
  { value: 'ativo', label: 'Matriculado', description: 'Aguardando início das aulas' },
  { value: 'em_curso', label: 'Em Curso', description: 'Estudando ativamente' },
  { value: 'evasao', label: 'Não Ativo', description: '3+ faltas ou desistência' },
  { value: 'concluido', label: 'Concluído', description: 'Finalizou o curso' },
  { value: 'trancado', label: 'Trancado', description: 'Solicitou trancamento' },
];

const ENROLLMENT_TYPE_LABELS: Record<string, string> = {
  modelo_agenciado_maxfama: 'MaxFama',
  modelo_agenciado_popschool: 'Pop School',
  indicacao_influencia: 'Indicação Influência',
  indicacao_aluno: 'Indicação Aluno',
};

export function AcademicConversationPanel({
  contact,
  onStatusChange,
  operatorName,
}: AcademicConversationPanelProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenWhatsApp = () => {
    openWhatsApp(
      contact.phone,
      `Olá ${contact.full_name}! Aqui é ${operatorName} do departamento acadêmico. Como posso ajudá-lo(a)?`
    );
  };

  const saveNote = async () => {
    if (!notes.trim()) return;
    setIsSaving(true);

    try {
      // Get current enrollment notes and append
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('notes')
        .eq('id', contact.id)
        .maybeSingle();

      const currentNotes = enrollment?.notes || '';
      const timestamp = new Date().toLocaleString('pt-BR');
      const newNote = `[${timestamp}] ${operatorName}: ${notes}`;
      const updatedNotes = currentNotes
        ? `${currentNotes}\n\n${newNote}`
        : newNote;

      const { error } = await supabase
        .from('enrollments')
        .update({ notes: updatedNotes })
        .eq('id', contact.id);

      if (error) throw error;

      toast.success('Observação salva!');
      setNotes('');
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Erro ao salvar observação');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="flex-1 flex flex-col border-0 shadow-md">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-lg font-medium">
              {contact.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <CardTitle className="text-lg">{contact.full_name}</CardTitle>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <a
                  href={getWhatsAppLink(contact.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="h-3 w-3" />
                  {contact.phone}
                </a>
                {contact.referral_agent_code && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {contact.referral_agent_code}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button onClick={handleOpenWhatsApp} className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Abrir WhatsApp
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Info do Aluno */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">Curso</p>
            <p className="font-medium">{contact.course_name || 'Não definido'}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">Turma</p>
            <p className="font-medium">{contact.class_name || 'Não definida'}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">Tipo Matrícula</p>
            <p className="font-medium">
              {ENROLLMENT_TYPE_LABELS[contact.enrollment_type || ''] || 'Não informado'}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">Faltas</p>
            <p className={`font-medium ${contact.absences_count >= 3 ? 'text-orange-500' : ''}`}>
              {contact.absences_count} {contact.absences_count >= 3 && '(Não Ativo)'}
            </p>
          </div>
        </div>

        <Separator />

        {/* Operador Atual */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <User className="h-4 w-4 text-primary" />
          <span className="text-sm">
            Atendimento por: <strong>{operatorName}</strong>
          </span>
        </div>

        {/* Tabulação */}
        <div>
          <p className="text-sm font-medium mb-3">Tabulação Acadêmica</p>
          <Select
            value={contact.status}
            onValueChange={(value) => onStatusChange(contact.id, value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              {ACADEMIC_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  <div className="flex flex-col">
                    <span>{status.label}</span>
                    <span className="text-xs text-muted-foreground">{status.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Observações */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Adicionar Observação</p>
          <Textarea
            placeholder="Digite uma observação sobre o atendimento..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
          <Button
            onClick={saveNote}
            disabled={!notes.trim() || isSaving}
            className="w-full"
          >
            {isSaving ? 'Salvando...' : 'Salvar Observação'}
          </Button>
        </div>

        {/* Ações de Conclusão */}
        {contact.status === 'concluido' && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-3">Pós-Conclusão</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-1 border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white"
                  onClick={() => onStatusChange(contact.id, 'ativo')}
                >
                  <RefreshCcw className="h-5 w-5" />
                  <span className="text-sm font-medium">Rematricular</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-1 border-muted-foreground text-muted-foreground hover:bg-muted-foreground hover:text-white"
                  onClick={() => onStatusChange(contact.id, 'trancado')}
                >
                  <GraduationCap className="h-5 w-5" />
                  <span className="text-sm font-medium">Não Retorna</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
