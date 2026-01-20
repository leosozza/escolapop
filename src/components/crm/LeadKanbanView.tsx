import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Eye, Edit, Calendar, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExtendedLead, LeadSource } from "@/types/crm";
import { LEAD_STATUS_CONFIG, LeadStatus } from "@/types/database";
import * as LucideIcons from "lucide-react";

interface LeadKanbanViewProps {
  leads: ExtendedLead[];
  sources: LeadSource[];
  onViewDetails: (lead: ExtendedLead) => void;
  onEdit: (lead: ExtendedLead) => void;
  onSchedule: (lead: ExtendedLead) => void;
  onStatusChange: (lead: ExtendedLead, newStatus: LeadStatus) => void;
}

const PIPELINE_COLUMNS: { status: LeadStatus; label: string; color: string }[] = [
  { status: "lead", label: "Novos", color: "bg-blue-500" },
  { status: "em_atendimento", label: "Em Atendimento", color: "bg-yellow-500" },
  { status: "agendado", label: "Agendados", color: "bg-purple-500" },
  { status: "confirmado", label: "Confirmados", color: "bg-green-500" },
  { status: "compareceu", label: "Compareceram", color: "bg-teal-500" },
  { status: "proposta", label: "Propostas", color: "bg-orange-500" },
  { status: "matriculado", label: "Matriculados", color: "bg-emerald-500" },
  { status: "perdido", label: "Perdidos", color: "bg-red-500" },
];

export function LeadKanbanView({
  leads,
  sources,
  onViewDetails,
  onEdit,
  onSchedule,
  onStatusChange,
}: LeadKanbanViewProps) {
  const getLeadsByStatus = (status: LeadStatus) => {
    return leads.filter((lead) => lead.status === status);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getSourceInfo = (lead: ExtendedLead) => {
    if (lead.source_id && lead.lead_source) {
      return lead.lead_source;
    }
    const source = sources.find(s => s.name.toLowerCase() === lead.source?.toLowerCase());
    return source || { name: lead.source || "Outro", icon: "Globe", color: "#6B7280" };
  };

  const getIconComponent = (iconName: string) => {
    const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[iconName];
    return IconComponent || LucideIcons.Globe;
  };

  const handleDragStart = (e: React.DragEvent, lead: ExtendedLead) => {
    e.dataTransfer.setData("leadId", lead.id);
    e.dataTransfer.setData("leadData", JSON.stringify(lead));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: LeadStatus) => {
    e.preventDefault();
    const leadData = e.dataTransfer.getData("leadData");
    if (leadData) {
      const lead = JSON.parse(leadData) as ExtendedLead;
      if (lead.status !== newStatus) {
        onStatusChange(lead, newStatus);
      }
    }
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {PIPELINE_COLUMNS.map((column) => {
          const columnLeads = getLeadsByStatus(column.status);
          return (
            <div
              key={column.status}
              className="w-72 flex-shrink-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.status)}
            >
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-3 h-3 rounded-full ${column.color}`} />
                <h3 className="font-medium">{column.label}</h3>
                <Badge variant="secondary" className="ml-auto">
                  {columnLeads.length}
                </Badge>
              </div>

              {/* Column Content */}
              <div className="space-y-2 min-h-96 bg-muted/30 rounded-lg p-2">
                {columnLeads.map((lead) => {
                  const sourceInfo = getSourceInfo(lead);
                  const SourceIcon = getIconComponent(sourceInfo.icon || "Globe");

                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead)}
                      className="bg-background rounded-lg p-3 shadow-sm border cursor-move hover:shadow-md transition-shadow"
                    >
                      {/* Lead Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getInitials(lead.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm line-clamp-1">{lead.full_name}</p>
                            {lead.guardian_name && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                Resp: {lead.guardian_name}
                              </p>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewDetails(lead)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(lead)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSchedule(lead)}>
                              <Calendar className="mr-2 h-4 w-4" />
                              Agendar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Contact Info */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <Phone className="h-3 w-3" />
                        {lead.phone}
                      </div>

                      {/* Course & Source */}
                      <div className="flex items-center justify-between">
                        {lead.course?.name && (
                          <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                            {lead.course.name}
                          </span>
                        )}
                        <div
                          className="p-1 rounded"
                          style={{ backgroundColor: `${sourceInfo.color}20` }}
                          title={sourceInfo.name}
                        >
                          <SourceIcon 
                            className="h-3 w-3" 
                            style={{ color: sourceInfo.color }}
                          />
                        </div>
                      </div>

                      {/* Scheduled Date */}
                      {lead.scheduled_at && (
                        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                          📅 {format(new Date(lead.scheduled_at), "dd/MM HH:mm", { locale: ptBR })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {columnLeads.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                    Nenhum lead
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
