import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Award, Download, Loader2, MessageCircle, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { openWhatsAppWeb } from '@/lib/whatsapp';
import type { TextElement } from './TemplateEditor';

interface Template {
  id: string;
  name: string;
  course_id: string;
  background_url: string | null;
  text_elements: TextElement[];
  course?: { name: string };
}

interface CompletedStudent {
  id: string;
  lead_id: string;
  full_name: string;
  phone: string;
  enrollment_id: string;
}

interface BulkCertificateGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  courseId: string;
  courseName: string;
  onSuccess?: () => void;
}

export function BulkCertificateGenerator({
  open, onOpenChange, classId, className,
  courseId, courseName, onSuccess,
}: BulkCertificateGeneratorProps) {
  const [students, setStudents] = useState<CompletedStudent[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedFiles, setGeneratedFiles] = useState<{ name: string; phone: string; blob: Blob }[]>([]);
  const certificateRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch completed students without certificates
      const { data: enrollments, error: enrError } = await supabase
        .from('enrollments')
        .select('id, lead_id, lead:leads!enrollments_lead_id_fkey(id, full_name, phone)')
        .eq('class_id', classId)
        .eq('status', 'concluido')
        .eq('certificate_issued', false)
        .not('lead_id', 'is', null);

      if (enrError) throw enrError;

      const studentList: CompletedStudent[] = (enrollments || [])
        .filter((e: any) => e.lead)
        .map((e: any) => ({
          id: e.lead.id,
          lead_id: e.lead.id,
          full_name: e.lead.full_name,
          phone: e.lead.phone,
          enrollment_id: e.id,
        }));

      // Fetch template for this course
      const { data: templates } = await supabase
        .from('certificate_templates')
        .select('*, course:courses(name)')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .limit(1);

      const tmpl = templates?.[0];
      if (tmpl) {
        setTemplate({
          ...tmpl,
          text_elements: (Array.isArray(tmpl.text_elements) ? tmpl.text_elements : []) as unknown as TextElement[],
        });
      }

      setStudents(studentList);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchData();
  }, [open]);

  const renderElementContent = (element: TextElement, studentName: string): string => {
    switch (element.type) {
      case 'studentName': return studentName;
      case 'courseName': return courseName;
      case 'completionDate': return format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      default: return element.label;
    }
  };

  const generateAll = async () => {
    if (!template || !certificateRef.current) return;
    setIsGenerating(true);
    setGeneratedFiles([]);

    const files: { name: string; phone: string; blob: Blob }[] = [];

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      setProgress(Math.round(((i + 1) / students.length) * 100));

      // Update the hidden certificate div with student data
      const container = certificateRef.current;
      // Clear text elements
      const textEls = container.querySelectorAll('.cert-text');
      textEls.forEach(el => el.remove());

      // Add text elements
      template.text_elements.forEach(element => {
        const div = document.createElement('div');
        div.className = 'cert-text absolute';
        div.style.cssText = `left:${element.x}px;top:${element.y}px;font-family:${element.fontFamily};font-size:${element.fontSize}px;font-weight:${element.fontWeight};font-style:${element.fontStyle};text-align:${element.textAlign};color:${element.color};`;
        div.textContent = renderElementContent(element, student.full_name);
        container.appendChild(div);
      });

      try {
        const canvas = await html2canvas(container, {
          scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);

        const cleanName = student.full_name
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        const fileName = `${cleanName}.pdf`;

        const blob = pdf.output('blob');
        files.push({ name: fileName, phone: student.phone, blob });

        // Upload to storage
        await supabase.storage.from('certificates').upload(
          `certificados/${fileName}`, blob,
          { contentType: 'application/pdf', upsert: true }
        );

        // Mark as issued
        await supabase.from('enrollments').update({
          certificate_issued: true,
          certificate_issued_at: new Date().toISOString(),
        }).eq('id', student.enrollment_id);
      } catch (err) {
        console.error(`Error generating certificate for ${student.full_name}:`, err);
      }
    }

    setGeneratedFiles(files);
    setIsGenerating(false);
    toast.success(`${files.length} certificado(s) gerado(s)!`);
    onSuccess?.();
  };

  const downloadAll = () => {
    generatedFiles.forEach(file => {
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const sendViaWhatsApp = (phone: string, name: string) => {
    openWhatsAppWeb(phone, `Olá ${name}! Segue seu certificado de conclusão do curso ${courseName}. Parabéns! 🎉`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Certificados em Massa
          </DialogTitle>
          <DialogDescription>
            {className} - {courseName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !template ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum template de certificado encontrado para este curso. Crie um na página de Certificados primeiro.
          </p>
        ) : students.length === 0 ? (
          <div className="text-center py-8">
            <Check className="h-12 w-12 mx-auto text-success mb-2" />
            <p className="text-sm text-muted-foreground">
              Todos os alunos concluídos já possuem certificado emitido.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <strong>{students.length}</strong> aluno(s) concluído(s) sem certificado:
            </p>
            <ScrollArea className="max-h-48">
              <div className="space-y-1">
                {students.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm py-1">
                    <span>{s.full_name}</span>
                    <Badge variant="secondary" className="text-xs">Concluído</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {isGenerating && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Gerando... {progress}%
                </p>
              </div>
            )}

            {generatedFiles.length > 0 && (
              <div className="space-y-2">
                <Button onClick={downloadAll} variant="outline" className="w-full gap-2">
                  <Download className="h-4 w-4" />
                  Baixar Todos ({generatedFiles.length} PDFs)
                </Button>
                <ScrollArea className="max-h-40">
                  <div className="space-y-1">
                    {generatedFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50">
                        <span className="truncate flex-1">{file.name}</span>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => sendViaWhatsApp(file.phone, file.name.replace('.pdf', '').replace(/_/g, ' '))}
                          className="shrink-0 text-green-600 hover:text-green-700"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {/* Hidden certificate renderer */}
        <div className="fixed -left-[9999px] -top-[9999px]">
          <div
            ref={certificateRef}
            className="relative bg-white"
            style={{ width: '842px', height: '595px' }}
          >
            {template?.background_url && (
              <img
                src={template.background_url}
                alt="bg"
                className="absolute inset-0 w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {template && students.length > 0 && generatedFiles.length === 0 && (
            <Button onClick={generateAll} disabled={isGenerating} className="gap-2">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
              Gerar {students.length} Certificado(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
