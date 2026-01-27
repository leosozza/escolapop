import { useState, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Printer,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Type,
  Download,
  Check,
  ChevronsUpDown,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TextElement {
  id: string;
  type: 'studentName' | 'courseName' | 'completionDate' | 'custom';
  content: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  color: string;
}

interface CertificateData {
  studentName: string;
  courseName: string;
  completionDate: string;
  backgroundImage: string | null;
  textElements: TextElement[];
}

interface Lead {
  id: string;
  full_name: string;
}

interface Course {
  id: string;
  name: string;
}

interface CertificateGeneratorProps {
  initialData?: Partial<CertificateData>;
  onSave?: (data: CertificateData) => void;
}

const FONT_FAMILIES = [
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Courier New, monospace', label: 'Courier New' },
  { value: 'Palatino Linotype, serif', label: 'Palatino' },
  { value: 'Garamond, serif', label: 'Garamond' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet' },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];

// A4 Landscape aspect ratio (297mm x 210mm)
const CERTIFICATE_WIDTH = 842; // pixels at 72 DPI
const CERTIFICATE_HEIGHT = 595;

export function CertificateGenerator({ initialData, onSave }: CertificateGeneratorProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [studentOpen, setStudentOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [completionDate, setCompletionDate] = useState(
    initialData?.completionDate || format(new Date(), 'yyyy-MM-dd')
  );
  const [backgroundImage, setBackgroundImage] = useState<string | null>(
    initialData?.backgroundImage || null
  );
  const [textElements, setTextElements] = useState<TextElement[]>(
    initialData?.textElements || []
  );
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const certificateRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Update text elements when student or course changes
    updateDynamicText();
  }, [selectedStudentId, selectedCourseId, completionDate, leads, courses]);

  const fetchData = async () => {
    try {
      const [leadsResult, coursesResult] = await Promise.all([
        supabase
          .from('leads')
          .select('id, full_name')
          .order('full_name'),
        supabase
          .from('courses')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
      ]);

      if (leadsResult.data) setLeads(leadsResult.data);
      if (coursesResult.data) setCourses(coursesResult.data);

      // Initialize with default text elements if none exist
      if (!initialData?.textElements || initialData.textElements.length === 0) {
        initializeDefaultElements();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeDefaultElements = () => {
    const defaultElements: TextElement[] = [
      {
        id: 'studentName',
        type: 'studentName',
        content: 'Nome do Aluno',
        x: CERTIFICATE_WIDTH / 2 - 150,
        y: 250,
        fontSize: 36,
        fontFamily: 'Georgia, serif',
        fontWeight: 'bold',
        fontStyle: 'normal',
        textAlign: 'center',
        color: '#1a1a2e',
      },
      {
        id: 'courseName',
        type: 'courseName',
        content: 'Nome do Curso',
        x: CERTIFICATE_WIDTH / 2 - 150,
        y: 350,
        fontSize: 28,
        fontFamily: 'Georgia, serif',
        fontWeight: 'bold',
        fontStyle: 'normal',
        textAlign: 'center',
        color: '#2c3e50',
      },
      {
        id: 'completionDate',
        type: 'completionDate',
        content: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
        x: CERTIFICATE_WIDTH / 2 - 100,
        y: 450,
        fontSize: 18,
        fontFamily: 'Georgia, serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'center',
        color: '#666666',
      },
    ];
    setTextElements(defaultElements);
  };

  const updateDynamicText = () => {
    setTextElements((prev) =>
      prev.map((el) => {
        if (el.type === 'studentName') {
          const student = leads.find((l) => l.id === selectedStudentId);
          return { ...el, content: student?.full_name || 'Nome do Aluno' };
        }
        if (el.type === 'courseName') {
          const course = courses.find((c) => c.id === selectedCourseId);
          return { ...el, content: course?.name || 'Nome do Curso' };
        }
        if (el.type === 'completionDate') {
          return {
            ...el,
            content: completionDate
              ? format(new Date(completionDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
              : 'Data de Conclusão',
          };
        }
        return el;
      })
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('png')) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: 'Por favor, envie apenas arquivos PNG.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setBackgroundImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (id: string, x: number, y: number) => {
    setTextElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, x, y } : el))
    );
  };

  const updateSelectedElement = (updates: Partial<TextElement>) => {
    if (!selectedElementId) return;
    setTextElements((prev) =>
      prev.map((el) => (el.id === selectedElementId ? { ...el, ...updates } : el))
    );
  };

  const addCustomText = () => {
    const newElement: TextElement = {
      id: `custom-${Date.now()}`,
      type: 'custom',
      content: 'Texto personalizado',
      x: 100,
      y: 100,
      fontSize: 20,
      fontFamily: 'Georgia, serif',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      color: '#333333',
    };
    setTextElements((prev) => [...prev, newElement]);
    setSelectedElementId(newElement.id);
  };

  const deleteSelectedElement = () => {
    if (!selectedElementId) return;
    const element = textElements.find((el) => el.id === selectedElementId);
    if (element?.type !== 'custom') {
      toast({
        variant: 'destructive',
        title: 'Não permitido',
        description: 'Elementos padrão não podem ser removidos.',
      });
      return;
    }
    setTextElements((prev) => prev.filter((el) => el.id !== selectedElementId));
    setSelectedElementId(null);
  };

  const handlePrint = async () => {
    if (!certificateRef.current) return;

    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Certificado</title>
              <style>
                @page {
                  size: A4 landscape;
                  margin: 0;
                }
                body {
                  margin: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  background: white;
                }
                img {
                  max-width: 100%;
                  max-height: 100vh;
                  object-fit: contain;
                }
                @media print {
                  body { margin: 0; }
                  img { width: 100%; height: auto; }
                }
              </style>
            </head>
            <body>
              <img src="${imgData}" />
            </body>
          </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
      }
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar certificado',
        description: 'Tente novamente.',
      });
    }
  };

  const handleDownloadImage = async () => {
    if (!certificateRef.current) return;

    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `certificado-${selectedStudentId || 'aluno'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({
        title: 'Download iniciado',
        description: 'O certificado está sendo baixado.',
      });
    } catch (error) {
      console.error('Error downloading certificate:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao baixar',
        description: 'Tente novamente.',
      });
    }
  };

  const selectedElement = textElements.find((el) => el.id === selectedElementId);

  if (isLoading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Student Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Aluno</CardTitle>
          </CardHeader>
          <CardContent>
            <Popover open={studentOpen} onOpenChange={setStudentOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={studentOpen}
                  className="w-full justify-between"
                >
                  {selectedStudentId
                    ? leads.find((l) => l.id === selectedStudentId)?.full_name
                    : 'Buscar aluno...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nome..." />
                  <CommandList>
                    <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                    <CommandGroup>
                      {leads.map((lead) => (
                        <CommandItem
                          key={lead.id}
                          value={lead.full_name}
                          onSelect={() => {
                            setSelectedStudentId(lead.id);
                            setStudentOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedStudentId === lead.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          {lead.full_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        {/* Course Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Curso</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar curso..." />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Completion Date */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Data de Conclusão</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="date"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Image Upload & Actions */}
      <div className="flex flex-wrap gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".png"
          onChange={handleImageUpload}
          className="hidden"
        />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Imagem (PNG)
        </Button>
        {backgroundImage && (
          <Button
            variant="outline"
            onClick={() => setBackgroundImage(null)}
            className="gap-2 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Remover Fundo
          </Button>
        )}
        <Button variant="outline" onClick={addCustomText} className="gap-2">
          <Type className="h-4 w-4" />
          Adicionar Texto
        </Button>
        <div className="flex-1" />
        <Button variant="outline" onClick={handleDownloadImage} className="gap-2">
          <Download className="h-4 w-4" />
          Baixar Imagem
        </Button>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Imprimir / PDF
        </Button>
      </div>

      {/* Text Element Editor */}
      {selectedElement && (
        <Card className="border-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Editar Texto: {selectedElement.type === 'custom' ? 'Personalizado' : selectedElement.type}
              {selectedElement.type === 'custom' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deleteSelectedElement}
                  className="text-destructive h-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedElement.type === 'custom' && (
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Input
                  value={selectedElement.content}
                  onChange={(e) => updateSelectedElement({ content: e.target.value })}
                />
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Font Family */}
              <div className="space-y-2">
                <Label>Fonte</Label>
                <Select
                  value={selectedElement.fontFamily}
                  onValueChange={(value) => updateSelectedElement({ fontFamily: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_FAMILIES.map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        {font.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Font Size */}
              <div className="space-y-2">
                <Label>Tamanho</Label>
                <Select
                  value={String(selectedElement.fontSize)}
                  onValueChange={(value) => updateSelectedElement({ fontSize: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_SIZES.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}px
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Color */}
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input
                  type="color"
                  value={selectedElement.color}
                  onChange={(e) => updateSelectedElement({ color: e.target.value })}
                  className="h-10 p-1"
                />
              </div>

              {/* Alignment */}
              <div className="space-y-2">
                <Label>Alinhamento</Label>
                <ToggleGroup
                  type="single"
                  value={selectedElement.textAlign}
                  onValueChange={(value) =>
                    value && updateSelectedElement({ textAlign: value as 'left' | 'center' | 'right' })
                  }
                  className="justify-start"
                >
                  <ToggleGroupItem value="left" aria-label="Esquerda">
                    <AlignLeft className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="center" aria-label="Centro">
                    <AlignCenter className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="right" aria-label="Direita">
                    <AlignRight className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {/* Style Toggles */}
            <div className="flex gap-2">
              <Button
                variant={selectedElement.fontWeight === 'bold' ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  updateSelectedElement({
                    fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold',
                  })
                }
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedElement.fontStyle === 'italic' ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  updateSelectedElement({
                    fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic',
                  })
                }
              >
                <Italic className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Certificate Canvas */}
      <div className="border rounded-lg overflow-auto bg-muted/50 p-4">
        <div
          ref={certificateRef}
          className="relative mx-auto bg-white"
          style={{
            width: CERTIFICATE_WIDTH,
            height: CERTIFICATE_HEIGHT,
            backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={(e) => {
            if (e.target === certificateRef.current) {
              setSelectedElementId(null);
            }
          }}
        >
          {!backgroundImage && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
              <div className="text-center">
                <ImageIcon className="h-16 w-16 mx-auto mb-2" />
                <p>Faça upload de uma imagem PNG como fundo</p>
                <p className="text-sm">Formato A4 Paisagem (297x210mm)</p>
              </div>
            </div>
          )}

          {textElements.map((element) => (
            <Draggable
              key={element.id}
              position={{ x: element.x, y: element.y }}
              onStop={(_, data) => handleDrag(element.id, data.x, data.y)}
              bounds="parent"
            >
              <div
                className={cn(
                  'absolute cursor-move select-none px-2 py-1 rounded',
                  selectedElementId === element.id && 'ring-2 ring-primary ring-offset-2'
                )}
                style={{
                  fontFamily: element.fontFamily,
                  fontSize: element.fontSize,
                  fontWeight: element.fontWeight,
                  fontStyle: element.fontStyle,
                  textAlign: element.textAlign,
                  color: element.color,
                  minWidth: 100,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedElementId(element.id);
                }}
              >
                {element.content}
              </div>
            </Draggable>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Clique e arraste os textos para posicioná-los. Clique em um texto para editar suas propriedades.
      </p>
    </div>
  );
}
