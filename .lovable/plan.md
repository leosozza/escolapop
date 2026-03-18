

# Plano: Refatoração Completa do Atendimento Matrícula + Gestão de Acessos

## Resumo

Reestruturar a página "Atendimento Matrícula" com um dashboard dedicado, novo ciclo de vida de leads acadêmicos, automações de tempo (24h/48h), sistema de gestão de acessos pelo gestor (criar login/senha internamente), controle de permissões por área, e novas tabulações pós-matrícula.

---

## Parte 1: Novas Tabulações e Status

### Banco de Dados

**Alterar enum `academic_status`** adicionando novos valores:
- `novo_lead` - Conversa iniciada (WhatsApp)
- `lead_nao_matriculado` - 48h sem resposta/sem matrícula
- `reprovado_faltas` - Veio a pelo menos 1 aula, mas faltou 3x
- `ausente` - Nunca veio ao curso
- `formado` - Concluiu + certificado associado

**Criar tabela `lead_non_enrollment_reasons`** para registrar motivos do "Lead não matriculado":
- `id`, `enrollment_id` (ou `lead_id`), `reason` (enum: sem_resposta, sem_interesse, contrato_cancelado, sem_disponibilidade, distancia, outro), `custom_reason` (text, quando "outro"), `created_by`, `created_at`

**Adicionar coluna à tabela `leads` ou criar tabela auxiliar `lead_response_tracking`:**
- `lead_id`, `first_contact_at` (timestamp da primeira mensagem), `first_response_at` (timestamp da primeira resposta do agente), `response_time_minutes` (calculado)

### Ordem dos cursos no seletor
Fixar a ordem: Passarela, Start, Oficina de Cinema e TV, Passarela Avançada.

---

## Parte 2: Dashboard do Atendimento Matrícula

Refatorar `AcademicSupport.tsx` com:

**KPIs no topo:**
- Novos Leads (aguardando resposta)
- Em atendimento (respondidos, sem agendamento)
- Alerta 24h (tempo de espera > 24h sem resposta)
- Matriculados
- Em Curso
- Lead Não Matriculado (com motivos)
- Reprovado por Faltas
- Ausentes
- Formados

**Filtros avançados:**
- Por tabulação/status
- Por curso
- Por turma
- Por período
- Por motivo de não matrícula

**Lista de contatos** com indicadores visuais de alerta (24h, 48h).

---

## Parte 3: Automação com Edge Function (Cron)

**Criar Edge Function `academic-lead-automations`:**
1. **Alerta 24h**: Marcar leads com `first_contact_at` > 24h e sem `first_response_at` como "em alerta"
2. **48h auto-tabulação**: Leads sem resposta ou sem tabulação de matriculado após 48h da última interação -> status `lead_nao_matriculado`

**Configurar cron job** (pg_cron + pg_net) para executar a cada hora.

**Alerta obrigatório**: Quando o agente abre um lead com status `lead_nao_matriculado`, exigir seleção de motivo antes de prosseguir (dialog modal).

---

## Parte 4: Tabulações Pós-Matrícula

- **Em Curso**: Aluno vinculado a turma ativa dentro do período
- **Reprovado por Faltas**: Veio a pelo menos 1 aula + 3 faltas -> exige rematriculação
- **Ausente**: Nunca veio -> deve ser rematriculado
- **Formado**: Curso concluído, com dados de certificação (emissão sim/não, data de conclusão) visíveis no perfil

---

## Parte 5: Gestão de Acessos (Novo Módulo)

### Novo enum `app_role` - adicionar valores:
- `agente_matricula` - Departamento de matrículas
- `supervisor` - Supervisor de agentes

### Nova página `/user-management` (Gestão de Acessos):
Visível apenas para `admin`/`gestor`. Funcionalidades:
1. **Criar login/senha** de colaboradores internamente (usar `supabase.auth.admin.createUser` via Edge Function)
2. **Resetar senha** de colaboradores
3. **Atribuir permissões** por área (Acadêmico, Comercial, Financeiro, Gestão)
4. **Histórico de modificações** - nova tabela `access_audit_log` (user_id, action, details, performed_by, created_at)

### Mapeamento de áreas por role:
```text
Acadêmico: agente_matricula, professor, recepcao, gestor
Comercial: supervisor, agente_comercial, recepcao, produtor, gestor, scouter
Financeiro: admin, gestor
Gestão: gestor, supervisor
```

### Edge Function `manage-users`:
- Criar usuário (email + senha + nome)
- Resetar senha
- Somente acessível por admin/gestor (validação server-side)

### Permissões de exclusão:
- Excluir aluno/lead: somente `supervisor` e `gestor`
- Excluir turmas vazias: somente `supervisor` e `gestor`

---

## Parte 6: Remover Signup Público

Remover a aba "Cadastrar" da página `/auth`. Apenas login. Contas são criadas internamente pelo gestor.

---

## Parte 7: Sidebar - Adicionar link Gestão de Acessos

Adicionar na seção "Gestão" do sidebar: `{ name: 'Gestão de Acessos', href: '/user-management', icon: Shield }`.

---

## Arquivos Afetados

| Ação | Arquivo |
|---|---|
| Migração DB | Novo SQL: alter enum, nova tabela, cron |
| Edge Function | `supabase/functions/manage-users/index.ts` |
| Edge Function | `supabase/functions/academic-lead-automations/index.ts` |
| Refatorar | `src/pages/AcademicSupport.tsx` |
| Refatorar | `src/components/academic/AcademicConversationPanel.tsx` |
| Criar | `src/pages/UserManagement.tsx` |
| Criar | `src/components/users/CreateUserDialog.tsx` |
| Criar | `src/components/users/ResetPasswordDialog.tsx` |
| Criar | `src/components/academic/NonEnrollmentReasonDialog.tsx` |
| Editar | `src/pages/Auth.tsx` (remover signup) |
| Editar | `src/App.tsx` (nova rota) |
| Editar | `src/components/layout/AppSidebar.tsx` (novo link) |
| Editar | `src/components/layout/AppLayout.tsx` (route name) |
| Editar | `src/types/database.ts` (novos tipos) |
| Editar | `src/pages/Classes.tsx` (permissão exclusão) |
| Editar | `src/pages/Students.tsx` (permissão exclusão) |
| Editar | `supabase/config.toml` (Edge Function JWT config) |

