

# Plano: Dias de Atendimento e Formulario Rapido de Agendamento

## Resumo

Vou reestruturar a Carteira Comercial (CRM) para incluir:
1. **Tabela de Dias de Atendimento** - Cadastro de dias disponiveis para agendamento
2. **Formulario Rapido Inline** - Substituir o botao de dialogo por campos diretos na pagina
3. **Controle de Capacidade por Horario** - Limite de 15 por horario com aviso visual
4. **Horarios Fixos** - Das 9h as 16h, de 1 em 1 hora

---

## Arquitetura de Dados

### Nova Tabela: `service_days` (Dias de Atendimento)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | Identificador unico |
| service_date | DATE | Data do atendimento |
| weekday_name | TEXT | Nome do dia da semana (ex: "Sabado") |
| is_active | BOOLEAN | Se esta ativo para agendamentos |
| max_per_hour | INTEGER | Limite por horario (padrao: 15) |
| created_at | TIMESTAMPTZ | Data de criacao |
| created_by | UUID | Quem criou |

### Relacionamento com Appointments

A tabela `appointments` ja possui os campos necessarios:
- `scheduled_date`: Vinculado aos `service_days`
- `scheduled_time`: Horario do agendamento

---

## Fluxo de Interface

### Layout da Pagina CRM (Nova Estrutura)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ CARTEIRA COMERCIAL                                    [Tela Cheia] [Kanban] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  NOVO AGENDAMENTO (Formulario Rapido Inline)                        │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Nome do Responsavel    Nome do Modelo       Telefone               │   │
│  │  [________________]     [________________]   [________________]      │   │
│  │                                                                      │   │
│  │  Dia de Atendimento              Horario                            │   │
│  │  [10/01 - Sabado ▼]             [09:00 ▼]  [15/15 Lotado!]          │   │
│  │                                                                      │   │
│  │  [+ Criar Dia de Atendimento]                    [Agendar Lead]     │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ Tabs de Status ───────────────────────────────────────────────────────┐│
│  │ [Agendado(12)] [Confirmado(5)] [Aguard(3)] [Atrasado(2)] ... [Todos]  ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌─ Lista/Kanban de Leads ─────────────────────────────────────────────────┐│
│  │  ...                                                                    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Dialog para Criar Dia de Atendimento

```text
┌─────────────────────────────────────────────┐
│  Criar Dia de Atendimento                   │
├─────────────────────────────────────────────┤
│                                             │
│  Data *                                     │
│  [Calendario de selecao]                    │
│                                             │
│  Limite por horario                         │
│  [15]  (padrao)                             │
│                                             │
│  Preview: "10/01 - Sabado"                  │
│                                             │
│              [Cancelar]  [Criar]            │
└─────────────────────────────────────────────┘
```

---

## Componentes a Criar/Modificar

### 1. Nova Migracao SQL

```sql
-- Tabela de dias de atendimento comercial
CREATE TABLE IF NOT EXISTS public.service_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_date DATE NOT NULL UNIQUE,
  weekday_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  max_per_hour INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE public.service_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read service_days"
  ON public.service_days FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert service_days"
  ON public.service_days FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update service_days"
  ON public.service_days FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()));
```

### 2. Novo Componente: QuickLeadForm

Localizado em: `src/components/crm/QuickLeadForm.tsx`

Campos:
- Nome do Responsavel (guardian_name) *
- Nome do Modelo (full_name) *
- Telefone (phone) *
- Dia de Atendimento (Select com dias criados) *
- Horario (Select de 09:00 a 16:00) *

Comportamentos:
- Mostra contagem de agendados por horario
- Aviso visual quando horario >= 15
- Botao "Agendar Lead" que cria lead + appointment em uma transacao

### 3. Novo Componente: AddServiceDayDialog

Localizado em: `src/components/crm/AddServiceDayDialog.tsx`

Funcionalidades:
- Calendario para selecionar data
- Auto-preenche nome do dia da semana
- Campo para limite por horario (default 15)
- Impede criar dias duplicados

### 4. Atualizacao: CRM.tsx

Mudancas:
- Remover botao "Novo Lead" que abre dialog
- Adicionar QuickLeadForm no topo da pagina
- Manter tabs de status
- Manter toggle lista/kanban

### 5. Hook: useServiceDays

```typescript
// src/hooks/useServiceDays.ts
export function useServiceDays() {
  // Buscar dias de atendimento ativos
  // Buscar contagem de appointments por dia/hora
  // Retornar dados formatados para o select
}
```

### 6. Hook: useAppointmentCounts

```typescript
// src/hooks/useAppointmentCounts.ts
export function useAppointmentCounts(serviceDate: string) {
  // Buscar total de agendamentos por horario
  // Para cada hora de 09:00 a 16:00
  // Retornar: { "09:00": 5, "10:00": 15, ... }
}
```

---

## Logica de Negocio

### Horarios Disponiveis

```typescript
export const COMMERCIAL_HOURS = [
  '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00'
] as const;
```

### Formato do Dia de Atendimento

```typescript
// Exemplo de exibicao no Select
"10/01 - Sabado"
"11/01 - Domingo"
"15/01 - Quinta-feira"
```

### Contagem por Horario

```typescript
// Query para contar por horario
const { data } = await supabase
  .from('appointments')
  .select('scheduled_time')
  .eq('scheduled_date', selectedDate);

// Agrupar por horario
const counts = data.reduce((acc, apt) => {
  const hour = apt.scheduled_time.slice(0, 5); // "09:00"
  acc[hour] = (acc[hour] || 0) + 1;
  return acc;
}, {});
```

### Aviso de Lotacao

```typescript
// No select de horarios
const isFull = counts[hour] >= maxPerHour;
const isWarning = counts[hour] >= maxPerHour * 0.8; // 80%

// Visual
<SelectItem className={isFull ? "text-red-500" : isWarning ? "text-amber-500" : ""}>
  {hour} ({counts[hour]}/{maxPerHour})
</SelectItem>
```

---

## Fluxo de Criacao Rapida

1. Usuario preenche formulario rapido
2. Clica em "Agendar Lead"
3. Sistema cria lead com status `agendado`:
   ```typescript
   const lead = await supabase.from('leads').insert({
     guardian_name,
     full_name,
     phone,
     status: 'agendado',
     scheduled_at: `${service_date}T${scheduled_time}`,
     source: 'presencial'
   });
   ```
4. Sistema cria appointment vinculado:
   ```typescript
   await supabase.from('appointments').insert({
     lead_id: lead.id,
     agent_id: currentProfile.id,
     scheduled_date: service_date,
     scheduled_time,
     confirmed: false
   });
   ```
5. Lead aparece na aba "Agendado" imediatamente

---

## Estrutura de Arquivos

```text
src/
  components/
    crm/
      QuickLeadForm.tsx           (NOVO)
      AddServiceDayDialog.tsx     (NOVO)
      CRM.tsx                     (ATUALIZAR)
  hooks/
    useServiceDays.ts             (NOVO)
    useAppointmentCounts.ts       (NOVO)
  lib/
    commercial-schedule-config.ts (NOVO)

supabase/
  migrations/
    [timestamp]_service_days.sql  (NOVO)
```

---

## Detalhes de Implementacao

### QuickLeadForm Component

```typescript
interface QuickLeadFormProps {
  onSuccess: () => void;
}

export function QuickLeadForm({ onSuccess }: QuickLeadFormProps) {
  const [guardianName, setGuardianName] = useState('');
  const [modelName, setModelName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  
  const { serviceDays, isLoading: loadingDays } = useServiceDays();
  const { counts, maxPerHour } = useAppointmentCounts(selectedDate);
  
  // ...
}
```

### Validacoes

- Nome do responsavel: minimo 2 caracteres
- Nome do modelo: minimo 2 caracteres
- Telefone: minimo 10 digitos
- Dia de atendimento: obrigatorio
- Horario: obrigatorio

### Mensagens de Aviso

- Horario cheio (>= 15): "Este horario esta lotado! Confirme antes de continuar."
- Horario quase cheio (>= 12): "Horario quase lotado (X/15)"

---

## Consideracoes de UX

1. **Formulario Sempre Visivel**: O formulario rapido fica no topo, sempre disponivel
2. **Feedback Visual de Lotacao**: Cores indicam ocupacao do horario
3. **Dias Ordenados**: Mostrar dias futuros primeiro
4. **Limpeza Automatica**: Formulario limpa apos sucesso
5. **Foco Automatico**: Primeiro campo recebe foco ao carregar

---

## Proximos Passos Apos Implementacao

1. Testar fluxo completo de agendamento rapido
2. Verificar se lead aparece corretamente nas tabs
3. Testar criacao de novo dia de atendimento
4. Validar contagem de capacidade por horario

