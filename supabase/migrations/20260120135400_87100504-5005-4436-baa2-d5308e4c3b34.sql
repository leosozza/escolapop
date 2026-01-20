-- Adicionar campo assigned_producer_id na tabela leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_producer_id uuid REFERENCES profiles(user_id);

-- Adicionar coluna checked_in_at para registrar horário exato do check-in
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_leads_assigned_producer ON leads(assigned_producer_id);

-- Tabela de logs de ligações do Call Center
CREATE TABLE IF NOT EXISTS call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES profiles(user_id),
  call_type text NOT NULL CHECK (call_type IN ('outbound', 'inbound')),
  result text NOT NULL CHECK (result IN ('agendado', 'retornar', 'caixa_postal', 'nao_atendeu', 'sem_interesse', 'numero_invalido')),
  duration_seconds integer,
  notes text,
  scheduled_callback_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de Turmas
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  teacher_id uuid REFERENCES profiles(user_id),
  room text,
  start_date date NOT NULL,
  end_date date,
  schedule jsonb, -- {"monday": "19:00-21:00", "wednesday": "19:00-21:00"}
  max_students integer DEFAULT 30,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de Matrículas em Turmas
CREATE TABLE IF NOT EXISTS class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, enrollment_id)
);

-- Tabela de Lista de Presença
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(user_id),
  attendance_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('presente', 'falta', 'justificado')),
  notes text,
  marked_by uuid REFERENCES profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id, attendance_date)
);

-- Tabela de Contratos
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  total_value numeric NOT NULL,
  installments integer NOT NULL DEFAULT 1,
  payment_day integer NOT NULL DEFAULT 10,
  discount numeric DEFAULT 0,
  status text NOT NULL CHECK (status IN ('rascunho', 'assinado', 'cancelado')) DEFAULT 'rascunho',
  signed_at timestamptz,
  signed_document_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de Pagamentos
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  amount numeric NOT NULL,
  paid_at timestamptz,
  paid_amount numeric,
  payment_method text,
  status text NOT NULL CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')) DEFAULT 'pendente',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_logs
CREATE POLICY "Staff can manage call logs" ON call_logs FOR ALL USING (is_staff(auth.uid()));
CREATE POLICY "Staff can view call logs" ON call_logs FOR SELECT USING (is_staff(auth.uid()));

-- RLS Policies for classes
CREATE POLICY "Staff can manage classes" ON classes FOR ALL USING (is_staff(auth.uid()));
CREATE POLICY "Anyone can view active classes" ON classes FOR SELECT USING ((is_active = true) OR is_staff(auth.uid()));

-- RLS Policies for class_enrollments
CREATE POLICY "Staff can manage class enrollments" ON class_enrollments FOR ALL USING (is_staff(auth.uid()));
CREATE POLICY "Students can view own class enrollments" ON class_enrollments FOR SELECT 
  USING ((EXISTS (SELECT 1 FROM enrollments e WHERE e.id = class_enrollments.enrollment_id AND e.student_id = auth.uid())) OR is_staff(auth.uid()));

-- RLS Policies for attendance
CREATE POLICY "Staff can manage attendance" ON attendance FOR ALL USING (is_staff(auth.uid()));
CREATE POLICY "Students can view own attendance" ON attendance FOR SELECT USING ((auth.uid() = student_id) OR is_staff(auth.uid()));

-- RLS Policies for contracts
CREATE POLICY "Staff can manage contracts" ON contracts FOR ALL USING (is_staff(auth.uid()));
CREATE POLICY "Students can view own contracts" ON contracts FOR SELECT 
  USING ((EXISTS (SELECT 1 FROM enrollments e WHERE e.id = contracts.enrollment_id AND e.student_id = auth.uid())) OR is_staff(auth.uid()));

-- RLS Policies for payments
CREATE POLICY "Staff can manage payments" ON payments FOR ALL USING (is_staff(auth.uid()));
CREATE POLICY "Students can view own payments" ON payments FOR SELECT 
  USING ((EXISTS (SELECT 1 FROM contracts c JOIN enrollments e ON e.id = c.enrollment_id WHERE c.id = payments.contract_id AND e.student_id = auth.uid())) OR is_staff(auth.uid()));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_agent_id ON call_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_classes_course_id ON classes(course_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_enrollment_id ON class_enrollments(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class_id ON attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_contracts_enrollment_id ON contracts(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_payments_contract_id ON payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);