import { LayoutGrid, List, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CRMViewMode } from "@/types/crm";
import { cn } from "@/lib/utils";

interface ViewToggleProps {
  currentView: CRMViewMode;
  onViewChange: (view: CRMViewMode) => void;
}

const views: { mode: CRMViewMode; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { mode: 'list', icon: List, label: 'Lista' },
  { mode: 'kanban', icon: LayoutGrid, label: 'Kanban' },
  { mode: 'pipeline', icon: GitBranch, label: 'Pipeline' },
];

export function ViewToggle({ currentView, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center bg-muted rounded-lg p-1">
      {views.map(({ mode, icon: Icon, label }) => (
        <Button
          key={mode}
          variant="ghost"
          size="sm"
          onClick={() => onViewChange(mode)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 transition-all",
            currentView === mode 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">{label}</span>
        </Button>
      ))}
    </div>
  );
}
