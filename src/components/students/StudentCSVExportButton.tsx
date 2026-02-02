import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EnrollmentData {
  id: string;
  lead_id: string;
  status: string;
  enrolled_at: string;
  enrollment_type?: string | null;
  influencer_name?: string | null;
  referral_agent_code?: string | null;
  student_age?: number | null;
  course: {
    id: string;
    name: string;
  } | null;
  lead: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
  } | null;
  class: {
    id: string;
    name: string;
    start_date: string;
    end_date: string | null;
    teacher: {
      full_name: string;
    } | null;
  } | null;
}

interface StudentCSVExportButtonProps {
  enrollments: EnrollmentData[] | undefined;
}

const ENROLLMENT_TYPE_LABELS: Record<string, string> = {
  modelo_agenciado_maxfama: "MaxFama",
  modelo_agenciado_popschool: "Pop School",
  indicacao_influencia: "Indicação Influência",
  indicacao_aluno: "Indicação Aluno",
};

const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  em_curso: "Em Curso",
  inadimplente: "Inadimplente",
  evasao: "Evasão",
  concluido: "Concluído",
  trancado: "Trancado",
};

export function StudentCSVExportButton({ enrollments }: StudentCSVExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const exportToCSV = (includeAll: boolean = true) => {
    if (!enrollments || enrollments.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há matrículas para exportar.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      const headers = [
        "Nome do Aluno",
        "Telefone",
        "Email",
        "Idade",
        "Curso",
        "Turma",
        "Professor",
        "Status",
        "Tipo de Matrícula",
        "Data de Matrícula",
        "Código do Agente",
        "Influenciador",
      ];

      const rows = enrollments.map((e) => [
        e.lead?.full_name || "",
        e.lead?.phone || "",
        e.lead?.email || "",
        e.student_age?.toString() || "",
        e.course?.name || "",
        e.class?.name || "",
        e.class?.teacher?.full_name || "",
        STATUS_LABELS[e.status] || e.status,
        e.enrollment_type ? ENROLLMENT_TYPE_LABELS[e.enrollment_type] || e.enrollment_type : "",
        e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString("pt-BR") : "",
        e.referral_agent_code || "",
        e.influencer_name || "",
      ]);

      // Escape values for CSV
      const escapeCSV = (value: string) => {
        if (value.includes(";") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const csvContent = [
        headers.join(";"),
        ...rows.map((row) => row.map(escapeCSV).join(";")),
      ].join("\n");

      // Add BOM for UTF-8 encoding (Excel compatibility)
      const blob = new Blob(["\ufeff" + csvContent], {
        type: "text/csv;charset=utf-8",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `alunos_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportação concluída",
        description: `${enrollments.length} matrículas exportadas com sucesso.`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportToCSV(true)} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Exportar todos ({enrollments?.length || 0})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
