import { useState, useEffect, useRef } from 'react';
import { Search, Download, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { TextElement } from './TemplateEditor';

interface Template {
  id: string;
  name: string;
  course_id: string;
  background_url: string | null;
  text_elements: TextElement[];
  course?: { name: string };
}

interface Student {
  id: string;
  full_name: string;
  referral_agent_code?: string | null;
}

export function QuickCertificateIssuer() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [completionDate, setCompletionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [studentOpen, setStudentOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const certificateRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [templatesRes, studentsRes] = await Promise.all([
        supabase
          .from('certificate_templates')
          .select('*, course:courses(name)')
          .eq('is_active', true)
          .order('name'),
        supabase.from('leads').select('id, full_name').order('full_name'),
      ]);

      // Also fetch enrollments with referral_agent_code
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select('lead_id, referral_agent_code')
        .not('referral_agent_code', 'is', null);

      const enrollmentMap = new Map(
        enrollmentsData?.map((e) => [e.lead_id, e.referral_agent_code]) || []
      );

      const studentsWithCode = (studentsRes.data || []).map((s) => ({
        ...s,
        referral_agent_code: enrollmentMap.get(s.id) || null,
      }));

      if (templatesRes.error) throw templatesRes.error;

      // Parse text_elements from JSON
      const parsedTemplates = (templatesRes.data || []).map((t) => ({
        ...t,
        text_elements: (Array.isArray(t.text_elements) ? t.text_elements : []) as unknown as TextElement[],
      }));

      setTemplates(parsedTemplates);
      setStudents(studentsWithCode);
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

  const filteredStudents = students.filter((s) => {
    const query = searchQuery.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(query) ||
      (s.referral_agent_code && s.referral_agent_code.toLowerCase().includes(query))
    );
  });

  const generatePDF = async () => {
    if (!certificateRef.current || !selectedStudent || !selectedTemplate) {
      toast({
        variant: 'destructive',
        title: 'Dados incompletos',
        description: 'Selecione um template e um aluno.',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

      // Clean filename
      const cleanName = selectedStudent.full_name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_');

      const fileName = `${cleanName}.pdf`;

      // Save locally
      pdf.save(fileName);

      // Upload to storage
      const pdfBlob = pdf.output('blob');
      const storagePath = `certificados/${fileName}`;

      await supabase.storage
        .from('certificates')
        .upload(storagePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      toast({
        title: 'Certificado gerado!',
        description: `Arquivo salvo: ${fileName}`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar PDF',
        description: 'Tente novamente.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const renderElementContent = (element: TextElement): string => {
    switch (element.type) {
      case 'studentName':
        return selectedStudent?.full_name || '[Nome do Aluno]';
      case 'courseName':
        return selectedTemplate?.course?.name || '[Nome do Curso]';
      case 'completionDate':
        return format(new Date(completionDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      default:
        return element.label;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Label>Template</Label>
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Aluno</Label>
          <Popover open={studentOpen} onOpenChange={setStudentOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={studentOpen}
                className="w-full justify-between font-normal"
              >
                {selectedStudent ? (
                  <span className="truncate">{selectedStudent.full_name}</span>
                ) : (
                  <span className="text-muted-foreground">Buscar aluno...</span>
                )}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Nome ou código..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList>
                  <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                  <CommandGroup>
                    {filteredStudents.slice(0, 20).map((student) => (
                      <CommandItem
                        key={student.id}
                        value={student.id}
                        onSelect={() => {
                          setSelectedStudent(student);
                          setStudentOpen(false);
                          setSearchQuery('');
                        }}
                      >
                        <div className="flex flex-col">
                          <span>{student.full_name}</span>
                          {student.referral_agent_code && (
                            <span className="text-xs text-muted-foreground">
                              Código: {student.referral_agent_code}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label>Data de Conclusão</Label>
          <Input
            type="date"
            value={completionDate}
            onChange={(e) => setCompletionDate(e.target.value)}
          />
        </div>

        <div className="flex items-end">
          <Button
            onClick={generatePDF}
            disabled={!selectedTemplate || !selectedStudent || isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {isGenerating ? 'Gerando...' : 'Gerar PDF'}
          </Button>
        </div>
      </div>

      {/* Preview */}
      {selectedTemplate ? (
        <div className="border rounded-lg overflow-hidden">
          <div
            ref={certificateRef}
            className="relative bg-white"
            style={{
              width: '842px',
              height: '595px',
              margin: '0 auto',
            }}
          >
            {selectedTemplate.background_url && (
              <img
                src={selectedTemplate.background_url}
                alt="Background"
                className="absolute inset-0 w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            )}

            {selectedTemplate.text_elements.map((element) => (
              <div
                key={element.id}
                className="absolute"
                style={{
                  left: `${element.x}px`,
                  top: `${element.y}px`,
                  fontFamily: element.fontFamily,
                  fontSize: `${element.fontSize}px`,
                  fontWeight: element.fontWeight,
                  fontStyle: element.fontStyle,
                  textAlign: element.textAlign,
                  color: element.color,
                }}
              >
                {renderElementContent(element)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-muted/50 rounded-lg">
          <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            Selecione um template para visualizar o certificado
          </p>
        </div>
      )}
    </div>
  );
}
