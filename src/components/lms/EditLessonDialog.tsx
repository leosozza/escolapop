import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Lesson } from '@/types/database';

const lessonSchema = z.object({
  title: z.string().min(2, 'Título deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  duration_minutes: z.string().optional(),
  is_active: z.boolean(),
});

type LessonFormData = z.infer<typeof lessonSchema>;

interface EditLessonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: Lesson;
  onSuccess: () => void;
}

export function EditLessonDialog({ open, onOpenChange, lesson, onSuccess }: EditLessonDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<LessonFormData>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      title: lesson.title,
      description: lesson.description || '',
      duration_minutes: lesson.duration_minutes?.toString() || '',
      is_active: lesson.is_active,
    },
  });

  useEffect(() => {
    form.reset({
      title: lesson.title,
      description: lesson.description || '',
      duration_minutes: lesson.duration_minutes?.toString() || '',
      is_active: lesson.is_active,
    });
  }, [lesson, form]);

  const onSubmit = async (data: LessonFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('lessons')
        .update({
          title: data.title,
          description: data.description || null,
          duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes) : null,
          is_active: data.is_active,
        })
        .eq('id', lesson.id);

      if (error) throw error;

      toast({
        title: 'Aula atualizada!',
        description: `${data.title} foi atualizada com sucesso.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      console.error('Error updating lesson:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar aula',
        description: (error as Error).message || 'Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Aula</DialogTitle>
          <DialogDescription>
            Atualize as informações da aula
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título da aula *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Postura e Caminhada" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o conteúdo da aula..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duration_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duração (minutos)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ex: 30" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Aula ativa</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Aulas inativas não ficam visíveis para alunos
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-primary hover:opacity-90"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}