
# Arquitetura: Comercial vs Acadêmico

## Regras de Separação de Dados

### Entidade Central: `leads` (tabela única)
Todos os clientes (comerciais e acadêmicos) são armazenados na tabela `leads`. A distinção entre comercial e acadêmico é feita pelo **status** do lead.

### Carteira Comercial (CRM, Dashboard, Appointments, Reception)
- **Filtro**: `status != 'matriculado'`
- **Status comerciais**: agendado, confirmado, aguardando_confirmacao, atrasado, compareceu, fechado, nao_fechado, reagendar, declinou, limbo
- **Fluxo**: Lead → Agendamento → Check-in → Venda (fechado) ou Não Venda (nao_fechado)

### Módulo Acadêmico (Students, Classes, Enrollments)
- **Tabela**: `enrollments` com referência ao `lead_id`
- **Status acadêmicos**: ativo, em_curso, inadimplente, evasao, concluido, trancado
- **Entrada**: 
  1. Lead comercial que fechou → cria enrollment + atualiza lead.status = 'matriculado'
  2. Indicação direta → cria lead com status 'matriculado' + cria enrollment

### Integrações
- **Comercial → Acadêmico**: Quando lead fecha venda, pode ser matriculado no módulo acadêmico
- **Acadêmico → Comercial**: NÃO aparece (leads com status 'matriculado' são excluídos da carteira)
- **Acadêmico independente**: Pode criar alunos diretamente via indicação/referral (sem passar pelo comercial)

---

# Plano: Integracao Completa do Fluxo Comercial

## Resumo do Problema

Apos as alteracoes no CRM (QuickLeadForm, service_days, novos status), as demais paginas comerciais nao foram atualizadas para utilizar a mesma logica. Isso causa:

1. **Inconsistencia de dados** - Cada pagina usa fluxos diferentes de agendamento
2. **Status desatualizados** - Reception e Appointments nao reconhecem os novos status
3. **Falta de integracao com service_days** - Appointments e AgentPortfolio usam calendario livre ao inves dos dias de atendimento criados
4. **Tabulacoes desconectadas** - Reception atualiza status sem seguir o workflow correto

---

## Paginas a Corrigir

| Pagina | Problemas | Correcoes |
|--------|-----------|-----------|
| **Appointments** | Usa calendario livre, nao usa service_days | Integrar service_days e horarios fixos |
| **Reception** | Atualiza para 'compareceu' mas nao segue fluxo correto | Adicionar tabulacoes corretas (compareceu/fechado/nao_fechado) |
| **AgentPortfolio** | Usa calendario livre, agendamento manual | Integrar service_days e capacidade |
| **Dashboard** | Status bar correta, mas SummaryPanel usa totais gerais | Refinar contagens por status |
| **ProducerQueue** | Usa 'compareceu' correto, mas 'matriculado'/'perdido' nao sao os status finais | Atualizar para 'fechado'/'nao_fechado' |
| **ScheduleLeadDialog** | Usa calendario livre | Integrar service_days |
| **AddAppointmentDialog** | Usa calendario livre | Integrar service_days |

---

## Arquitetura de Dados Esperada

### Fluxo de Status Correto

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                         CARTEIRA COMERCIAL                                  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  AGENTES DE RELACIONAMENTO (CRM / AgentPortfolio)                   │  │
│  │                                                                      │  │
│  │  agendado ──► confirmado ──► aguardando_confirmacao                 │  │
│  │      │                              │                               │  │
│  │      └──────────────────────────────┴───► declinou                  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                       │
│                        (Cliente chega no horario)                          │
│                                    ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  RECEPCAO (Reception)                                                │  │
│  │                                                                      │  │
│  │  compareceu ──► fechado (vendeu) / nao_fechado (nao vendeu)         │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  AUTOMATICO (Sistema)                                                │  │
│  │                                                                      │  │
│  │  atrasado (1h apos horario marcado)                                 │  │
│  │  reagendar (18h se nao compareceu)                                  │  │
│  │  limbo (3 dias sem reagendamento)                                   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Correcoes Detalhadas

### 1. Appointments.tsx

**Problema**: Usa calendario livre para selecionar datas. Nao utiliza os `service_days` criados.

**Correcao**:
- Integrar hook `useServiceDays` para listar apenas dias disponiveis
- Atualizar `ScheduleByHour` para usar horarios comerciais (9-16h)
- Atualizar dialogs de agendamento para usar select de service_days

```typescript
// Adicionar imports
import { useServiceDays } from '@/hooks/useServiceDays';
import { COMMERCIAL_HOURS } from '@/lib/commercial-schedule-config';

// No componente
const { serviceDays } = useServiceDays();

// Filtrar apenas datas com service_days
const availableDates = serviceDays.map(d => new Date(d.service_date + 'T12:00:00'));
```

### 2. ScheduleLeadDialog.tsx

**Problema**: Usa calendario livre e nao considera capacidade por horario.

**Correcao**:
- Substituir campo de data por select com service_days
- Substituir campo de hora por select com horarios fixos (9-16h)
- Adicionar indicador de capacidade por horario

```typescript
// Substituir Popover/Calendar por:
<Select value={selectedDayId} onValueChange={setSelectedDayId}>
  <SelectContent>
    {serviceDays.map(day => (
      <SelectItem key={day.id} value={day.id}>
        {day.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

// Substituir Input type="time" por:
<Select value={selectedTime} onValueChange={setSelectedTime}>
  <SelectContent>
    {hourCounts.map(h => (
      <SelectItem key={h.hour} value={h.hour}>
        {h.hour} ({h.count}/{maxPerHour})
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 3. AddAppointmentDialog.tsx

**Problema**: Mesmos problemas do ScheduleLeadDialog.

**Correcao**:
- Mesma abordagem: integrar service_days e horarios fixos
- Mostrar contagem de capacidade

### 4. Reception.tsx

**Problema**: Atualiza status para 'compareceu' ou 'perdido', mas o fluxo correto exige diferenciar entre:
- `compareceu` = check-in confirmado, aguardando atendimento
- `fechado` = vendeu (matriculou)
- `nao_fechado` = nao vendeu

**Correcao**:
- Check-in marca apenas `compareceu` (ja esta correto)
- Remover atualizacao para 'perdido' no check-in (era incorreto)
- A tabulacao final (fechado/nao_fechado) deve ocorrer no **ProducerQueue**

```typescript
// handleCheckIn - Corrigir:
const handleCheckIn = async (appointment, attended: boolean) => {
  if (attended) {
    // Check-in OK - status 'compareceu'
    await supabase.from('leads')
      .update({ status: 'compareceu', attended_at: new Date().toISOString() })
      .eq('id', appointment.lead.id);
  } else {
    // Nao compareceu no horario - marcar como 'atrasado' (automatico) ou 'reagendar'
    // A logica automatica cuidara disso as 18h
  }
};
```

### 5. ProducerQueue.tsx

**Problema**: Usa 'matriculado' e 'perdido' como status finais, mas o fluxo comercial define:
- `fechado` = vendeu
- `nao_fechado` = nao vendeu
- `matriculado` = convertido para academico (apos fechado)

**Correcao**:
- Trocar 'matriculado' por 'fechado'
- Trocar 'perdido' por 'nao_fechado'
- A conversao para 'matriculado' ocorre quando o aluno e criado no modulo Academico

```typescript
// Substituir:
const newStatus = closeResult === 'matriculado' ? 'fechado' : 'nao_fechado';
```

### 6. AgentPortfolio.tsx

**Problema**: Usa calendario livre para agendamento.

**Correcao**:
- Integrar `useServiceDays` e `useAppointmentCounts`
- Substituir calendario por select de dias disponiveis
- Adicionar indicador de capacidade

### 7. Dashboard.tsx (SummaryPanel)

**Problema**: Contagens estao corretas mas podem incluir leads de outros dias.

**Correcao**:
- Garantir que `agendados` e `confirmados` filtram apenas pelo dia selecionado
- `atrasados`, `reagendar`, `declinou` mostram totais gerais

---

## Componentes Afetados

| Arquivo | Tipo de Alteracao |
|---------|-------------------|
| `src/pages/Appointments.tsx` | Integrar service_days, filtrar por dias disponiveis |
| `src/pages/Reception.tsx` | Corrigir fluxo de tabulacao de check-in |
| `src/pages/AgentPortfolio.tsx` | Integrar service_days no agendamento |
| `src/pages/ProducerQueue.tsx` | Trocar 'matriculado'/'perdido' por 'fechado'/'nao_fechado' |
| `src/components/appointments/ScheduleLeadDialog.tsx` | Integrar service_days e capacidade |
| `src/components/appointments/AddAppointmentDialog.tsx` | Integrar service_days e capacidade |
| `src/components/dashboard/ScheduleByHour.tsx` | Atualizar para usar COMMERCIAL_HOURS |

---

## Novo Componente Compartilhado

Criar um componente reutilizavel para selecao de dia/hora com capacidade:

```text
src/components/scheduling/ServiceDayTimeSelect.tsx
```

```typescript
interface ServiceDayTimeSelectProps {
  selectedDayId: string;
  selectedTime: string;
  onDayChange: (dayId: string) => void;
  onTimeChange: (time: string) => void;
  disabled?: boolean;
}

export function ServiceDayTimeSelect({
  selectedDayId,
  selectedTime,
  onDayChange,
  onTimeChange,
  disabled
}: ServiceDayTimeSelectProps) {
  const { serviceDays } = useServiceDays();
  const selectedDay = serviceDays.find(d => d.id === selectedDayId);
  const { hourCounts } = useAppointmentCounts(
    selectedDay?.service_date || null,
    selectedDay?.max_per_hour
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      <Select value={selectedDayId} onValueChange={onDayChange}>
        {/* ... */}
      </Select>
      <Select value={selectedTime} onValueChange={onTimeChange}>
        {/* ... */}
      </Select>
    </div>
  );
}
```

---

## Fluxo de Dados Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DE DADOS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. CRIACAO DE LEAD (CRM QuickLeadForm / ScheduleLeadDialog)               │
│     ├── Cria registro em 'leads' com status 'agendado'                     │
│     ├── Cria registro em 'appointments' vinculado                          │
│     └── Utiliza 'service_days' para data e horarios fixos                  │
│                                                                             │
│  2. CONFIRMACAO (Dashboard / AgentPortfolio)                               │
│     ├── Agente atualiza status: agendado ► confirmado                      │
│     └── Registra em 'lead_history' com responsavel                         │
│                                                                             │
│  3. CHECK-IN (Reception)                                                   │
│     ├── Recepcao marca 'compareceu' no 'appointments.attended = true'      │
│     ├── Atualiza 'leads.status' para 'compareceu'                          │
│     └── Lead entra na fila do ProducerQueue                                │
│                                                                             │
│  4. ATENDIMENTO (ProducerQueue)                                            │
│     ├── Produtor atende e tabula: 'fechado' ou 'nao_fechado'               │
│     └── Registra em 'lead_history' com detalhes                            │
│                                                                             │
│  5. AUTOMATICO (Sistema - a implementar depois)                            │
│     ├── 1h apos horario: marca 'atrasado'                                  │
│     ├── 18h: marca 'reagendar' se nao compareceu                           │
│     └── 3 dias: marca 'limbo'                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Validacoes de Integridade

Adicionar verificacoes para garantir consistencia:

1. **Lead so pode ser 'agendado' se tiver appointment ativo**
2. **Lead so pode ser 'compareceu' se appointment.attended = true**
3. **Lead 'fechado'/'nao_fechado' deve ter passado por 'compareceu'**
4. **Apenas dias em 'service_days' podem receber agendamentos**

---

## Ordem de Implementacao

1. Criar componente compartilhado `ServiceDayTimeSelect`
2. Atualizar `ScheduleLeadDialog` com novo componente
3. Atualizar `AddAppointmentDialog` com novo componente
4. Atualizar `AgentPortfolio` com novo componente
5. Corrigir `Reception` - remover atualizacao incorreta de status
6. Corrigir `ProducerQueue` - trocar status finais
7. Atualizar `Appointments` para filtrar por service_days
8. Atualizar `ScheduleByHour` para usar COMMERCIAL_HOURS

---

## Resumo Tecnico

- **8 arquivos** a modificar
- **1 componente novo** compartilhado
- **0 alteracoes de banco** (schema ja esta correto)
- Foco em **reutilizacao** do hook `useServiceDays` e `useAppointmentCounts`
- **Padronizacao** de status entre todas as paginas comerciais
