

# Plano: Sistema de Importação/Exportação CSV e Webhook para Alunos

## Resumo

Implementar um sistema completo de importação/exportação para o módulo de Alunos (`/students`), incluindo:
1. **Exportação CSV**: Download dos dados de alunos/matrículas
2. **Importação CSV**: Upload com mapeamento de colunas e validação
3. **Webhook**: Endpoint para receber matrículas de sistemas externos

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Students Page (/students)                   │
├─────────────────────────────────────────────────────────────────┤
│  [Exportar CSV]  [Importar CSV]  [Webhook Info]                 │
└─────────────┬──────────────┬─────────────────┬──────────────────┘
              │              │                 │
              ▼              ▼                 ▼
       ┌──────────┐   ┌─────────────┐   ┌─────────────────┐
       │ Download │   │ CSV Import  │   │ Webhook Info    │
       │   CSV    │   │   Dialog    │   │    Sheet        │
       └──────────┘   └──────────────┘  └─────────────────┘
                              │                 │
                              ▼                 ▼
                      ┌──────────────┐  ┌─────────────────────────┐
                      │ leads +      │  │ webhook-students        │
                      │ enrollments  │  │ (Edge Function)         │
                      └──────────────┘  └─────────────────────────┘
```

---

## Componentes a Criar

### 1. Botões de Ação no Header (Students.tsx)

Adicionar três botões ao header da página:
- **Exportar CSV**: Gera e baixa arquivo CSV com dados das matrículas
- **Importar CSV**: Abre dialog de importação
- **Webhook**: Abre painel com documentação do webhook

### 2. StudentCSVExportButton (Novo Componente)

Funcionalidades:
- Selecionar quais colunas exportar
- Filtrar por status/curso antes de exportar
- Gerar arquivo CSV com encoding UTF-8 (suporte a acentos)

Colunas disponíveis:
- Nome do Aluno
- Telefone
- Email
- Idade
- Curso
- Turma
- Status
- Tipo de Matrícula
- Data de Matrícula
- Código de Agente
- Influenciador

### 3. StudentCSVImportDialog (Novo Componente)

Baseado no padrão existente em `CSVImportDialog.tsx`:
- Upload do arquivo
- Mapeamento de colunas (com auto-detecção)
- Preview dos dados
- Validação (campos obrigatórios, duplicatas)
- Progresso de importação
- Resumo final

Campos mapeáveis:
- Nome Completo (obrigatório)
- Telefone (obrigatório)
- Idade
- Curso (nome ou ID)
- Turma (nome ou ID)
- Tipo de Matrícula
- Código do Agente
- Influenciador
- Observações

### 4. StudentWebhookSheet (Novo Componente)

Painel lateral com:
- URL do webhook
- Parâmetros aceitos (tabela)
- Exemplos de uso (GET e POST)
- Histórico de matrículas recentes via webhook

### 5. Edge Function: webhook-students (Nova Função)

Endpoint público para criar matrículas:
- Aceita GET e POST
- Valida campos obrigatórios
- Verifica duplicatas por telefone
- Cria lead + enrollment automaticamente
- Suporta mapeamento flexível de campos

---

## Detalhes Técnicos

### Exportação CSV

```typescript
// Função de exportação
const exportToCSV = () => {
  const headers = ['Nome', 'Telefone', 'Curso', 'Turma', 'Status', ...];
  const rows = enrollments.map(e => [
    e.lead?.full_name,
    e.lead?.phone,
    e.course?.name,
    e.class?.name,
    e.status,
    ...
  ]);
  
  const csv = [headers, ...rows]
    .map(row => row.join(';'))
    .join('\n');
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  // Download usando URL.createObjectURL
};
```

### Importação CSV - Fluxo

1. **Upload**: Aceitar arquivo .csv
2. **Parse**: Ler e detectar delimitador (,  ou ;)
3. **Auto-map**: Mapear colunas automaticamente por nome
4. **Validação**: 
   - Nome e telefone obrigatórios
   - Verificar duplicatas
   - Validar curso/turma existentes
5. **Preview**: Mostrar primeiras 5 linhas
6. **Importar**: 
   - Criar lead com status 'matriculado'
   - Criar enrollment vinculado
7. **Resultado**: Mostrar sucesso/falhas

### Webhook - Parâmetros

| Parâmetro | Aliases | Campo | Obrigatório |
|-----------|---------|-------|-------------|
| full_name | client_name, nome | Nome do Aluno | Sim |
| phone | telefone, celular | Telefone | Sim |
| age | idade, student_age | Idade | Nao |
| course | curso, course_name | Nome do Curso | Nao |
| class_name | turma | Nome da Turma | Nao |
| enrollment_type | tipo_matricula | Tipo | Nao |
| referral_code | codigo_agente | Codigo Agente | Nao |
| influencer | influenciador | Influenciador | Nao |

### Estrutura de Arquivos

```text
src/
  components/
    students/
      StudentCSVExportButton.tsx    (novo)
      StudentCSVImportDialog.tsx    (novo)
      StudentWebhookSheet.tsx       (novo)
  pages/
    Students.tsx                    (atualizar)

supabase/
  functions/
    webhook-students/
      index.ts                      (novo)
  config.toml                       (atualizar)
```

---

## Alteracoes em Students.tsx

Adicionar ao header:

```tsx
<div className="flex gap-2">
  <StudentCSVExportButton enrollments={enrollments} />
  <Button variant="outline" onClick={() => setIsImportOpen(true)}>
    <Upload className="h-4 w-4 mr-2" />
    Importar CSV
  </Button>
  <Button variant="outline" onClick={() => setIsWebhookOpen(true)}>
    <Plug className="h-4 w-4 mr-2" />
    Webhook
  </Button>
  <Button onClick={() => setIsAddDialogOpen(true)}>
    <Plus className="h-4 w-4" />
    Nova Matricula
  </Button>
</div>
```

---

## Segurança

1. **Webhook publico**: Validacao de campos obrigatorios, normalizacao de telefone
2. **RLS**: Apenas staff pode ver/editar enrollments e leads
3. **Validacao de entrada**: Sanitizacao de dados antes de inserir
4. **Logs**: Registrar cada importacao/webhook para auditoria

---

## Sequencia de Implementacao

1. Criar `StudentCSVExportButton.tsx` - funcionalidade de exportacao
2. Criar `StudentCSVImportDialog.tsx` - wizard de importacao
3. Criar `StudentWebhookSheet.tsx` - documentacao do webhook
4. Criar edge function `webhook-students` - endpoint de integracao
5. Atualizar `Students.tsx` - integrar novos componentes
6. Atualizar `supabase/config.toml` - registrar nova funcao

