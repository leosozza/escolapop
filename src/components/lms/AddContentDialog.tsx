import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CONTENT_TYPE_CONFIG, type ContentType } from '@/types/database';

const contentSchema = z.object({
  title: z.string().min(2, 'Título deve ter pelo menos 2 caracteres'),
  content_type: z.string(),
  content_url: z.string().optional(),
  content_text: z.string().optional(),
  duration_seconds: z.string().optional(),
  is_active: z.boolean(),
});

type ContentFormData = z.infer<typeof contentSchema>;

interface AddContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: string;
  orderIndex: number;
  onSuccess: () => void;
}

export function AddContentDialog({ open, onOpenChange, lessonId, orderIndex, onSuccess }: AddContentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<ContentFormData>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      title: '',
      content_type: 'video',
      content_url: '',
      content_text: '',
      duration_seconds: '',
      is_active: true,
    },
  });

  const contentType = form.watch('content_type');

  const onSubmit = async (data: ContentFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from('lesson_contents').insert({
        lesson_id: lessonId,
        title: data.title,
        content_type: data.content_type as ContentType,
        content_url: data.content_url || null,
        content_text: data.content_text || null,
        duration_seconds: data.duration_seconds ? parseInt(data.duration_seconds) : null,
        order_index: orderIndex,
        is_active: data.is_active,
      });

      if (error) throw error;

      toast({
        title: 'Conteúdo adicionado!',
        description: `${data.title} foi adicionado com sucesso.`,
      });

      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      console.error('Error creating content:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar conteúdo',
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
          <DialogTitle>Novo Conteúdo</DialogTitle>
          <DialogDescription>
            Adicione um novo conteúdo à aula
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título do conteúdo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Vídeo de Introdução" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de conteúdo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(CONTENT_TYPE_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(contentType === 'video' || contentType === 'file') && (
              <FormField
                control={form.control}
                name="content_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do {contentType === 'video' ? 'vídeo' : 'arquivo'}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={contentType === 'video' ? 'https://youtube.com/...' : 'https://...'}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {contentType === 'text' && (
              <FormField
                control={form.control}
                name="content_text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conteúdo do texto</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Digite o conteúdo..."
                        className="resize-none min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {contentType === 'video' && (
              <FormField
                control={form.control}
                name="duration_seconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duração (segundos)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ex: 600 (10 minutos)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Conteúdo ativo</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Conteúdos inativos não ficam visíveis
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
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}