

# Plano: Atualizar Roadmap com Status Real do Projeto

## O que está desatualizado

O roadmap atual não reflete as funcionalidades implementadas nas últimas iterações. Vários itens marcados como "planned" ou "in-progress" já foram concluídos.

## Atualizações por Fase

### Fase 2 — Gestão de Alunos (manter 100%)
- Adicionar features: Remanejamento, Rematrícula, Dashboard de Alunos (KPIs), Justificativa de Presença

### Fase 5 — Gestão Acadêmica (manter 100%)
- Adicionar features: Atendimento Matrícula (dashboard completo), Automação 24h/48h, Tabulações pós-matrícula (ausente, reprovado_faltas, formado), Certificado em massa, Transferência de turma

### Fase 6 — Financeiro → marcar **completed** (100%)
- Relatórios Financeiros agora funcionam via Reports.tsx com dados reais do banco

### Fase 7 — Integrações Básicas → marcar **completed** (100%)
- Adicionar: Gestão de Acessos (criar login/senha internamente), Edge Functions (manage-users, academic-lead-automations)

### Fase 8 — Integrações Avançadas → atualizar para **in-progress** (20%)
- WhatsApp links já funcionam (openWhatsAppWeb) em vários módulos — marcar como "in-progress"
- Resto continua planned

### Fase 10 — Dashboards Executivos → atualizar para **in-progress** (40%)
- Gráficos de Funil: **completed** (Recharts em Reports.tsx)
- Relatórios de Conversão: **completed** (dados reais)
- Export CSV: **completed** (Reports.tsx)
- Forecast/Evasão: planned

### Nova Fase a considerar: Gestão de Acessos e Permissões
- Já implementado: UserManagement, CreateUserDialog, ResetPasswordDialog, manage-users edge function, roles por área
- Poderia ser incorporado na Fase 7 ou ser feature destacada

## Arquivo a modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/Roadmap.tsx` | Atualizar array `roadmapPhases` com status corretos, novas features e percentuais reais |

## Resumo dos novos números
- Fases concluídas: 7 (era 5)
- Fases em progresso: 2 (era 2, mas diferentes)
- Fases planejadas: 3 (era 5)
- Progresso geral: ~65% (era ~52%)

