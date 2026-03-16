import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  Phone,
  GraduationCap,
  User,
  RefreshCcw,
  Check,
  X,
  AlertCircle,
  FileText,
  History,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { openWhatsAppWeb, getWhatsAppWebLink } from '@/lib/whatsapp';
import { format, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { COURSE_WEEKS } from '@/lib/course-schedule-config';

interface AcademicContact {
  id: string;
  lead_id: string;
  full_name: string;
  phone: string;
  status: string;
  course_name: string | null;
  class_name: string | null;
  referral_agent_code: string | null;
  enrollment_type: string | null;
  updated_at: string;
  absences_count: number;
}

interface AcademicConversationPanelProps {
  contact: AcademicContact;
  onStatusChange: (enrollmentId: string, newStatus: string) => void;
  operatorName: string;
}

const ACADEMIC_STATUSES = [
  { value: 'ativo', label: 'Matriculado', description: 'Aguardando início das aulas' },
  { value: 'em_curso', label: 'Em Curso', description: 'Estudando ativamente' },
  { value: 'evasao', label: 'Não Ativo', description: '3+ faltas ou desistência' },
  { value: 'concluido', label: 'Concluído', description: 'Finalizou o curso' },
  { value: 'trancado', label: 'Trancado', description: 'Solicitou trancamento' },
];

const ENROLLMENT_TYPE_LABELS: Record<string, string> = {
  modelo_agenciado_maxfama: 'MaxFama',
  modelo_agenciado_popschool: 'Pop School',
  indicacao_influencia: 'Indicação Influência',
  indicacao_aluno: 'Indicação Aluno',
};

interface AttendanceRecord {
  lesson_number: number;
  status: 'presente' | 'falta' | 'justificado' | null;
  attendance_date: string | null;
}

interface EnrollmentHistoryRecord {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  created_at: string;
  notes: string | null;
}

export function AcademicConversationPanel({
  contact,
  onStatusChange,
  operatorName,
}: AcademicConversationPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotes, setSavedNotes] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [enrollmentHistory, setEnrollmentHistory] = useState<EnrollmentHistoryRecord[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<AttendanceRecord | null>(null);
  const [classId, setClassId] = useState<string | null>(null);

  useEffect(() => {
    loadEnrollmentData();
  }, [contact.id]);

  const loadEnrollmentData = async () => {
    // Load saved notes
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('notes, class_id')
      .eq('id', contact.id)
      .maybeSingle();

    setSavedNotes(enrollment?.notes || '');
    setClassId(enrollment?.class_id || null);

    // Load attendance grid
    if (enrollment?.class_id && contact.lead_id) {
      const { data: classData } = await supabase
        .from('classes')
        .select('start_date')
        .eq('id', enrollment.class_id)
        .maybeSingle();

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('attendance_date, status')
        .eq('student_id', contact.lead_id)
        .eq('class_id', enrollment.class_id)
        .order('attendance_date', { ascending: true });

      const classStartDate = classData?.start_date ? new Date(classData.start_date) : null;
      const records: AttendanceRecord[] = [];

      for (let i = 0; i < COURSE_WEEKS; i++) {
        const expectedDate = classStartDate ? addWeeks(classStartDate, i) : null;
        const existing = attendanceData?.find(
          a => expectedDate && format(new Date(a.attendance_date), 'yyyy-MM-dd') === format(expectedDate, 'yyyy-MM-dd')
        );
        records.push({
          lesson_number: i + 1,
          status: existing?.status as 'presente' | 'falta' | 'justificado' | null,
          attendance_date: expectedDate ? format(expectedDate, 'yyyy-MM-dd') : null,
        });
      }
      setAttendanceRecords(records);
    }

    // Load enrollment history
    const { data: history } = await supabase
      .from('enrollment_history')
      .select('*')
      .eq('enrollment_id', contact.id)
      .order('created_at', { ascending: false })
      .limit(10);

    setEnrollmentHistory(history || []);
  };

  const handleOpenWhatsApp = () => {
    openWhatsAppWeb(
      contact.phone,
      `Olá ${contact.full_name}! Aqui é ${operatorName} do departamento acadêmico. Como posso ajudá-lo(a)?`
    );
  };

  const saveNote = async () => {
    if (!notes.trim()) return;
    setIsSaving(true);

    try {
      const timestamp = new Date().toLocaleString('pt-BR');
      const newNote = `[${timestamp}] ${operatorName}: ${notes}`;
      const updatedNotes = savedNotes ? `${savedNotes}\n\n${newNote}` : newNote;

      const { error } = await supabase
        .from('enrollments')
        .update({ notes: updatedNotes })
        .eq('id', contact.id);

      if (error) throw error;

      toast.success('Observação salva!');
      setSavedNotes(updatedNotes);
      setNotes('');
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Erro ao salvar observação');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkAttendance = async (status: 'presente' | 'falta' | 'justificado') => {
    if (!selectedLesson?.attendance_date || !classId) return;

    try {
      const { error } = await supabase.from('attendance').upsert(
        {
          class_id: classId,
          student_id: contact.lead_id,
          attendance_date: selectedLesson.attendance_date,
          status,
        },
        { onConflict: 'class_id,student_id,attendance_date' }
      );

      if (error) throw error;
      toast.success('Presença marcada!');
      setSelectedLesson(null);
      loadEnrollmentData();
    } catch {
      toast.error('Erro ao marcar presença');
    }
  };

  const getStatusLabel = (status: string) => {
    return ACADEMIC_STATUSES.find(s => s.value === status)?.label || status;
  };

  const presentCount = attendanceRecords.filter(r => r.status === 'presente').length;

  return (
    <>
      <Card className="flex-1 flex flex-col border-0 shadow-md">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-lg font-medium">
                {contact.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <CardTitle className="text-lg">{contact.full_name}</CardTitle>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <a
                    href={getWhatsAppWebLink(contact.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="h-3 w-3" />
                    {contact.phone}
                  </a>
                  {contact.referral_agent_code && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {contact.referral_agent_code}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/students/${contact.lead_id}`)}
              >
                <FileText className="h-4 w-4 mr-1" />
                Ficha Completa
              </Button>
              <Button onClick={handleOpenWhatsApp} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                <MessageCircle className="h-4 w-4" />
                Abrir WhatsApp Web
              </Button>
            </div>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1">
          <CardContent className="p-6 space-y-6">
            {/* Info do Aluno */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Curso</p>
                <p className="font-medium">{contact.course_name || 'Não definido'}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Turma</p>
                <p className="font-medium">{contact.class_name || 'Não definida'}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Tipo Matrícula</p>
                <p className="font-medium">
                  {ENROLLMENT_TYPE_LABELS[contact.enrollment_type || ''] || 'Não informado'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Faltas</p>
                <p className={`font-medium ${contact.absences_count >= 3 ? 'text-orange-500' : ''}`}>
                  {contact.absences_count} {contact.absences_count >= 3 && '(Não Ativo)'}
                </p>
              </div>
            </div>

            {/* Grade de Presença */}
            {attendanceRecords.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">Frequência ({presentCount}/{COURSE_WEEKS})</p>
                  </div>
                  <TooltipProvider>
                    <div className="flex gap-1">
                      {attendanceRecords.map((record, i) => (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <button
                              className={`h-10 flex-1 rounded-sm transition-all flex items-center justify-center text-xs font-medium cursor-pointer
                                ${record.status === 'presente'
                                  ? 'bg-success text-success-foreground'
                                  : record.status === 'falta'
                                    ? 'bg-destructive text-destructive-foreground'
                                    : record.status === 'justificado'
                                      ? 'bg-warning text-warning-foreground'
                                      : 'bg-muted hover:bg-muted/80'
                                }`}
                              onClick={() => record.attendance_date && setSelectedLesson(record)}
                              disabled={!record.attendance_date}
                            >
                              {record.lesson_number}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Aula {record.lesson_number}</p>
                            {record.attendance_date && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(record.attendance_date), 'dd/MM/yyyy')}
                              </p>
                            )}
                            <p className="text-xs">
                              {record.status === 'presente' ? '✓ Presente'
                                : record.status === 'falta' ? '✗ Falta'
                                  : record.status === 'justificado' ? '! Justificado'
                                    : 'Clique para marcar'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </TooltipProvider>

                  {selectedLesson && (
                    <div className="p-3 rounded-lg bg-muted/50 border space-y-2 mt-2">
                      <p className="text-sm font-medium">
                        Marcar presença - Aula {selectedLesson.lesson_number}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 hover:bg-success/10 hover:border-success hover:text-success"
                          onClick={() => handleMarkAttendance('presente')}>
                          <Check className="h-4 w-4 mr-1" /> Presente
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                          onClick={() => handleMarkAttendance('falta')}>
                          <X className="h-4 w-4 mr-1" /> Falta
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 hover:bg-warning/10 hover:border-warning hover:text-warning"
                          onClick={() => handleMarkAttendance('justificado')}>
                          <AlertCircle className="h-4 w-4 mr-1" /> Justificado
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Operador Atual */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm">
                Atendimento por: <strong>{operatorName}</strong>
              </span>
            </div>

            {/* Tabulação */}
            <div>
              <p className="text-sm font-medium mb-3">Tabulação Acadêmica</p>
              <Select
                value={contact.status}
                onValueChange={(value) => onStatusChange(contact.id, value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {ACADEMIC_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex flex-col">
                        <span>{status.label}</span>
                        <span className="text-xs text-muted-foreground">{status.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Observações */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Adicionar Observação</p>
              <Textarea
                placeholder="Digite uma observação sobre o atendimento..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
              <Button
                onClick={saveNote}
                disabled={!notes.trim() || isSaving}
                className="w-full"
              >
                {isSaving ? 'Salvando...' : 'Salvar Observação'}
              </Button>
            </div>

            {/* Observações Anteriores */}
            {savedNotes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Observações Anteriores
                  </p>
                  <div className="p-3 rounded-lg bg-muted/30 max-h-40 overflow-y-auto">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">
                      {savedNotes}
                    </pre>
                  </div>
                </div>
              </>
            )}

            {/* Histórico de Tabulação */}
            {enrollmentHistory.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Histórico de Tabulação
                  </p>
                  <div className="space-y-2">
                    {enrollmentHistory.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/30">
                        <Badge variant="outline" className="text-[10px]">
                          {getStatusLabel(h.from_status || '')}
                        </Badge>
                        <span>→</span>
                        <Badge variant="outline" className="text-[10px]">
                          {getStatusLabel(h.to_status)}
                        </Badge>
                        <span className="text-muted-foreground ml-auto">
                          {format(new Date(h.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Ações de Conclusão */}
            {contact.status === 'concluido' && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-3">Pós-Conclusão</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-auto py-4 flex-col gap-1 border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white"
                      onClick={() => onStatusChange(contact.id, 'ativo')}
                    >
                      <RefreshCcw className="h-5 w-5" />
                      <span className="text-sm font-medium">Rematricular</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto py-4 flex-col gap-1 border-muted-foreground text-muted-foreground hover:bg-muted-foreground hover:text-white"
                      onClick={() => onStatusChange(contact.id, 'trancado')}
                    >
                      <GraduationCap className="h-5 w-5" />
                      <span className="text-sm font-medium">Não Retorna</span>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </ScrollArea>
      </Card>

    </>
  );
}
