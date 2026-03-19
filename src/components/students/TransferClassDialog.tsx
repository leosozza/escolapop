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
import { Loader2, ArrowRightLeft, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AcademicStatus } from '@/types/database';

interface TransferClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string;
  studentName: string;
  currentClassId: string | null;
  courseId: string;
  mode: 'remanejamento' | 'rematricula';
  onSuccess?: () => void;
}

interface ClassOption {
  id: string;
  name: string;
  start_date: string;
  schedule: Record<string, string> | null;
  room: string | null;
  course: { name: string } | null;
}

const WEEKDAY_LABELS: Record<string, string> = {
  monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua',
  thursday: 'Qui', friday: 'Sex', saturday: 'Sáb',
};

export function TransferClassDialog({
  open, onOpenChange, enrollmentId, studentName,
  currentClassId, courseId, mode, onSuccess,
}: TransferClassDialogProps) {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchClasses();
      setSelectedClassId('');
    }
  }, [open, courseId]);

  const fetchClasses = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, start_date, schedule, room, course:courses(name)')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setClasses((data || []).filter(c => c.id !== currentClassId) as ClassOption[]);
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
    if (!selectedClassId) return;
    setIsSaving(true);
    try {
      const newStatus: AcademicStatus = mode === 'remanejamento' ? 'remanejado' : 'rematricula';

      // Update old enrollment status
      await supabase
        .from('enrollments')
        .update({ status: newStatus })
        .eq('id', enrollmentId);

      // Create new enrollment in the target class
      const { data: oldEnrollment } = await supabase
        .from('enrollments')
        .select('*')
        .eq('id', enrollmentId)
        .single();

      if (oldEnrollment) {
        await supabase.from('enrollments').insert({
          lead_id: oldEnrollment.lead_id,
          course_id: oldEnrollment.course_id,
          class_id: selectedClassId,
          status: 'ativo' as AcademicStatus,
          enrollment_type: oldEnrollment.enrollment_type,
          referral_agent_code: oldEnrollment.referral_agent_code,
          influencer_name: oldEnrollment.influencer_name,
          student_age: oldEnrollment.student_age,
          notes: `${mode === 'remanejamento' ? 'Remanejado' : 'Rematriculado'} da matrícula anterior.`,
        });
      }

      toast.success(
        mode === 'remanejamento'
          ? `${studentName} remanejado(a) com sucesso!`
          : `${studentName} rematriculado(a) com sucesso!`
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error transferring:', error);
      toast.error('Erro ao processar transferência');
    } finally {
      setIsSaving(false);
    }
  };

  const isRematricula = mode === 'rematricula';
  const Icon = isRematricula ? RefreshCcw : ArrowRightLeft;
  const title = isRematricula ? 'Rematricular Aluno' : 'Remanejar Aluno';
  const description = isRematricula
    ? `Transferir ${studentName} para outro período/bimestre do mesmo curso.`
    : `Transferir ${studentName} para outra turma do mesmo curso.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : classes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma outra turma disponível para este curso.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Selecionar nova turma</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a turma..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex flex-col">
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatSchedule(c.schedule)} • {c.room || 'Sem sala'} • Início: {format(new Date(c.start_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedClassId || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
