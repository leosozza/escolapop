import { LayoutGrid, List, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CRMViewMode } from "@/types/crm";
import { cn } from "@/lib/utils";

interface ViewToggleProps {
  currentView: CRMViewMode;
  onViewChange: (view: CRMViewMode) => void;
}

const views: { mode: CRMViewMode; icon: React.ComponentType<{ className?: string }>; label: string; description: string }[] = [
  { mode: 'list', icon: List, label: 'Lista', description: 'Visualização em lista com filtros e ordenação' },
  { mode: 'kanban', icon: LayoutGrid, label: 'Kanban', description: 'Arraste leads entre colunas de status' },
  { mode: 'pipeline', icon: GitBranch, label: 'Pipeline', description: 'Métricas de funil por estágio' },
];

export function ViewToggle({ currentView, onViewChange }: ViewToggleProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center bg-muted/80 rounded-lg p-1 border border-border/50 shadow-sm">
        {views.map(({ mode, icon: Icon, label, description }) => (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewChange(mode)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 transition-all duration-200",
                  currentView === mode 
                    ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" 
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline text-sm font-medium">{label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-[200px]">
              {description}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
