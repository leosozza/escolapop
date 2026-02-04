import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface AddAcademicContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddAcademicContactDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddAcademicContactDialogProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [courseId, setCourseId] = useState('');
  const [classId, setClassId] = useState('');

  // Fetch courses
  const { data: courses } = useQuery({
    queryKey: ['courses-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch classes for selected course
  const { data: classes } = useQuery({
    queryKey: ['classes-by-course', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  const createContactMutation = useMutation({
    mutationFn: async () => {
      // First create the lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          full_name: fullName,
          phone: phone.replace(/\D/g, ''),
          status: 'matriculado',
          source: 'presencial',
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // Then create the enrollment
      const { error: enrollmentError } = await supabase.from('enrollments').insert({
        lead_id: lead.id,
        course_id: courseId,
        class_id: classId || null,
        status: 'ativo',
      });

      if (enrollmentError) throw enrollmentError;

      return lead;
    },
    onSuccess: () => {
      toast.success('Aluno adicionado com sucesso!');
      resetForm();
      onSuccess();
    },
    onError: (error) => {
      console.error('Error creating contact:', error);
      toast.error('Erro ao adicionar aluno');
    },
  });

  const resetForm = () => {
    setFullName('');
    setPhone('');
    setCourseId('');
    setClassId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !courseId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    createContactMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Aluno</DialogTitle>
          <DialogDescription>
            Adicione um novo contato para atendimento acadêmico.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome do Aluno *</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <PhoneInput
              id="phone"
              value={phone}
              onChange={setPhone}
              placeholder="(11) 99999-9999"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course">Curso *</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o curso" />
              </SelectTrigger>
              <SelectContent>
                {courses?.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {courseId && classes && classes.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="class">Turma (opcional)</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createContactMutation.isPending}>
              {createContactMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Adicionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
