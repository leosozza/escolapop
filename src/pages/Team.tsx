import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Users,
  Loader2,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Shield,
  GraduationCap,
  Headphones,
  Camera,
  Eye as EyeIcon,
  DoorOpen,
  Handshake,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ROLE_CONFIG, type AppRole } from '@/types/database';

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  roles: AppRole[];
}

const ROLE_ICONS: Record<AppRole, any> = {
  admin: Shield,
  gestor: BarChart3,
  agente_comercial: Handshake,
  recepcao: DoorOpen,
  professor: GraduationCap,
  produtor: Camera,
  scouter: EyeIcon,
  aluno: Users,
};

export default function Team() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      // Fetch all staff profiles with their roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          role,
          profile:profiles!user_roles_user_id_fkey(id, user_id, full_name, avatar_url, phone)
        `)
        .neq('role', 'aluno');

      if (rolesError) throw rolesError;

      // Group by user
      const memberMap = new Map<string, TeamMember>();
      (rolesData || []).forEach((item: any) => {
        if (!item.profile) return;
        
        const userId = item.user_id;
        if (memberMap.has(userId)) {
          memberMap.get(userId)!.roles.push(item.role);
        } else {
          memberMap.set(userId, {
            id: item.profile.id,
            user_id: userId,
            full_name: item.profile.full_name,
            avatar_url: item.profile.avatar_url,
            phone: item.profile.phone,
            roles: [item.role],
          });
        }
      });

      setMembers(Array.from(memberMap.values()));
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

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || m.roles.includes(activeTab as AppRole);
    return matchesSearch && matchesTab;
  });

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getRoleStats = () => {
    const stats: Record<string, number> = { all: members.length };
    members.forEach(m => {
      m.roles.forEach(role => {
        stats[role] = (stats[role] || 0) + 1;
      });
    });
    return stats;
  };

  const roleStats = getRoleStats();

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
            Gestão de colaboradores e permissões
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar membro..."
              className="pl-10 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button className="bg-gradient-primary hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Membro
          </Button>
        </div>
      </div>

      {/* Tabs by Role */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-2 bg-transparent p-0">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            Todos ({roleStats.all || 0})
          </TabsTrigger>
          {(Object.keys(ROLE_CONFIG) as AppRole[])
            .filter(role => role !== 'aluno' && roleStats[role])
            .map(role => {
              const config = ROLE_CONFIG[role];
              const Icon = ROLE_ICONS[role];
              return (
                <TabsTrigger
                  key={role}
                  value={role}
                  className="data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {config.label} ({roleStats[role] || 0})
                </TabsTrigger>
              );
            })}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {/* Members Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Users className="mx-auto h-12 w-12 opacity-50 mb-2" />
                <p>Nenhum membro encontrado</p>
              </div>
            ) : (
              filteredMembers.map((member) => (
                <Card key={member.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="bg-gradient-primary text-white text-lg">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{member.full_name}</p>
                          {member.phone && (
                            <p className="text-sm text-muted-foreground">{member.phone}</p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Shield className="h-4 w-4 mr-2" />
                            Gerenciar roles
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {member.roles.map((role) => {
                        const config = ROLE_CONFIG[role];
                        const Icon = ROLE_ICONS[role];
                        return (
                          <Badge key={role} variant="secondary" className="flex items-center gap-1">
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
