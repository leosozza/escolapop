import { useState, useRef, useCallback } from 'react';
import Draggable from 'react-draggable';
import { Upload, Type, Save, X } from 'lucide-react';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TextElement {
  id: string;
  type: 'studentName' | 'courseName' | 'completionDate' | 'custom';
  label: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  color: string;
}

interface TemplateEditorProps {
  courseId: string;
  courseName: string;
  initialData?: {
    id?: string;
    name: string;
    backgroundUrl: string | null;
    textElements: TextElement[];
  };
  onSave: () => void;
  onCancel: () => void;
}

const DEFAULT_ELEMENTS: TextElement[] = [
  {
    id: 'studentName',
    type: 'studentName',
    label: '[Nome do Aluno]',
    x: 300,
    y: 250,
    fontSize: 32,
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontStyle: 'normal',
    textAlign: 'center',
    color: '#1a1a1a',
  },
  {
    id: 'courseName',
    type: 'courseName',
    label: '[Nome do Curso]',
    x: 300,
    y: 320,
    fontSize: 24,
    fontFamily: 'Georgia',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'center',
    color: '#333333',
  },
  {
    id: 'completionDate',
    type: 'completionDate',
    label: '[Data de Conclusão]',
    x: 300,
    y: 380,
    fontSize: 18,
    fontFamily: 'Georgia',
    fontWeight: 'normal',
    fontStyle: 'italic',
    textAlign: 'center',
    color: '#666666',
  },
];

const FONT_FAMILIES = [
  'Georgia',
  'Arial',
  'Times New Roman',
  'Helvetica',
  'Verdana',
  'Courier New',
  'Playfair Display',
];

export function TemplateEditor({
  courseId,
  courseName,
  initialData,
  onSave,
  onCancel,
}: TemplateEditorProps) {
  const [templateName, setTemplateName] = useState(initialData?.name || `Certificado - ${courseName}`);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(initialData?.backgroundUrl || null);
  const [textElements, setTextElements] = useState<TextElement[]>(
    initialData?.textElements || DEFAULT_ELEMENTS
  );
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const selectedElement = textElements.find((el) => el.id === selectedElementId);

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('png')) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: 'Por favor, selecione um arquivo PNG.',
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `templates/${courseId}/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('certificates')
        .getPublicUrl(fileName);

      setBackgroundUrl(publicUrl);
      toast({ title: 'Imagem carregada com sucesso!' });
    } catch (error) {
      console.error('Error uploading background:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar imagem',
        description: 'Tente novamente.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = useCallback((id: string, x: number, y: number) => {
    setTextElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, x, y } : el))
    );
  }, []);

  const updateElement = (id: string, updates: Partial<TextElement>) => {
    setTextElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
    );
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Digite um nome para o template.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const templateData = {
        course_id: courseId,
        name: templateName,
        background_url: backgroundUrl,
        text_elements: JSON.parse(JSON.stringify(textElements)),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from('certificate_templates')
          .update(templateData)
          .eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('certificate_templates')
          .insert([templateData]);
        if (error) throw error;
      }

      toast({ title: 'Template salvo com sucesso!' });
      onSave();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          <Label>Nome do Template</Label>
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Ex: Certificado Passarela 2024"
          />
        </div>
        <div className="flex gap-2 pt-5">
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? 'Salvando...' : 'Salvar Template'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Preview */}
        <div className="lg:col-span-3">
          <div
            className="relative bg-muted rounded-lg overflow-hidden"
            style={{
              width: '100%',
              aspectRatio: '842 / 595',
            }}
          >
            {backgroundUrl ? (
              <img
                src={backgroundUrl}
                alt="Background"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30">
                <Upload className="h-12 w-12 text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">
                  Clique para carregar a arte do certificado (PNG)
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? 'Carregando...' : 'Selecionar Imagem'}
                </Button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              className="hidden"
              onChange={handleBackgroundUpload}
            />

            {backgroundUrl && (
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2 z-10"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Trocar
              </Button>
            )}

            {/* Draggable Elements */}
            {textElements.map((element) => (
              <Draggable
                key={element.id}
                position={{ x: element.x, y: element.y }}
                onStop={(_, data) => handleDrag(element.id, data.x, data.y)}
                bounds="parent"
              >
                <div
                  className={`absolute cursor-move p-2 rounded transition-all ${
                    selectedElementId === element.id
                      ? 'ring-2 ring-primary bg-primary/10'
                      : 'hover:bg-white/20'
                  }`}
                  style={{
                    fontFamily: element.fontFamily,
                    fontSize: `${element.fontSize}px`,
                    fontWeight: element.fontWeight,
                    fontStyle: element.fontStyle,
                    textAlign: element.textAlign,
                    color: element.color,
                  }}
                  onClick={() => setSelectedElementId(element.id)}
                >
                  {element.label}
                </div>
              </Draggable>
            ))}
          </div>
        </div>

        {/* Element Editor */}
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Type className="h-4 w-4" />
              Elementos de Texto
            </h3>
            <div className="space-y-2">
              {textElements.map((el) => (
                <button
                  key={el.id}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedElementId === el.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-accent'
                  }`}
                  onClick={() => setSelectedElementId(el.id)}
                >
                  {el.type === 'studentName' && 'Nome do Aluno'}
                  {el.type === 'courseName' && 'Nome do Curso'}
                  {el.type === 'completionDate' && 'Data de Conclusão'}
                  {el.type === 'custom' && el.label}
                </button>
              ))}
            </div>
          </div>

          {selectedElement && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Estilo do Elemento</h3>

              <div>
                <Label className="text-xs">Fonte</Label>
                <Select
                  value={selectedElement.fontFamily}
                  onValueChange={(v) => updateElement(selectedElement.id, { fontFamily: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_FAMILIES.map((font) => (
                      <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Tamanho</Label>
                <Input
                  type="number"
                  value={selectedElement.fontSize}
                  onChange={(e) =>
                    updateElement(selectedElement.id, { fontSize: Number(e.target.value) })
                  }
                  className="h-9"
                />
              </div>

              <div>
                <Label className="text-xs">Cor</Label>
                <Input
                  type="color"
                  value={selectedElement.color}
                  onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                  className="h-9 p-1"
                />
              </div>

              <div>
                <Label className="text-xs">Alinhamento</Label>
                <ToggleGroup
                  type="single"
                  value={selectedElement.textAlign}
                  onValueChange={(v) =>
                    v && updateElement(selectedElement.id, { textAlign: v as 'left' | 'center' | 'right' })
                  }
                  className="justify-start"
                >
                  <ToggleGroupItem value="left" size="sm">Esq</ToggleGroupItem>
                  <ToggleGroupItem value="center" size="sm">Centro</ToggleGroupItem>
                  <ToggleGroupItem value="right" size="sm">Dir</ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div>
                <Label className="text-xs">Estilo</Label>
                <ToggleGroup
                  type="single"
                  value={`${selectedElement.fontWeight}-${selectedElement.fontStyle}`}
                  onValueChange={(v) => {
                    if (v === 'bold-normal') {
                      updateElement(selectedElement.id, { fontWeight: 'bold', fontStyle: 'normal' });
                    } else if (v === 'normal-italic') {
                      updateElement(selectedElement.id, { fontWeight: 'normal', fontStyle: 'italic' });
                    } else {
                      updateElement(selectedElement.id, { fontWeight: 'normal', fontStyle: 'normal' });
                    }
                  }}
                  className="justify-start"
                >
                  <ToggleGroupItem value="normal-normal" size="sm">Normal</ToggleGroupItem>
                  <ToggleGroupItem value="bold-normal" size="sm">Negrito</ToggleGroupItem>
                  <ToggleGroupItem value="normal-italic" size="sm">Itálico</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
