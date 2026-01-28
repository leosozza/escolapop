import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SECTORS = [
  { value: 'recepcao', label: 'Recepção' },
  { value: 'departamento_matricula', label: 'Departamento de Matrícula' },
  { value: 'professor_teatro', label: 'Professor de Teatro' },
  { value: 'professor_passarela', label: 'Professor de Passarela' },
  { value: 'professor_influencia', label: 'Professor de Influência' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'produtor', label: 'Produtor' },
] as const;

const AREAS = [
  { value: 'comercial', label: 'Comercial' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'academico', label: 'Acadêmico' },
  { value: 'gestao', label: 'Gestão' },
] as const;

type SectorValue = typeof SECTORS[number]['value'];
type AreaValue = typeof AREAS[number]['value'];

interface AddTeamMemberDialogProps {
  onSuccess: () => void;
}

export function AddTeamMemberDialog({ onSuccess }: AddTeamMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [sector, setSector] = useState<SectorValue | ''>('');
  const [selectedAreas, setSelectedAreas] = useState<AreaValue[]>([]);
  const [showInAll, setShowInAll] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setFullName('');
    setPhone('');
    setSector('');
    setSelectedAreas([]);
    setShowInAll(false);
  };

  const toggleArea = (area: AreaValue) => {
    setSelectedAreas(prev =>
      prev.includes(area)
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim() || !sector) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha o nome e o cargo do colaborador.',
      });
      return;
    }

    if (!showInAll && selectedAreas.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Área obrigatória',
        description: 'Selecione pelo menos uma área ou marque "Todas as áreas".',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('team_members').insert({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        sector: sector as SectorValue,
        areas: selectedAreas,
        show_in_all: showInAll,
      });

      if (error) throw error;

      toast({
        title: 'Colaborador adicionado',
        description: `${fullName} foi adicionado à equipe.`,
      });

      resetForm();
      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Error adding team member:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao adicionar',
        description: 'Não foi possível adicionar o colaborador.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" />
          Novo Colaborador
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Colaborador</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome Completo *</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome do colaborador"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label>Cargo *</Label>
            <Select value={sector} onValueChange={(v) => setSector(v as SectorValue)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cargo" />
              </SelectTrigger>
              <SelectContent>
                {SECTORS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Áreas de Atuação *</Label>
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="showInAll"
                checked={showInAll}
                onCheckedChange={(checked) => {
                  setShowInAll(checked as boolean);
                  if (checked) setSelectedAreas([]);
                }}
              />
              <label htmlFor="showInAll" className="text-sm font-medium cursor-pointer">
                Todas as áreas
              </label>
            </div>
            {!showInAll && (
              <div className="grid grid-cols-2 gap-2">
                {AREAS.map((area) => (
                  <div key={area.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={area.value}
                      checked={selectedAreas.includes(area.value)}
                      onCheckedChange={() => toggleArea(area.value)}
                    />
                    <label htmlFor={area.value} className="text-sm cursor-pointer">
                      {area.label}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
