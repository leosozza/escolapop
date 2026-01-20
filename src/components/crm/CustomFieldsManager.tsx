import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sliders, Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CustomField } from "@/types/crm";

const fieldTypes = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Seleção" },
  { value: "boolean", label: "Sim/Não" },
];

export function CustomFieldsManager() {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newField, setNewField] = useState<{
    field_name: string;
    field_label: string;
    field_type: "text" | "number" | "date" | "select" | "boolean";
    is_required: boolean;
    options: string;
  }>({
    field_name: "",
    field_label: "",
    field_type: "text",
    is_required: false,
    options: "",
  });
  const { toast } = useToast();

  const fetchFields = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("custom_fields")
      .select("*")
      .eq("entity_type", "lead")
      .order("order_index");

    if (error) {
      toast({ title: "Erro ao carregar campos", variant: "destructive" });
    } else {
      setFields(data as CustomField[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchFields();
    }
  }, [open]);

  const handleAddField = async () => {
    if (!newField.field_name.trim() || !newField.field_label.trim()) {
      toast({ title: "Nome e label são obrigatórios", variant: "destructive" });
      return;
    }

    // Convert field_name to snake_case
    const fieldName = newField.field_name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

    let options = null;
    if (newField.field_type === "select" && newField.options) {
      options = newField.options.split(",").map(opt => opt.trim()).filter(Boolean);
    }

    const { error } = await supabase
      .from("custom_fields")
      .insert({
        entity_type: "lead",
        field_name: fieldName,
        field_label: newField.field_label.trim(),
        field_type: newField.field_type,
        is_required: newField.is_required,
        options,
        order_index: fields.length,
      });

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Campo com este nome já existe", variant: "destructive" });
      } else {
        toast({ title: "Erro ao criar campo", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Campo criado com sucesso" });
      setNewField({ field_name: "", field_label: "", field_type: "text", is_required: false, options: "" });
      fetchFields();
    }
  };

  const handleToggleActive = async (field: CustomField) => {
    const { error } = await supabase
      .from("custom_fields")
      .update({ is_active: !field.is_active })
      .eq("id", field.id);

    if (error) {
      toast({ title: "Erro ao atualizar campo", variant: "destructive" });
    } else {
      fetchFields();
    }
  };

  const handleToggleRequired = async (field: CustomField) => {
    const { error } = await supabase
      .from("custom_fields")
      .update({ is_required: !field.is_required })
      .eq("id", field.id);

    if (error) {
      toast({ title: "Erro ao atualizar campo", variant: "destructive" });
    } else {
      fetchFields();
    }
  };

  const handleDeleteField = async (field: CustomField) => {
    const { error } = await supabase
      .from("custom_fields")
      .delete()
      .eq("id", field.id);

    if (error) {
      toast({ title: "Erro ao excluir campo", description: "Pode haver leads usando este campo", variant: "destructive" });
    } else {
      toast({ title: "Campo excluído" });
      fetchFields();
    }
  };

  const getTypeLabel = (type: string) => {
    return fieldTypes.find(t => t.value === type)?.label || type;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sliders className="h-4 w-4" />
          Campos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Campos Personalizados</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add new field form */}
          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-medium">Novo Campo</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome Interno</Label>
                <Input
                  value={newField.field_name}
                  onChange={(e) => setNewField(prev => ({ ...prev, field_name: e.target.value }))}
                  placeholder="Ex: data_nascimento"
                />
              </div>
              <div className="space-y-2">
                <Label>Label de Exibição</Label>
                <Input
                  value={newField.field_label}
                  onChange={(e) => setNewField(prev => ({ ...prev, field_label: e.target.value }))}
                  placeholder="Ex: Data de Nascimento"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select 
                  value={newField.field_type} 
                  onValueChange={(value: "text" | "number" | "date" | "select" | "boolean") => 
                    setNewField(prev => ({ ...prev, field_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4 pt-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newField.is_required}
                    onCheckedChange={(checked) => setNewField(prev => ({ ...prev, is_required: checked }))}
                  />
                  <Label>Obrigatório</Label>
                </div>
              </div>
            </div>
            {newField.field_type === "select" && (
              <div className="space-y-2">
                <Label>Opções (separadas por vírgula)</Label>
                <Input
                  value={newField.options}
                  onChange={(e) => setNewField(prev => ({ ...prev, options: e.target.value }))}
                  placeholder="Ex: Opção 1, Opção 2, Opção 3"
                />
              </div>
            )}
            <Button onClick={handleAddField} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Campo
            </Button>
          </div>

          {/* Fields list */}
          <div className="space-y-2">
            <h4 className="font-medium">Campos Cadastrados</h4>
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : fields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum campo personalizado cadastrado
              </p>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {fields.map((field) => (
                    <div 
                      key={field.id}
                      className={`flex items-center justify-between p-3 border rounded-lg ${
                        !field.is_active ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                        <div>
                          <p className="font-medium">{field.field_label}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{field.field_name}</span>
                            <span>•</span>
                            <span>{getTypeLabel(field.field_type)}</span>
                            {field.is_required && (
                              <>
                                <span>•</span>
                                <span className="text-destructive">Obrigatório</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`required-${field.id}`} className="text-xs text-muted-foreground">
                            Obrig.
                          </Label>
                          <Switch
                            id={`required-${field.id}`}
                            checked={field.is_required}
                            onCheckedChange={() => handleToggleRequired(field)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`active-${field.id}`} className="text-xs text-muted-foreground">
                            Ativo
                          </Label>
                          <Switch
                            id={`active-${field.id}`}
                            checked={field.is_active}
                            onCheckedChange={() => handleToggleActive(field)}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteField(field)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
