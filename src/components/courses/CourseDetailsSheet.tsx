import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, Calendar, BookOpen, GraduationCap, Monitor, Building, Shuffle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Course, CourseModality } from '@/types/database';
import { COURSE_MODALITY_CONFIG } from '@/types/database';

interface CourseDetailsSheetProps {
  course: Course | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const modalityIcons = {
  presencial: Building,
  online: Monitor,
  hibrido: Shuffle,
};

export function CourseDetailsSheet({ course, open, onOpenChange }: CourseDetailsSheetProps) {
  const { data: classes } = useQuery({
    queryKey: ['course-classes', course?.id],
    queryFn: async () => {
      if (!course) return [];
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, start_date, end_date, room, is_active, max_students')
        .eq('course_id', course.id)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!course && open,
  });

  const { data: enrollmentCounts } = useQuery({
    queryKey: ['course-enrollment-counts', course?.id],
    queryFn: async () => {
      if (!course) return { total: 0, active: 0, completed: 0 };
      const { data, error } = await supabase
        .from('enrollments')
        .select('status')
        .eq('course_id', course.id);
      if (error) throw error;
      const total = data?.length || 0;
      const active = data?.filter(e => e.status === 'ativo' || e.status === 'em_curso').length || 0;
      const completed = data?.filter(e => e.status === 'concluido').length || 0;
      return { total, active, completed };
    },
    enabled: !!course && open,
  });

  const { data: modules } = useQuery({
    queryKey: ['course-modules', course?.id],
    queryFn: async () => {
      if (!course) return [];
      const { data, error } = await supabase
        .from('modules')
        .select('id, title, order_index, is_active, lessons(id)')
        .eq('course_id', course.id)
        .order('order_index');
      if (error) throw error;
      return data;
    },
    enabled: !!course && open,
  });

  if (!course) return null;

  const ModalityIcon = modalityIcons[course.modality as CourseModality];
  const modalityConfig = COURSE_MODALITY_CONFIG[course.modality as CourseModality];

  const formatPrice = (price: number | null) => {
    if (!price) return 'Sob consulta';
    return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <SheetTitle className="text-xl">{course.name}</SheetTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ModalityIcon className="h-4 w-4" />
                {modalityConfig.label}
                <Badge variant={course.is_active ? 'default' : 'secondary'}>
                  {course.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <Separator className="my-6" />

        {/* Info */}
        <div className="space-y-6">
          {course.description && (
            <p className="text-sm text-muted-foreground">{course.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground">Preço</p>
              <p className="text-lg font-bold text-primary">{formatPrice(course.price)}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground">Duração</p>
              <p className="text-lg font-bold">{course.duration_hours ? `${course.duration_hours}h` : '-'}</p>
            </div>
          </div>

          {/* Enrollment Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">{enrollmentCounts?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Matrículas</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-green-500">{enrollmentCounts?.active || 0}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{enrollmentCounts?.completed || 0}</p>
                <p className="text-xs text-muted-foreground">Concluídos</p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Turmas */}
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Users className="h-4 w-4" />
              Turmas ({classes?.length || 0})
            </h3>
            {classes?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma turma vinculada</p>
            ) : (
              <div className="space-y-2">
                {classes?.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(c.start_date), 'dd/MM/yyyy', { locale: ptBR })}
                        {c.room && ` • ${c.room}`}
                      </p>
                    </div>
                    <Badge variant={c.is_active ? 'default' : 'secondary'}>
                      {c.is_active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Módulos LMS */}
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4" />
              Módulos LMS ({modules?.length || 0})
            </h3>
            {modules?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum módulo cadastrado</p>
            ) : (
              <div className="space-y-2">
                {modules?.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{m.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.lessons?.length || 0} aula(s)
                      </p>
                    </div>
                    <Badge variant={m.is_active ? 'default' : 'secondary'}>
                      {m.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
