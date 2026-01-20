import { Badge } from '@/components/ui/badge';
import { ROLE_CONFIG, type AppRole } from '@/types/database';
import { 
  Shield, 
  BarChart3, 
  Handshake, 
  DoorOpen, 
  GraduationCap, 
  Camera, 
  Eye, 
  BookOpen 
} from 'lucide-react';

const roleIcons = {
  admin: Shield,
  gestor: BarChart3,
  agente_comercial: Handshake,
  recepcao: DoorOpen,
  professor: GraduationCap,
  produtor: Camera,
  scouter: Eye,
  aluno: BookOpen,
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-destructive/10 text-destructive border-destructive/20',
  gestor: 'bg-warning/10 text-warning border-warning/20',
  agente_comercial: 'bg-success/10 text-success border-success/20',
  recepcao: 'bg-info/10 text-info border-info/20',
  professor: 'bg-primary/10 text-primary border-primary/20',
  produtor: 'bg-secondary/10 text-secondary border-secondary/20',
  scouter: 'bg-accent/10 text-accent border-accent/20',
  aluno: 'bg-muted text-muted-foreground border-muted-foreground/20',
};

interface RoleBadgeProps {
  role: AppRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role];
  const Icon = roleIcons[role];

  return (
    <Badge 
      variant="outline" 
      className={`${roleColors[role]} font-medium`}
    >
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}
