import { useState, useEffect } from 'react';
import {
  Award,
  Plus,
  Loader2,
  FileText,
  Settings,
  Trash2,
  Edit,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TemplateEditor, type TextElement } from '@/components/certificates/TemplateEditor';
import { QuickCertificateIssuer } from '@/components/certificates/QuickCertificateIssuer';

interface Course {
  id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  course_id: string;
  background_url: string | null;
  text_elements: TextElement[];
  course?: { name: string };
}

export default function Certificates() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [coursesRes, templatesRes] = await Promise.all([
        supabase
          .from('courses')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('certificate_templates')
          .select('*, course:courses(name)')
          .eq('is_active', true)
          .order('name'),
      ]);

      if (coursesRes.error) throw coursesRes.error;
      if (templatesRes.error) throw templatesRes.error;

      setCourses(coursesRes.data || []);
      
      const parsedTemplates = (templatesRes.data || []).map((t) => ({
        ...t,
        text_elements: (Array.isArray(t.text_elements) ? t.text_elements : []) as unknown as TextElement[],
      }));
      
      setTemplates(parsedTemplates);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    if (!selectedCourseId) {
      toast({
        variant: 'destructive',
        title: 'Selecione um curso',
        description: 'Escolha o curso para criar o template.',
      });
      return;
    }
    setEditingTemplate(null);
    setIsEditorOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    setSelectedCourseId(template.course_id);
    setEditingTemplate(template);
    setIsEditorOpen(true);
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;

    try {
      const { error } = await supabase
        .from('certificate_templates')
        .update({ is_active: false })
        .eq('id', deleteTemplateId);

      if (error) throw error;

      toast({ title: 'Template removido!' });
      setDeleteTemplateId(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao remover',
        description: 'Tente novamente.',
      });
    }
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Certificados</h1>
          <p className="text-muted-foreground">
            Crie templates e emita certificados rapidamente
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="issue" className="space-y-6">
        <TabsList>
          <TabsTrigger value="issue" className="gap-2">
            <Award className="h-4 w-4" />
            Emitir Certificado
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Settings className="h-4 w-4" />
            Gerenciar Templates
          </TabsTrigger>
        </TabsList>

        {/* Issue Tab */}
        <TabsContent value="issue">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Emissão Rápida
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuickCertificateIssuer />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          {/* Create Template */}
          <Card>
            <CardHeader>
              <CardTitle>Criar Novo Template</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o curso" />
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
                <Button onClick={handleCreateTemplate} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Template
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Templates List */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground text-center">
                    Nenhum template criado ainda.
                    <br />
                    Selecione um curso e clique em "Criar Template".
                  </p>
                </CardContent>
              </Card>
            ) : (
              templates.map((template) => (
                <Card key={template.id} className="overflow-hidden">
                  {template.background_url ? (
                    <div className="relative aspect-video bg-muted">
                      <img
                        src={template.background_url}
                        alt={template.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      <FileText className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{template.name}</h3>
                        <Badge variant="secondary" className="mt-1">
                          {template.course?.name}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditTemplate(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTemplateId(template.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Template Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Template' : 'Criar Template'}
            </DialogTitle>
          </DialogHeader>
          {selectedCourse && (
            <TemplateEditor
              courseId={selectedCourseId}
              courseName={selectedCourse.name}
              initialData={
                editingTemplate
                  ? {
                      id: editingTemplate.id,
                      name: editingTemplate.name,
                      backgroundUrl: editingTemplate.background_url,
                      textElements: editingTemplate.text_elements,
                    }
                  : undefined
              }
              onSave={() => {
                setIsEditorOpen(false);
                fetchData();
              }}
              onCancel={() => setIsEditorOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template será desativado e não aparecerá mais na lista de opções.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
