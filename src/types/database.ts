// Custom types for the application
export type AppRole = 
  | 'admin'
  | 'gestor'
  | 'agente_comercial'
  | 'recepcao'
  | 'professor'
  | 'produtor'
  | 'scouter'
  | 'aluno';

export type LeadStatus = 
  | 'lead'
  | 'em_atendimento'
  | 'agendado'
  | 'confirmado'
  | 'compareceu'
  | 'proposta'
  | 'matriculado'
  | 'perdido';

export type CourseModality = 
  | 'presencial'
  | 'online'
  | 'hibrido';

export type LeadSource = 
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'google'
  | 'indicacao'
  | 'site'
  | 'presencial'
  | 'outro';

export type AcademicStatus = 
  | 'ativo'
  | 'em_curso'
  | 'inadimplente'
  | 'evasao'
  | 'concluido'
  | 'trancado';

export type ContentType = 
  | 'video'
  | 'text'
  | 'file'
  | 'quiz';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Course {
  id: string;
  name: string;
  description: string | null;
  modality: CourseModality;
  duration_hours: number | null;
  price: number | null;
  is_active: boolean;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  source: LeadSource;
  campaign: string | null;
  ad_set: string | null;
  ad_name: string | null;
  status: LeadStatus;
  course_interest_id: string | null;
  assigned_agent_id: string | null;
  notes: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  course?: Course;
  agent?: Profile;
}

export interface LeadHistory {
  id: string;
  lead_id: string;
  from_status: LeadStatus | null;
  to_status: LeadStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  lead_id: string;
  agent_id: string;
  scheduled_date: string;
  scheduled_time: string;
  confirmed: boolean;
  attended: boolean | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  lead?: Lead;
  agent?: Profile;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  height_cm: number | null;
  weight_kg: number | null;
  bust_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  shoe_size: number | null;
  eye_color: string | null;
  hair_color: string | null;
  skin_tone: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  youtube_channel: string | null;
  followers_count: number | null;
  bio: string | null;
  portfolio_url: string | null;
  available_for_casting: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  profile?: Profile;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  lead_id: string | null;
  status: AcademicStatus;
  enrolled_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  progress_percentage: number;
  grade: number | null;
  certificate_issued: boolean;
  certificate_issued_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  course?: Course;
  student?: Profile;
  lead?: Lead;
}

export interface EnrollmentHistory {
  id: string;
  enrollment_id: string;
  from_status: AcademicStatus | null;
  to_status: AcademicStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

// LMS Types
export interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  course?: Course;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  order_index: number;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  module?: Module;
  contents?: LessonContent[];
}

export interface LessonContent {
  id: string;
  lesson_id: string;
  content_type: ContentType;
  title: string;
  content_url: string | null;
  content_text: string | null;
  order_index: number;
  duration_seconds: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  lesson?: Lesson;
}

export interface LessonProgress {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  started_at: string | null;
  completed_at: string | null;
  progress_percentage: number;
  last_position_seconds: number;
  created_at: string;
  updated_at: string;
  // Joined data
  enrollment?: Enrollment;
  lesson?: Lesson;
}

export interface ContentProgress {
  id: string;
  enrollment_id: string;
  content_id: string;
  started_at: string | null;
  completed_at: string | null;
  watched_seconds: number;
  total_seconds: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  enrollment?: Enrollment;
  content?: LessonContent;
}

// Status labels and colors
export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bgColor: string }> = {
  lead: { label: 'Novo Lead', color: 'text-info', bgColor: 'bg-info/10' },
  em_atendimento: { label: 'Em Atendimento', color: 'text-warning', bgColor: 'bg-warning/10' },
  agendado: { label: 'Agendado', color: 'text-primary', bgColor: 'bg-primary/10' },
  confirmado: { label: 'Confirmado', color: 'text-accent', bgColor: 'bg-accent/10' },
  compareceu: { label: 'Compareceu', color: 'text-success', bgColor: 'bg-success/10' },
  proposta: { label: 'Proposta', color: 'text-secondary', bgColor: 'bg-secondary/10' },
  matriculado: { label: 'Matriculado', color: 'text-success', bgColor: 'bg-success/20' },
  perdido: { label: 'Perdido', color: 'text-destructive', bgColor: 'bg-destructive/10' },
};

export const LEAD_SOURCE_CONFIG: Record<LeadSource, { label: string; icon: string }> = {
  whatsapp: { label: 'WhatsApp', icon: 'MessageCircle' },
  instagram: { label: 'Instagram', icon: 'Instagram' },
  facebook: { label: 'Facebook', icon: 'Facebook' },
  google: { label: 'Google', icon: 'Search' },
  indicacao: { label: 'Indicação', icon: 'Users' },
  site: { label: 'Site', icon: 'Globe' },
  presencial: { label: 'Presencial', icon: 'MapPin' },
  outro: { label: 'Outro', icon: 'MoreHorizontal' },
};

export const COURSE_MODALITY_CONFIG: Record<CourseModality, { label: string; icon: string }> = {
  presencial: { label: 'Presencial', icon: 'Building' },
  online: { label: 'Online', icon: 'Monitor' },
  hibrido: { label: 'Híbrido', icon: 'Shuffle' },
};

export const ROLE_CONFIG: Record<AppRole, { label: string; description: string; icon: string }> = {
  admin: { label: 'Administrador', description: 'Acesso total ao sistema', icon: 'Shield' },
  gestor: { label: 'Gestor', description: 'Gerencia equipes e relatórios', icon: 'BarChart3' },
  agente_comercial: { label: 'Agente Comercial', description: 'Atende leads e fecha vendas', icon: 'Handshake' },
  recepcao: { label: 'Recepção', description: 'Check-in e atendimento presencial', icon: 'DoorOpen' },
  professor: { label: 'Professor', description: 'Ministra aulas e avalia alunos', icon: 'GraduationCap' },
  produtor: { label: 'Produtor', description: 'Gerencia casting e campanhas', icon: 'Camera' },
  scouter: { label: 'Scouter', description: 'Busca e avalia novos talentos', icon: 'Eye' },
  aluno: { label: 'Aluno', description: 'Acesso às aulas e materiais', icon: 'BookOpen' },
};

export const ACADEMIC_STATUS_CONFIG: Record<AcademicStatus, { label: string; color: string; bgColor: string }> = {
  ativo: { label: 'Ativo', color: 'text-success', bgColor: 'bg-success/10' },
  em_curso: { label: 'Em Curso', color: 'text-primary', bgColor: 'bg-primary/10' },
  inadimplente: { label: 'Inadimplente', color: 'text-warning', bgColor: 'bg-warning/10' },
  evasao: { label: 'Evasão', color: 'text-destructive', bgColor: 'bg-destructive/10' },
  concluido: { label: 'Concluído', color: 'text-info', bgColor: 'bg-info/10' },
  trancado: { label: 'Trancado', color: 'text-muted-foreground', bgColor: 'bg-muted/50' },
};

export const CONTENT_TYPE_CONFIG: Record<ContentType, { label: string; icon: string }> = {
  video: { label: 'Vídeo', icon: 'Video' },
  text: { label: 'Texto', icon: 'FileText' },
  file: { label: 'Arquivo', icon: 'File' },
  quiz: { label: 'Quiz', icon: 'HelpCircle' },
};
