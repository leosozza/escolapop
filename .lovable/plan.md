

# Plano: Perfil do Aluno Completo + Integração de Dados

## Problemas Identificados

1. **Perfil do aluno incompleto**: Faltam campos de Idade e Código MaxFama no card principal do perfil.
2. **Join incorreto (ainda presente)**: `StudentProfile.tsx` linhas 142 e 216 ainda usam `profiles!classes_teacher_id_fkey` em vez de `team_members!classes_teacher_id_fkey`.
3. **Botão de gerar certificado ausente**: Não existe botão direto no perfil para gerar certificado de cursos concluídos.
4. **Dados da matrícula não refletem no perfil**: Quando o `AddEnrollmentDialog` cria o aluno, salva `student_age` e `referral_agent_code` no enrollment mas não no lead, então o perfil não exibe idade nem código.

## O que será feito

### 1. Completar o card de informações do perfil
Adicionar ao card principal em `StudentProfile.tsx`:
- **Idade**: Campo editável que puxa do enrollment mais recente (ou permite edição manual)
- **Código MaxFama**: Exibir o `referral_agent_code` do enrollment ativo (somente leitura, vem da matrícula)
- **Observações gerais**: Já existe

### 2. Corrigir joins com teacher
Em `StudentProfile.tsx`, trocar os 2 joins de `profiles!classes_teacher_id_fkey` por `team_members!classes_teacher_id_fkey` (linhas 142 e 216).

### 3. Melhorar aba de cursos matriculados
Reorganizar a seção de enrollments para mostrar claramente:
- Status atual de cada curso (badge colorido)
- Aulas assistidas / total com barra de progresso (já existe)
- Turma e professor
- Tipo de matrícula e código

### 4. Adicionar botão "Gerar Certificado" por curso concluído
Para cada enrollment com status `concluido` e `certificate_issued = false`, exibir um botão "Gerar Certificado" que navega para `/certificates` com os dados pré-preenchidos. Já existe a função `handleCourseComplete` mas precisa de um botão explícito na seção de histórico.

### 5. Seção de Histórico de Modificações
Já existe a query de `enrollment_history`. Melhorar a exibição para incluir:
- Trocas de turma (remanejamento)
- Rematrículas
- Mudanças de status com data e horário

### 6. Integrar dados do AddEnrollmentDialog
No `AddEnrollmentDialog`, ao criar um novo aluno, também salvar `guardian_name` no lead (adicionar campo ao formulário se não existir). Garantir que ao criar a matrícula via Atendimento, os dados fluam corretamente para o perfil.

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/StudentProfile.tsx` | Corrigir joins (2x), adicionar campos idade/código ao card, botão certificado por curso concluído, melhorar histórico |
| `src/components/students/AddEnrollmentDialog.tsx` | Adicionar campo `guardian_name` ao formulário de novo aluno para sincronizar com o lead |

## Detalhes técnicos

**Correção de joins em StudentProfile.tsx:**
```
// Linha 142 e 216: trocar
profiles!classes_teacher_id_fkey(full_name)
// por
team_members!classes_teacher_id_fkey(full_name)
```

**Campos no card do perfil (novo layout):**
```text
┌─────────────────────────────────────────────┐
│ Nome Completo       │ Telefone (WhatsApp)   │
│ Responsável         │ Idade (do enrollment) │
│ Código MaxFama      │ Tipo de Matrícula     │
│ Observações Gerais (colspan 2)              │
│ [Matricular Aluno em Novo Curso]            │
└─────────────────────────────────────────────┘
```

**Botão Certificado** na seção de cursos concluídos:
```typescript
// Para cada enrollment concluído sem certificado
<Button onClick={() => navigate('/certificates', { state: { studentName, courseName, completionDate } })}>
  Gerar Certificado
</Button>
```

