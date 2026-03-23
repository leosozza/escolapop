

# Plano: Integrar Tabulação Acadêmica na Página WhatsApp e Remover Atendimento Matrícula

## Resumo

Unificar todo o atendimento (comercial + acadêmico) na página `/whatsapp`. A página de Atendimento Matrícula (`/academic-support`) será removida. O painel de info do WhatsApp ganhará botões de ação rápida para tabulação, matrícula e geração de certificado.

## O que será feito

### 1. Expandir o painel de info do WhatsApp com ações de tabulação

No painel lateral direito (Info do contato) da página `/whatsapp`, adicionar:

- **Botões de tabulação rápida**: Status do lead (Lead → Em Atendimento → Agendado → Confirmado → Compareceu → Matriculado → Perdido)
- **Botão "Matricular"**: Abre o `AddEnrollmentDialog` pré-preenchido com os dados do contato selecionado
- **Botão "Gerar Certificado"**: Navega para `/certificates` com dados do aluno
- **Botão "Ficha Completa"**: Navega para `/students/:leadId`
- **Indicador de tempo de espera**: Mostra há quanto tempo o lead está sem resposta (12h, 24h+, 48h+)
- **Seção de enrollment info**: Se o contato tiver matrícula, mostrar curso, turma, faltas, status acadêmico

### 2. Integrar dados acadêmicos na busca de contatos

Na função `fetchContacts`, além de buscar leads, também buscar dados de enrollment (curso, turma, faltas) para exibir no painel de info quando disponível. Isso substitui toda a lógica que existia no AcademicSupport.

### 3. Remover página Atendimento Matrícula

- Deletar `src/pages/AcademicSupport.tsx`
- Remover rota `/academic-support` do `App.tsx`
- Remover item "Atendimento Matrícula" do sidebar (`AppSidebar.tsx`)
- Remover referência em `AppLayout.tsx`

### 4. Manter automação de 24h/48h

A lógica de alerta de 24h e auto-tabulação de 48h já existe na Edge Function `academic-lead-automations`. Será mantida como está. No painel de info, exibir o indicador de tempo de espera para leads sem resposta.

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/WhatsApp.tsx` | Expandir painel de info com botões de tabulação, matrícula, certificado, dados acadêmicos |
| `src/App.tsx` | Remover rota `/academic-support` |
| `src/components/layout/AppSidebar.tsx` | Remover item "Atendimento Matrícula" |
| `src/components/layout/AppLayout.tsx` | Remover entrada de breadcrumb |
| `src/pages/AcademicSupport.tsx` | Deletar arquivo |

## Detalhes do painel de info expandido

```text
┌─────────────────────────┐
│ Info do contato     [X] │
├─────────────────────────┤
│    [Avatar]             │
│    Nome do Contato      │
│    (11) 94089-7303      │
├─────────────────────────┤
│ ⚡ AÇÕES RÁPIDAS        │
│ [Matricular] [Certif.]  │
│ [Ficha Completa]        │
├─────────────────────────┤
│ 📋 TABULAÇÃO            │
│ [Select: status lead]   │
├─────────────────────────┤
│ 🎓 DADOS ACADÊMICOS    │
│ Curso: Modelo Teen      │
│ Turma: T01-2025         │
│ Faltas: 2               │
│ Status: Em Curso        │
│ [Select: status acad.]  │
├─────────────────────────┤
│ ⏱ TEMPO DE ESPERA       │
│ 🟡 24h+ sem resposta    │
├─────────────────────────┤
│ 📝 OBSERVAÇÕES          │
│ [texto editável]        │
└─────────────────────────┘
```

