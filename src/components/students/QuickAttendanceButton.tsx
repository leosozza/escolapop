import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface QuickAttendanceButtonProps {
  studentId: string; // lead_id
  classId: string;
  studentName: string;
  onSuccess?: () => void;
}

export function QuickAttendanceButton({
  studentId,
  classId,
  studentName,
  onSuccess,
}: QuickAttendanceButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const today = new Date();

  const markAttendanceMutation = useMutation({
    mutationFn: async (status: 'presente' | 'falta' | 'justificado') => {
      const { error } = await supabase.from('attendance').upsert(
        {
          class_id: classId,
          student_id: studentId,
          attendance_date: format(today, 'yyyy-MM-dd'),
          status,
        },
        {
          onConflict: 'class_id,student_id,attendance_date',
        }
      );

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Presença marcada!');
      queryClient.invalidateQueries({ queryKey: ['attendance-counts-lead'] });
      queryClient.invalidateQueries({ queryKey: ['student-enrollments-lead'] });
      setIsOpen(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error('Erro ao marcar presença');
    },
  });

  const isLoading = markAttendanceMutation.isPending;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-1"
      >
        <Check className="h-4 w-4" />
        Presença
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar Presença</DialogTitle>
            <DialogDescription>
              {studentName} - {format(today, "dd 'de' MMMM", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 py-4">
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-success/10 hover:border-success hover:text-success"
              onClick={() => markAttendanceMutation.mutate('presente')}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Check className="h-6 w-6" />
              )}
              <span className="text-sm font-medium">Presente</span>
            </Button>

            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
              onClick={() => markAttendanceMutation.mutate('falta')}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <X className="h-6 w-6" />
              )}
              <span className="text-sm font-medium">Falta</span>
            </Button>

            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-warning/10 hover:border-warning hover:text-warning"
              onClick={() => markAttendanceMutation.mutate('justificado')}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <AlertCircle className="h-6 w-6" />
              )}
              <span className="text-sm font-medium">Justificado</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
