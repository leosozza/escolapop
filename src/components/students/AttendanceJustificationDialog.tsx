import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type JustificationReason = 'reposicao' | 'erro_equipe';

interface AttendanceJustificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  leadId: string;
  classId: string;
  attendanceDate: string;
  onSuccess?: () => void;
}

interface ClassOption {
  id: string;
  name: string;
  schedule: Record<string, string> | null;
  course: { name: string } | null;
}

const WEEKDAY_LABELS: Record<string, string> = {
  monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua',
  thursday: 'Qui', friday: 'Sex', saturday: 'Sáb',
};

export function AttendanceJustificationDialog({
  open, onOpenChange, studentName, leadId,
  classId, attendanceDate, onSuccess,
}: AttendanceJustificationDialogProps) {
  const [reason, setReason] = useState<JustificationReason | ''>('');
  const [reposicaoClassId, setReposicaoClassId] = useState('');
  const [availableClasses, setAvailableClasses] = useState<ClassOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && reason === 'reposicao') {
      fetchClasses();
    }
  }, [open, reason]);

  useEffect(() => {
    if (open) {
      setReason('');
      setReposicaoClassId('');
    }
  }, [open]);

  const fetchClasses = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, schedule, course:courses(name)')
        .eq('is_active', true)
        .neq('id', classId)
        .order('name');

      if (error) throw error;
      setAvailableClasses((data || []) as ClassOption[]);
    } catch {
      toast.error('Erro ao carregar turmas');
    } finally {
      setIsLoading(false);
    }
  };

  const formatSchedule = (schedule: Record<string, string> | null) => {
    if (!schedule) return '';
    return Object.entries(schedule)
      .map(([day, time]) => `${WEEKDAY_LABELS[day] || day} ${time}`)
      .join(' | ');
  };

  const handleSubmit = async () => {
    if (!reason) return;
    if (reason === 'reposicao' && !reposicaoClassId) {
      toast.error('Selecione a turma de reposição');
      return;
    }

    setIsSaving(true);
    try {
      const reposicaoClass = availableClasses.find(c => c.id === reposicaoClassId);
      const notes = reason === 'reposicao'
        ? `Reposição na turma: ${reposicaoClass?.name || ''} (${formatSchedule(reposicaoClass?.schedule || null)})`
        : 'Erro de equipe - presença não registrada no dia';

      const { error } = await supabase
        .from('attendance')
        .upsert({
          class_id: classId,
          student_id: leadId,
          attendance_date: attendanceDate,
          status: 'justificado',
          notes,
        }, {
          onConflict: 'class_id,student_id,attendance_date',
        });

      if (error) throw error;

      toast.success(`Presença justificada para ${studentName}`);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error justifying:', error);
      toast.error('Erro ao justificar presença');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Justificar Presença
          </DialogTitle>
          <DialogDescription>
            Justificar falta de {studentName} em {format(new Date(attendanceDate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Motivo da justificativa</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as JustificationReason)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reposicao">Reposição - Fez aula em outra turma</SelectItem>
                <SelectItem value="erro_equipe">Erro de Equipe - Não deram presença</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reason === 'reposicao' && (
            <div className="space-y-2">
              <Label>Turma onde fez reposição</Label>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <Select value={reposicaoClassId} onValueChange={setReposicaoClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a turma..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex flex-col">
                          <span>{c.name} - {c.course?.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatSchedule(c.schedule)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason || (reason === 'reposicao' && !reposicaoClassId) || isSaving}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Justificativa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
