import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LeadSource } from "@/types/crm";
import * as LucideIcons from "lucide-react";

const availableIcons = [
  "Globe", "MessageCircle", "Instagram", "Facebook", "Search", 
  "Users", "MapPin", "Database", "FileSpreadsheet", "Phone",
  "Mail", "Smartphone", "Monitor", "Video", "Megaphone"
];

const availableColors = [
  "#25D366", "#E4405F", "#1877F2", "#4285F4", "#8B5CF6",
  "#06B6D4", "#F59E0B", "#00AEEF", "#10B981", "#6B7280",
  "#EF4444", "#EC4899", "#14B8A6", "#F97316", "#84CC16"
];

export function LeadSourceManager() {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newSource, setNewSource] = useState({ name: "", icon: "Globe", color: "#6B7280" });
  const { toast } = useToast();

  const fetchSources = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("lead_sources")
      .select("*")
      .order("is_system", { ascending: false })
      .order("name");

    if (error) {
      toast({ title: "Erro ao carregar fontes", variant: "destructive" });
    } else {
      setSources(data as LeadSource[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchSources();
    }
  }, [open]);

  const handleAddSource = async () => {
    if (!newSource.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("lead_sources")
      .insert({
        name: newSource.name.trim(),
        icon: newSource.icon,
        color: newSource.color,
        is_system: false,
      });

    if (error) {
      toast({ title: "Erro ao criar fonte", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Fonte criada com sucesso" });
      setNewSource({ name: "", icon: "Globe", color: "#6B7280" });
      fetchSources();
    }
  };

  const handleToggleActive = async (source: LeadSource) => {
    const { error } = await supabase
      .from("lead_sources")
      .update({ is_active: !source.is_active })
      .eq("id", source.id);

    if (error) {
      toast({ title: "Erro ao atualizar fonte", variant: "destructive" });
    } else {
      fetchSources();
    }
  };

  const handleDeleteSource = async (source: LeadSource) => {
    if (source.is_system) {
      toast({ title: "Fontes do sistema não podem ser excluídas", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("lead_sources")
      .delete()
      .eq("id", source.id);

    if (error) {
      toast({ title: "Erro ao excluir fonte", description: "Pode haver leads usando esta fonte", variant: "destructive" });
    } else {
      toast({ title: "Fonte excluída" });
      fetchSources();
    }
  };

  const getIconComponent = (iconName: string) => {
    const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[iconName];
    return IconComponent || LucideIcons.Globe;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Fontes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Fontes de Leads</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add new source form */}
          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-medium">Nova Fonte</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={newSource.name}
                  onChange={(e) => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: TikTok"
                />
              </div>
              <div className="space-y-2">
                <Label>Ícone</Label>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {availableIcons.map((iconName) => {
                    const IconComp = getIconComponent(iconName);
                    return (
                      <button
                        key={iconName}
                        onClick={() => setNewSource(prev => ({ ...prev, icon: iconName }))}
                        className={`p-1.5 rounded border transition-all ${
                          newSource.icon === iconName 
                            ? "border-primary bg-primary/10" 
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <IconComp className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-1">
                  {availableColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewSource(prev => ({ ...prev, color }))}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        newSource.color === color 
                          ? "border-foreground scale-110" 
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <Button onClick={handleAddSource} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Fonte
            </Button>
          </div>

          {/* Sources list */}
          <div className="space-y-2">
            <h4 className="font-medium">Fontes Cadastradas</h4>
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {sources.map((source) => {
                    const IconComp = getIconComponent(source.icon);
                    return (
                      <div 
                        key={source.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: `${source.color}20` }}
                          >
                            <IconComp 
                              className="h-4 w-4" 
                              style={{ color: source.color }}
                            />
                          </div>
                          <div>
                            <p className="font-medium">{source.name}</p>
                            {source.is_system && (
                              <span className="text-xs text-muted-foreground">Sistema</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`active-${source.id}`} className="text-sm text-muted-foreground">
                              Ativo
                            </Label>
                            <Switch
                              id={`active-${source.id}`}
                              checked={source.is_active}
                              onCheckedChange={() => handleToggleActive(source)}
                            />
                          </div>
                          {!source.is_system && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSource(source)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
