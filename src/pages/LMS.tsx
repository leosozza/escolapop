import { useState, useEffect } from 'react';
import { Plus, Search, BookOpen, Layers, Video, FileText, ChevronRight, MoreHorizontal, Edit, Trash2, Eye, Power, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Course, Module, Lesson, LessonContent, ContentType } from '@/types/database';
import { CONTENT_TYPE_CONFIG } from '@/types/database';
import { AddModuleDialog } from '@/components/lms/AddModuleDialog';
import { AddLessonDialog } from '@/components/lms/AddLessonDialog';
import { AddContentDialog } from '@/components/lms/AddContentDialog';
import { EditModuleDialog } from '@/components/lms/EditModuleDialog';
import { EditLessonDialog } from '@/components/lms/EditLessonDialog';

const contentTypeIcons: Record<ContentType, typeof Video> = {
  video: Video,
  text: FileText,
  file: FileText,
  quiz: FileText,
};

export default function LMS() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog states
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false);
  const [isAddContentOpen, setIsAddContentOpen] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  
  // Edit dialog states
  const [editModule, setEditModule] = useState<Module | null>(null);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  
  const { toast } = useToast();

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCourses((data as Course[]) || []);
      
      if (data && data.length > 0 && !selectedCourseId) {
        setSelectedCourseId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchModules = async () => {
    if (!selectedCourseId) {
      setModules([]);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch modules with lessons and contents
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', selectedCourseId)
        .order('order_index');

      if (modulesError) throw modulesError;

      // For each module, fetch lessons
      const modulesWithLessons = await Promise.all(
        (modulesData || []).map(async (module) => {
          const { data: lessonsData } = await supabase
            .from('lessons')
            .select('*')
            .eq('module_id', module.id)
            .order('order_index');

          // For each lesson, fetch contents
          const lessonsWithContents = await Promise.all(
            (lessonsData || []).map(async (lesson) => {
              const { data: contentsData } = await supabase
                .from('lesson_contents')
                .select('*')
                .eq('lesson_id', lesson.id)
                .order('order_index');

              return {
                ...lesson,
                contents: (contentsData || []) as LessonContent[],
              } as Lesson;
            })
          );

          return {
            ...module,
            lessons: lessonsWithContents,
          } as Module;
        })
      );

      setModules(modulesWithLessons);
    } catch (error) {
      console.error('Error fetching modules:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar módulos',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchModules();
  }, [selectedCourseId]);

  const handleDeleteModule = async (moduleId: string) => {
    try {
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId);

      if (error) throw error;

      toast({ title: 'Módulo excluído com sucesso' });
      fetchModules();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir módulo',
        description: 'Tente novamente.',
      });
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    try {
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', lessonId);

      if (error) throw error;

      toast({ title: 'Aula excluída com sucesso' });
      fetchModules();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir aula',
        description: 'Tente novamente.',
      });
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    try {
      const { error } = await supabase
        .from('lesson_contents')
        .delete()
        .eq('id', contentId);

      if (error) throw error;

      toast({ title: 'Conteúdo excluído com sucesso' });
      fetchModules();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir conteúdo',
        description: 'Tente novamente.',
      });
    }
  };

  const handleToggleModuleActive = async (module: Module) => {
    try {
      const { error } = await supabase
        .from('modules')
        .update({ is_active: !module.is_active })
        .eq('id', module.id);

      if (error) throw error;
      fetchModules();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar módulo',
      });
    }
  };

  const filteredModules = modules.filter(module =>
    module.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    module.lessons?.some(lesson => 
      lesson.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const totalLessons = modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);
  const totalContents = modules.reduce((acc, m) => 
    acc + (m.lessons?.reduce((lAcc, l) => lAcc + (l.contents?.length || 0), 0) || 0), 0
  );

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  if (isLoading && courses.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">LMS - Aulas</h1>
          <p className="text-muted-foreground">
            Gerencie módulos, aulas e conteúdos dos cursos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecione um curso" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      {selectedCourseId && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Módulos
              </CardTitle>
              <Layers className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{modules.length}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aulas
              </CardTitle>
              <BookOpen className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLessons}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Conteúdos
              </CardTitle>
              <Video className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalContents}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions */}
      {selectedCourseId && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar módulos ou aulas..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            className="bg-gradient-primary hover:opacity-90"
            onClick={() => setIsAddModuleOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Módulo
          </Button>
        </div>
      )}

      {/* Modules List */}
      {!selectedCourseId ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Selecione um curso</h3>
            <p className="text-muted-foreground">
              Escolha um curso para gerenciar seus módulos e aulas.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredModules.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <Layers className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Nenhum módulo encontrado</h3>
            <p className="text-muted-foreground">
              Comece criando o primeiro módulo do curso.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Accordion type="multiple" className="space-y-4">
            {filteredModules.map((module, moduleIndex) => (
              <AccordionItem
                key={module.id}
                value={module.id}
                className="border rounded-lg shadow-md bg-card overflow-hidden"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GripVertical className="h-4 w-4" />
                      <span className="text-sm font-medium">{moduleIndex + 1}</span>
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold">{module.title}</h3>
                      {module.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {module.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={module.is_active ? 'default' : 'secondary'}>
                        {module.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant="outline">
                        {module.lessons?.length || 0} aulas
                      </Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedModuleId(module.id);
                          setIsAddLessonOpen(true);
                        }}>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Aula
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditModule(module)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleModuleActive(module)}>
                          <Power className="h-4 w-4 mr-2" />
                          {module.is_active ? 'Desativar' : 'Ativar'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteModule(module.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  {module.lessons && module.lessons.length > 0 ? (
                    <div className="space-y-3 ml-8">
                      {module.lessons.map((lesson, lessonIndex) => (
                        <div key={lesson.id} className="border rounded-lg p-4 bg-background">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground font-medium">
                                {moduleIndex + 1}.{lessonIndex + 1}
                              </span>
                              <div>
                                <h4 className="font-medium">{lesson.title}</h4>
                                {lesson.duration_minutes && (
                                  <p className="text-sm text-muted-foreground">
                                    {lesson.duration_minutes} min
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {lesson.contents?.length || 0} conteúdos
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedLessonId(lesson.id);
                                    setIsAddContentOpen(true);
                                  }}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Adicionar Conteúdo
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setEditLesson(lesson)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleDeleteLesson(lesson.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* Contents */}
                          {lesson.contents && lesson.contents.length > 0 && (
                            <div className="mt-3 pl-8 space-y-2">
                              {lesson.contents.map((content) => {
                                const ContentIcon = contentTypeIcons[content.content_type as ContentType] || FileText;
                                const contentConfig = CONTENT_TYPE_CONFIG[content.content_type as ContentType];
                                
                                return (
                                  <div
                                    key={content.id}
                                    className="flex items-center justify-between p-2 rounded bg-muted/50"
                                  >
                                    <div className="flex items-center gap-2">
                                      <ContentIcon className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm">{content.title}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {contentConfig?.label || content.content_type}
                                      </Badge>
                                      {content.duration_seconds && (
                                        <span className="text-xs text-muted-foreground">
                                          {Math.floor(content.duration_seconds / 60)}:{String(content.duration_seconds % 60).padStart(2, '0')}
                                        </span>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleDeleteContent(content.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="ml-8 py-4 text-center text-muted-foreground">
                      <p className="text-sm">Nenhuma aula cadastrada neste módulo.</p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setSelectedModuleId(module.id);
                          setIsAddLessonOpen(true);
                        }}
                      >
                        Adicionar primeira aula
                      </Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {/* Dialogs */}
      <AddModuleDialog
        open={isAddModuleOpen}
        onOpenChange={setIsAddModuleOpen}
        courseId={selectedCourseId}
        orderIndex={modules.length}
        onSuccess={fetchModules}
      />

      <AddLessonDialog
        open={isAddLessonOpen}
        onOpenChange={setIsAddLessonOpen}
        moduleId={selectedModuleId}
        orderIndex={modules.find(m => m.id === selectedModuleId)?.lessons?.length || 0}
        onSuccess={fetchModules}
      />

      <AddContentDialog
        open={isAddContentOpen}
        onOpenChange={setIsAddContentOpen}
        lessonId={selectedLessonId}
        orderIndex={
          modules
            .flatMap(m => m.lessons || [])
            .find(l => l.id === selectedLessonId)?.contents?.length || 0
        }
        onSuccess={fetchModules}
      />

      {editModule && (
        <EditModuleDialog
          open={!!editModule}
          onOpenChange={(open) => !open && setEditModule(null)}
          module={editModule}
          onSuccess={fetchModules}
        />
      )}

      {editLesson && (
        <EditLessonDialog
          open={!!editLesson}
          onOpenChange={(open) => !open && setEditLesson(null)}
          lesson={editLesson}
          onSuccess={fetchModules}
        />
      )}
    </div>
  );
}