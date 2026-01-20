import { useMemo } from "react";
import { ArrowRight, Users, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ExtendedLead } from "@/types/crm";
import { LEAD_STATUS_CONFIG, LeadStatus } from "@/types/database";

interface LeadPipelineViewProps {
  leads: ExtendedLead[];
  onStageClick: (status: LeadStatus) => void;
}

const PIPELINE_STAGES: { status: LeadStatus; label: string; color: string; bgColor: string }[] = [
  { status: "lead", label: "Leads", color: "text-blue-600", bgColor: "bg-blue-500" },
  { status: "em_atendimento", label: "Em Atendimento", color: "text-yellow-600", bgColor: "bg-yellow-500" },
  { status: "agendado", label: "Agendados", color: "text-purple-600", bgColor: "bg-purple-500" },
  { status: "confirmado", label: "Confirmados", color: "text-green-600", bgColor: "bg-green-500" },
  { status: "compareceu", label: "Compareceram", color: "text-teal-600", bgColor: "bg-teal-500" },
  { status: "proposta", label: "Propostas", color: "text-orange-600", bgColor: "bg-orange-500" },
  { status: "matriculado", label: "Matriculados", color: "text-emerald-600", bgColor: "bg-emerald-500" },
];

export function LeadPipelineView({ leads, onStageClick }: LeadPipelineViewProps) {
  const pipelineData = useMemo(() => {
    const totalLeads = leads.filter(l => l.status !== "perdido").length;
    const lostLeads = leads.filter(l => l.status === "perdido").length;

    return PIPELINE_STAGES.map((stage, index) => {
      const count = leads.filter(l => l.status === stage.status).length;
      const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
      
      // Calculate conversion rate from previous stage
      let conversionRate = 100;
      if (index > 0) {
        const prevStageCount = leads.filter(l => l.status === PIPELINE_STAGES[index - 1].status).length;
        if (prevStageCount > 0) {
          conversionRate = (count / prevStageCount) * 100;
        }
      }

      return {
        ...stage,
        count,
        percentage,
        conversionRate,
      };
    });
  }, [leads]);

  const lostCount = leads.filter(l => l.status === "perdido").length;
  const totalActive = leads.filter(l => l.status !== "perdido").length;
  const enrolledCount = leads.filter(l => l.status === "matriculado").length;
  const overallConversion = totalActive > 0 ? (enrolledCount / (totalActive + lostCount)) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Ativos</p>
                <p className="text-2xl font-bold">{totalActive}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Matriculados</p>
                <p className="text-2xl font-bold text-emerald-600">{enrolledCount}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Perdidos</p>
                <p className="text-2xl font-bold text-red-600">{lostCount}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversão Geral</p>
                <p className="text-2xl font-bold text-primary">{overallConversion.toFixed(1)}%</p>
              </div>
              <div className="h-12 w-12 rounded-full border-4 border-primary flex items-center justify-center">
                <span className="text-xs font-bold">{overallConversion.toFixed(0)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Funnel */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-6">Funil de Vendas</h3>
          
          <div className="space-y-4">
            {pipelineData.map((stage, index) => (
              <div key={stage.status} className="relative">
                <div 
                  className="flex items-center gap-4 cursor-pointer group"
                  onClick={() => onStageClick(stage.status)}
                >
                  {/* Stage bar */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${stage.bgColor}`} />
                        <span className="font-medium">{stage.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-mono">
                          {stage.count}
                        </Badge>
                        {index > 0 && (
                          <span className={`text-sm ${stage.conversionRate >= 50 ? 'text-green-600' : 'text-orange-600'}`}>
                            {stage.conversionRate.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="relative h-10 bg-muted rounded-lg overflow-hidden group-hover:ring-2 ring-primary/20 transition-all">
                      <div 
                        className={`absolute inset-y-0 left-0 ${stage.bgColor} transition-all duration-500`}
                        style={{ 
                          width: `${Math.max(stage.percentage, 2)}%`,
                          clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 50%, calc(100% - 20px) 100%, 0 100%)'
                        }}
                      />
                      <div className="absolute inset-0 flex items-center px-4">
                        <span className="text-sm font-medium text-foreground">
                          {stage.percentage.toFixed(1)}% do total
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow between stages */}
                {index < pipelineData.length - 1 && (
                  <div className="flex justify-center my-2">
                    <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                  </div>
                )}
              </div>
            ))}

            {/* Lost leads section */}
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="font-medium text-red-600">Perdidos</span>
                    </div>
                    <Badge variant="destructive" className="font-mono">
                      {lostCount}
                    </Badge>
                  </div>
                  <Progress 
                    value={(lostCount / (totalActive + lostCount)) * 100} 
                    className="h-2 bg-red-100"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversion insights */}
      <div className="grid grid-cols-3 gap-4">
        {pipelineData.slice(1).map((stage, index) => {
          const prevStage = pipelineData[index];
          const isGoodConversion = stage.conversionRate >= 50;
          
          return (
            <Card key={stage.status} className={isGoodConversion ? "border-green-200" : "border-orange-200"}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">
                  {prevStage.label} → {stage.label}
                </p>
                <div className="flex items-center gap-2">
                  {isGoodConversion ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-orange-500" />
                  )}
                  <span className={`text-lg font-bold ${isGoodConversion ? 'text-green-600' : 'text-orange-600'}`}>
                    {stage.conversionRate.toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
