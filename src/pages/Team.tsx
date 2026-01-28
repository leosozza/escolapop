import { useState, useEffect } from 'react';
import {
  Search,
  Users,
  Loader2,
  MoreHorizontal,
  Edit,
  Trash2,
  Phone,
  DoorOpen,
  GraduationCap,
  Briefcase,
  Camera,
  ClipboardList,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AddTeamMemberDialog } from '@/components/team/AddTeamMemberDialog';
import { EditTeamMemberDialog } from '@/components/team/EditTeamMemberDialog';

const SECTORS = {
  recepcao: { label: 'Recepção', icon: DoorOpen },
  departamento_matricula: { label: 'Dept. Matrícula', icon: ClipboardList },
  professor_teatro: { label: 'Prof. Teatro', icon: GraduationCap },
  professor_passarela: { label: 'Prof. Passarela', icon: GraduationCap },
  professor_influencia: { label: 'Prof. Influência', icon: GraduationCap },
  administrativo: { label: 'Administrativo', icon: Briefcase },
  produtor: { label: 'Produtor', icon: Camera },
} as const;

const AREAS = {
  comercial: { label: 'Comercial', color: 'bg-blue-500/10 text-blue-600' },
  financeiro: { label: 'Financeiro', color: 'bg-green-500/10 text-green-600' },
  academico: { label: 'Acadêmico', color: 'bg-purple-500/10 text-purple-600' },
  gestao: { label: 'Gestão', color: 'bg-orange-500/10 text-orange-600' },
} as const;

type SectorKey = keyof typeof SECTORS;
type AreaKey = keyof typeof AREAS;

interface TeamMember {
  id: string;
  full_name: string;
  phone: string | null;
  sector: SectorKey;
  areas: AreaKey[];
  show_in_all: boolean;
  avatar_url: string | null;
  is_active: boolean;
}

export default function Team() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;

      setMembers((data || []) as TeamMember[]);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar equipe',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingMember) return;
    
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ is_active: false })
        .eq('id', deletingMember.id);

      if (error) throw error;

      toast({
        title: 'Colaborador removido',
        description: `${deletingMember.full_name} foi removido da equipe.`,
      });

      setDeletingMember(null);
      fetchTeamMembers();
    } catch (error) {
      console.error('Error deleting team member:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao remover',
        description: 'Não foi possível remover o colaborador.',
      });
    }
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    // Filter by area
    if (m.show_in_all) return matchesSearch;
    return matchesSearch && m.areas.includes(activeTab as AreaKey);
  });

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getAreaStats = () => {
    const stats: Record<string, number> = { all: members.length };
    Object.keys(AREAS).forEach(area => {
      stats[area] = members.filter(m => m.show_in_all || m.areas.includes(area as AreaKey)).length;
    });
    return stats;
  };

  const areaStats = getAreaStats();

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Equipe</h1>
          <p className="text-muted-foreground">
            Gestão de colaboradores por área
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar colaborador..."
              className="pl-10 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <AddTeamMemberDialog onSuccess={fetchTeamMembers} />
        </div>
      </div>

      {/* Tabs by Area */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-2 bg-transparent p-0">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Todos ({areaStats.all || 0})
          </TabsTrigger>
          {(Object.entries(AREAS) as [AreaKey, typeof AREAS[AreaKey]][]).map(([key, config]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {config.label} ({areaStats[key] || 0})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {/* Members Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMembers.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Users className="mx-auto h-12 w-12 opacity-50 mb-2" />
                <p>Nenhum colaborador encontrado</p>
              </div>
            ) : (
              filteredMembers.map((member) => {
                const sectorConfig = SECTORS[member.sector];
                const SectorIcon = sectorConfig?.icon || Users;
                
                return (
                  <Card key={member.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                            <AvatarImage src={member.avatar_url || undefined} />
                            <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                              {getInitials(member.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{member.full_name}</p>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <SectorIcon className="h-3 w-3" />
                              <span className="truncate">{sectorConfig?.label}</span>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background">
                            <DropdownMenuItem onClick={() => setEditingMember(member)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => setDeletingMember(member)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      {member.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <Phone className="h-3 w-3" />
                          <span>{member.phone}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {member.show_in_all ? (
                          <Badge variant="secondary" className="text-xs">
                            Todas as áreas
                          </Badge>
                        ) : (
                          member.areas.map((area) => {
                            const areaConfig = AREAS[area];
                            return (
                              <Badge 
                                key={area} 
                                variant="secondary" 
                                className={`text-xs ${areaConfig?.color || ''}`}
                              >
                                {areaConfig?.label || area}
                              </Badge>
                            );
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <EditTeamMemberDialog
        member={editingMember}
        open={!!editingMember}
        onOpenChange={(open) => !open && setEditingMember(null)}
        onSuccess={fetchTeamMembers}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingMember} onOpenChange={(open) => !open && setDeletingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingMember?.full_name} será removido da equipe. Esta ação pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
