import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface StudentCSVImportDialogProps {
  onSuccess: () => void;
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete";

const systemFields = [
  { value: "full_name", label: "Nome do Aluno", required: true },
  { value: "phone", label: "Telefone", required: true },
  { value: "email", label: "Email", required: false },
  { value: "age", label: "Idade", required: false },
  { value: "course", label: "Curso", required: false },
  { value: "class_name", label: "Turma", required: false },
  { value: "enrollment_type", label: "Tipo de Matrícula", required: false },
  { value: "referral_code", label: "Código do Agente", required: false },
  { value: "influencer", label: "Influenciador", required: false },
  { value: "notes", label: "Observações", required: false },
  { value: "skip", label: "-- Ignorar --", required: false },
];

const ENROLLMENT_TYPE_MAP: Record<string, string> = {
  maxfama: "modelo_agenciado_maxfama",
  "pop school": "modelo_agenciado_popschool",
  popschool: "modelo_agenciado_popschool",
  "indicação influência": "indicacao_influencia",
  "indicacao influencia": "indicacao_influencia",
  "indicação aluno": "indicacao_aluno",
  "indicacao aluno": "indicacao_aluno",
};

export function StudentCSVImportDialog({ onSuccess }: StudentCSVImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ success: 0, failed: 0, errors: [] as string[] });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch courses for mapping
  const { data: courses } = useQuery({
    queryKey: ["courses-for-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch classes for mapping
  const { data: classes } = useQuery({
    queryKey: ["classes-for-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, course_id")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const resetState = () => {
    setStep("upload");
    setFile(null);
    setCsvData([]);
    setHeaders([]);
    setMapping({});
    setProgress(0);
    setResults({ success: 0, failed: 0, errors: [] });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast({ title: "Arquivo deve ser CSV", variant: "destructive" });
      return;
    }

    setFile(selectedFile);
    parseCSV(selectedFile);
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        toast({
          title: "Arquivo deve ter pelo menos 2 linhas (cabeçalho + dados)",
          variant: "destructive",
        });
        return;
      }

      // Detect delimiter
      const firstLine = lines[0];
      const delimiter = firstLine.includes(";") ? ";" : ",";

      // Parse CSV considering quoted values
      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;

        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const parsedHeaders = parseLine(lines[0]);
      const parsedData = lines.slice(1).map(parseLine);

      setHeaders(parsedHeaders);
      setCsvData(parsedData);

      // Auto-map common field names
      const autoMapping: Record<string, string> = {};
      parsedHeaders.forEach((header) => {
        const headerLower = header.toLowerCase().trim();
        if (headerLower.includes("nome") && (headerLower.includes("aluno") || headerLower.includes("completo"))) {
          autoMapping[header] = "full_name";
        } else if (headerLower === "nome" && !autoMapping[header]) {
          autoMapping[header] = "full_name";
        } else if (headerLower.includes("telefone") || headerLower.includes("phone") || headerLower.includes("celular")) {
          autoMapping[header] = "phone";
        } else if (headerLower.includes("email") || headerLower.includes("e-mail")) {
          autoMapping[header] = "email";
        } else if (headerLower.includes("idade") || headerLower === "age") {
          autoMapping[header] = "age";
        } else if (headerLower.includes("curso") || headerLower === "course") {
          autoMapping[header] = "course";
        } else if (headerLower.includes("turma") || headerLower === "class") {
          autoMapping[header] = "class_name";
        } else if (headerLower.includes("tipo") || headerLower.includes("matricula")) {
          autoMapping[header] = "enrollment_type";
        } else if (headerLower.includes("agente") || headerLower.includes("codigo") || headerLower.includes("código")) {
          autoMapping[header] = "referral_code";
        } else if (headerLower.includes("influencia") || headerLower.includes("influencer")) {
          autoMapping[header] = "influencer";
        } else if (headerLower.includes("observa") || headerLower.includes("notes")) {
          autoMapping[header] = "notes";
        }
      });

      setMapping(autoMapping);
      setStep("mapping");
    };
    reader.readAsText(file);
  };

  const handleMappingChange = (csvColumn: string, systemField: string) => {
    setMapping((prev) => ({ ...prev, [csvColumn]: systemField }));
  };

  const validateMapping = (): boolean => {
    const mappedFields = Object.values(mapping);
    const hasName = mappedFields.includes("full_name");
    const hasPhone = mappedFields.includes("phone");

    if (!hasName || !hasPhone) {
      toast({
        title: "Mapeamento inválido",
        description: "Nome e Telefone são obrigatórios",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handlePreview = () => {
    if (!validateMapping()) return;
    setStep("preview");
  };

  const findCourseId = (courseName: string): string | null => {
    if (!courseName || !courses) return null;
    const course = courses.find(
      (c) => c.name.toLowerCase().includes(courseName.toLowerCase()) ||
             courseName.toLowerCase().includes(c.name.toLowerCase())
    );
    return course?.id || null;
  };

  const findClassId = (className: string, courseId: string | null): string | null => {
    if (!className || !classes) return null;
    const cls = classes.find(
      (c) =>
        (c.name.toLowerCase().includes(className.toLowerCase()) ||
         className.toLowerCase().includes(c.name.toLowerCase())) &&
        (!courseId || c.course_id === courseId)
    );
    return cls?.id || null;
  };

  const normalizeEnrollmentType = (value: string): string | null => {
    if (!value) return null;
    const normalized = value.toLowerCase().trim();
    return ENROLLMENT_TYPE_MAP[normalized] || null;
  };

  const handleImport = async () => {
    if (!validateMapping()) return;

    setStep("importing");
    setImporting(true);
    setProgress(0);

    // Create import log
    const { data: importLog, error: logError } = await supabase
      .from("csv_imports")
      .insert({
        file_name: file?.name || "students_import.csv",
        total_rows: csvData.length,
        status: "processing",
      })
      .select()
      .single();

    if (logError) {
      toast({ title: "Erro ao criar log de importação", variant: "destructive" });
      setImporting(false);
      return;
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Find column indices for mapped fields
    const fieldIndices: Record<string, number> = {};
    headers.forEach((header, index) => {
      if (mapping[header] && mapping[header] !== "skip") {
        fieldIndices[mapping[header]] = index;
      }
    });

    // Get a default course if no course column mapped
    let defaultCourseId: string | null = null;
    if (courses && courses.length > 0 && !Object.values(mapping).includes("course")) {
      defaultCourseId = courses[0].id;
    }

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];

      try {
        const getValue = (field: string): string => {
          const idx = fieldIndices[field];
          return idx !== undefined ? row[idx]?.trim() || "" : "";
        };

        const fullName = getValue("full_name");
        const phone = getValue("phone").replace(/\D/g, "");

        if (!fullName || !phone) {
          throw new Error(`Linha ${i + 2}: Nome ou telefone vazio`);
        }

        // Check for duplicate phone
        const { data: existingLead } = await supabase
          .from("leads")
          .select("id")
          .eq("phone", phone)
          .maybeSingle();

        let leadId: string;

        if (existingLead) {
          // Use existing lead
          leadId = existingLead.id;
        } else {
          // Create new lead with status 'matriculado'
          const { data: newLead, error: leadError } = await supabase
            .from("leads")
            .insert({
              full_name: fullName,
              phone: phone,
              email: getValue("email") || null,
              status: "matriculado",
              notes: getValue("notes") || null,
            })
            .select("id")
            .single();

          if (leadError) throw leadError;
          leadId = newLead.id;
        }

        // Find course and class
        const courseValue = getValue("course");
        const courseId = findCourseId(courseValue) || defaultCourseId;
        
        if (!courseId) {
          throw new Error(`Linha ${i + 2}: Curso não encontrado`);
        }

        const className = getValue("class_name");
        const classId = findClassId(className, courseId);

        // Parse age
        const ageValue = getValue("age");
        const studentAge = ageValue ? parseInt(ageValue, 10) : null;

        // Normalize enrollment type
        const enrollmentTypeValue = getValue("enrollment_type");
        const enrollmentType = normalizeEnrollmentType(enrollmentTypeValue);

        // Create enrollment
        const enrollmentData: {
          lead_id: string;
          course_id: string;
          class_id?: string | null;
          status: "ativo";
          student_age?: number | null;
          enrollment_type?: "modelo_agenciado_maxfama" | "modelo_agenciado_popschool" | "indicacao_influencia" | "indicacao_aluno" | null;
          referral_agent_code?: string | null;
          influencer_name?: string | null;
          notes?: string | null;
        } = {
          lead_id: leadId,
          course_id: courseId,
          class_id: classId,
          status: "ativo",
          student_age: studentAge && !isNaN(studentAge) ? studentAge : null,
          enrollment_type: enrollmentType as "modelo_agenciado_maxfama" | "modelo_agenciado_popschool" | "indicacao_influencia" | "indicacao_aluno" | null,
          referral_agent_code: getValue("referral_code") || null,
          influencer_name: getValue("influencer") || null,
          notes: getValue("notes") || null,
        };

        const { error: enrollmentError } = await supabase.from("enrollments").insert(enrollmentData);

        if (enrollmentError) throw enrollmentError;

        successCount++;
      } catch (error) {
        failedCount++;
        errors.push(error instanceof Error ? error.message : `Linha ${i + 2}: Erro desconhecido`);
      }

      setProgress(Math.round(((i + 1) / csvData.length) * 100));
    }

    // Update import log
    await supabase
      .from("csv_imports")
      .update({
        imported_rows: successCount,
        failed_rows: failedCount,
        status: "completed",
        error_log: errors.length > 0 ? errors.slice(0, 100) : null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", importLog.id);

    setResults({ success: successCount, failed: failedCount, errors: errors.slice(0, 10) });
    setImporting(false);
    setStep("complete");

    if (successCount > 0) {
      onSuccess();
    }
  };

  const previewData = csvData.slice(0, 5);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Alunos via CSV
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step: Upload */}
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Arraste um arquivo CSV aqui</p>
              <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
              <Button onClick={() => fileInputRef.current?.click()}>Selecionar Arquivo</Button>
            </div>
          )}

          {/* Step: Mapping */}
          {step === "mapping" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Arquivo: {file?.name} • {csvData.length} linhas
                </p>
                <Button variant="outline" size="sm" onClick={() => setStep("upload")}>
                  Trocar arquivo
                </Button>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Mapeamento de Colunas</h4>
                <p className="text-sm text-muted-foreground">
                  Associe cada coluna do CSV ao campo correspondente do sistema
                </p>
              </div>

              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {headers.map((header) => (
                    <div key={header} className="flex items-center gap-4">
                      <div className="w-1/2">
                        <Label className="text-sm font-medium">{header}</Label>
                        <p className="text-xs text-muted-foreground">
                          Exemplo: {csvData[0]?.[headers.indexOf(header)] || "-"}
                        </p>
                      </div>
                      <div className="w-1/2">
                        <Select
                          value={mapping[header] || "skip"}
                          onValueChange={(value) => handleMappingChange(header, value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {systemFields.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                                {field.required && " *"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Voltar
                </Button>
                <Button onClick={handlePreview}>Próximo: Preview</Button>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              <h4 className="font-medium">Preview dos Dados (primeiras 5 linhas)</h4>

              <ScrollArea className="h-48">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {Object.entries(mapping)
                        .filter(([, v]) => v !== "skip")
                        .map(([, field]) => (
                          <th key={field} className="text-left p-2 font-medium">
                            {systemFields.find((f) => f.value === field)?.label}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i} className="border-b">
                        {Object.entries(mapping)
                          .filter(([, v]) => v !== "skip")
                          .map(([csvCol]) => (
                            <td key={csvCol} className="p-2">
                              {row[headers.indexOf(csvCol)] || "-"}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="font-medium">Resumo da Importação</p>
                <p className="text-sm text-muted-foreground">
                  Total de linhas: {csvData.length} alunos serão importados
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  Voltar
                </Button>
                <Button onClick={handleImport}>Iniciar Importação</Button>
              </div>
            </div>
          )}

          {/* Step: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium">Importando alunos...</p>
              <div className="w-full max-w-md">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-center text-muted-foreground mt-2">
                  {progress}% concluído
                </p>
              </div>
            </div>
          )}

          {/* Step: Complete */}
          {step === "complete" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <Check className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-lg font-medium">Importação Concluída!</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{results.success}</p>
                  <p className="text-sm text-green-600">Importados com sucesso</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                  <p className="text-sm text-red-600">Falhas</p>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    Erros encontrados
                  </h4>
                  <ScrollArea className="h-32">
                    <ul className="text-sm space-y-1">
                      {results.errors.map((err, i) => (
                        <li key={i} className="text-muted-foreground">
                          {err}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setOpen(false);
                    resetState();
                  }}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
