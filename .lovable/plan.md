

# Plano: Varredura Completa e Finalização do Projeto

## Problemas Identificados

Após análise completa de todas as rotas, páginas, componentes e fluxos do sistema, identifiquei os seguintes problemas:

### 1. Dados Hardcoded (Sem Conexão com o Banco)
- **Reports.tsx**: Todos os KPIs são números fixos (247 leads, 89 agendamentos, 38% conversão, R$89.450 receita, etc). Nenhum dado vem do banco de dados. O gráfico "Funil de Vendas" mostra apenas placeholder "Gráficos serão implementados em breve".

### 2. Botões/Ações Sem Funcionalidade
- **Contracts.tsx** (linhas 275-292): "Ver detalhes", "Editar", "Marcar como assinado" e "Cancelar" no dropdown não possuem `onClick` — clicam e nada acontece.
- **Contracts.tsx** (linha 146-149): Botão "Novo Contrato" não tem `onClick`.
- **Overdue.tsx** (linhas 132-135): "Enviar Cobranças em Massa" não tem ação.
- **Overdue.tsx** (linhas 266-275): Botões de telefone, email e "Cobrar" não têm ação funcional.
- **Reports.tsx** (linha 51): Botão "Exportar" não tem ação.
- **Leads.tsx** (linha 260): "Agendar" no dropdown sem `onClick`.
- **AppLayout.tsx** (linhas 104-109): Barra de busca global no header não funciona (input sem estado nem ação).

### 3. Joins/Queries Incorretos
- **Overdue.tsx** (linha 60): Usa `profiles!enrollments_student_id_fkey` para buscar dados do aluno. O `student_id` em enrollments referencia `auth.users`, mas os alunos são leads, não usuários. O join deveria ser `lead:leads!enrollments_lead_id_fkey(full_name, phone)`.

### 4. Página Órfã
- **Index.tsx**: Página genérica "Welcome to Your Blank App" — nunca acessível (/ redireciona para /dashboard), mas código desnecessário.
- **AgentPortfolio.tsx** e **ProducerQueue.tsx**: Estão nas rotas mas não no sidebar — possíveis páginas órfãs.

### 5. Inconsistências de Nomenclatura
- **AppLayout.tsx** (linha 25): Rota `/academic-support` tem título "Atendimentos" mas no sidebar é "Atendimento Matrícula".

---

## O que Será Feito

### Bloco A: Corrigir Dados Reais nos Relatórios
- Refatorar `Reports.tsx` para buscar dados reais do banco (contagem de leads, agendamentos, matrículas, taxa de conversão, alunos ativos, presença, valores financeiros, contagem de equipe).
- Substituir o placeholder do gráfico por um gráfico real usando Recharts (funil de vendas com dados reais).

### Bloco B: Conectar Todas as Ações Desconectadas
- **Contracts.tsx**: Implementar ações "Marcar como assinado" e "Cancelar" com mutations reais. Adicionar toast de confirmação. O botão "Novo Contrato" permanece desabilitado com tooltip (contratos são criados via matrícula).
- **Overdue.tsx**: Conectar botão de telefone ao WhatsApp (`openWhatsAppWeb`). Botão "Cobrar" abre WhatsApp com mensagem de cobrança pré-formatada.
- **Leads.tsx**: Conectar "Agendar" para abrir `ScheduleLeadDialog`.

### Bloco C: Corrigir Query da Inadimplência
- **Overdue.tsx**: Trocar o join de `profiles!enrollments_student_id_fkey` para `lead:leads!enrollments_lead_id_fkey(full_name, phone)` para exibir corretamente os dados dos alunos.

### Bloco D: Remover Busca Global Inativa
- **AppLayout.tsx**: Remover a barra de busca global no header que não funciona, ou substituir por navegação rápida.

### Bloco E: Corrigir Nomenclatura
- **AppLayout.tsx**: Alterar título de `/academic-support` de "Atendimentos" para "Atendimento Matrícula".

### Bloco F: Limpar Código Morto
- **Index.tsx**: Substituir conteúdo pelo redirect (já existe no App.tsx, mas manter o arquivo limpo).

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/Reports.tsx` | Buscar dados reais + gráfico Recharts |
| `src/pages/Contracts.tsx` | Implementar ações do dropdown |
| `src/pages/Overdue.tsx` | Corrigir join + conectar botões WhatsApp |
| `src/pages/Leads.tsx` | Conectar ação "Agendar" |
| `src/components/layout/AppLayout.tsx` | Corrigir título + remover busca inativa |
| `src/pages/Index.tsx` | Limpar |

## Estimativa
Aproximadamente 6 arquivos editados. Sem migrações de banco necessárias.

