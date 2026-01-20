import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Mail, MoreHorizontal, Eye, Edit, Calendar, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ExtendedLead, LeadSource } from "@/types/crm";
import { LEAD_STATUS_CONFIG } from "@/types/database";
import * as LucideIcons from "lucide-react";

interface LeadListViewProps {
  leads: ExtendedLead[];
  sources: LeadSource[];
  onViewDetails: (lead: ExtendedLead) => void;
  onEdit: (lead: ExtendedLead) => void;
  onSchedule: (lead: ExtendedLead) => void;
  onDelete: (lead: ExtendedLead) => void;
  isAdmin: boolean;
}

export function LeadListView({
  leads,
  sources,
  onViewDetails,
  onEdit,
  onSchedule,
  onDelete,
  isAdmin,
}: LeadListViewProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
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

  return (
    <ScrollArea className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Fonte</TableHead>
            <TableHead>Campanha</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead>Agendamento</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                Nenhum lead encontrado
              </TableCell>
            </TableRow>
          ) : (
            leads.map((lead, index) => {
              const statusConfig = LEAD_STATUS_CONFIG[lead.status as keyof typeof LEAD_STATUS_CONFIG];
              const sourceInfo = getSourceInfo(lead);
              const SourceIcon = getIconComponent(sourceInfo.icon || "Globe");

              return (
                <TableRow 
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onViewDetails(lead)}
                >
                  <TableCell className="font-medium text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(lead.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{lead.full_name}</p>
                        {lead.course?.name && (
                          <p className="text-xs text-muted-foreground">{lead.course.name}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {lead.guardian_name || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {lead.phone}
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {lead.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="p-1.5 rounded"
                        style={{ backgroundColor: `${sourceInfo.color}20` }}
                      >
                        <SourceIcon 
                          className="h-3 w-3" 
                          style={{ color: sourceInfo.color }}
                        />
                      </div>
                      <span className="text-sm">{sourceInfo.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.campaign || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary"
                      className={`${statusConfig?.bgColor} ${statusConfig?.color} border-0`}
                    >
                      {statusConfig?.label || lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(lead.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {lead.scheduled_at ? (
                      <span className="text-primary font-medium">
                        {formatDate(lead.scheduled_at)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onViewDetails(lead);
                        }}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onEdit(lead);
                        }}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onSchedule(lead);
                        }}>
                          <Calendar className="mr-2 h-4 w-4" />
                          Agendar
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(lead);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
