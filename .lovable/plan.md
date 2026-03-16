

# Plano: Finalizar e Integrar a Seção Acadêmica

## Problemas Encontrados

Analisei todos os arquivos da seção Acadêmico e identifiquei as seguintes lacunas e funcionalidades incompletas:

### 1. Botoes sem funcao (Classes.tsx)
Os botoes "Editar" e "Excluir" no dropdown das turmas nao fazem nada -- os `onClick` estao vazios.

### 2. Botao sem funcao (Courses.tsx)
O botao "Ver detalhes" no dropdown dos cursos nao tem acao.

### 3. Historico de tabulacao nao registrado (AcademicSupport)
Quando o operador muda o status no Atendimento Matricula, nenhum registro e salvo na tabela `enrollment_history`. As outras paginas (StudentDetailsSheet) mostram historico mas fica vazio porque ninguem grava.

### 4. Observacoes salvas nao sao exibidas (AcademicConversationPanel)
O operador salva observacoes no enrollment, mas o painel nao mostra as observacoes ja salvas. Falta um historico visivel.

### 5. Sem grade de presenca no painel academico
O AcademicConversationPanel mostra apenas contagem de faltas mas nao exibe a grade de 8 aulas como nas outras paginas.

### 6. Sem link para detalhes completos do aluno
Nao existe botao para navegar do Atendimento Matricula para a ficha completa do aluno (StudentDetailsSheet).

### 7. Status "rematricular" inconsistente
O AcademicSupport define um status `rematricular` no config visual mas esse valor nao existe no enum do banco. O botao "Rematricular" corretamente seta `ativo`, mas a tabulacao visual esta fora de sincronia.

## Plano de Implementacao

### A. Corrigir AcademicConversationPanel (principal)
- Adicionar secao "Observacoes Anteriores" que carrega e exibe as notas ja salvas no enrollment
- Adicionar grade visual de 8 aulas (igual StudentDetailsSheet) mostrando presenca/falta
- Adicionar botao "Ver Ficha Completa" que abre StudentDetailsSheet
- Registrar `enrollment_history` ao mudar status (INSERT com from_status, to_status, changed_by)
- Remover `rematricular` do config visual (usar o botao existente que ja muda para `ativo`)

### B. Corrigir Classes.tsx -- Botoes Editar e Excluir
- Editar: abrir dialog de edicao de turma (nome, sala, horario, professor)
- Excluir: confirmar e desativar turma (is_active = false)

### C. Corrigir Courses.tsx -- Ver Detalhes
- Abrir sheet lateral com info completa do curso: turmas vinculadas, quantidade de alunos, modulos LMS

### D. AcademicSupport.tsx -- Melhorias
- Ao atualizar status, tambem gravar na tabela `enrollment_history` com `changed_by` do usuario logado
- Adicionar contador de total de alunos no header
- Adicionar tab "Concluidos" e "Trancados" nas tabs de filtro

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `AcademicConversationPanel.tsx` | Exibir notas salvas, grade de presenca, botao ficha completa, gravar enrollment_history |
| `AcademicSupport.tsx` | Gravar enrollment_history ao mudar status, adicionar tab Concluidos |
| `Classes.tsx` | Implementar Editar (dialog) e Excluir (confirm + desativar) |
| `Courses.tsx` | Implementar Ver Detalhes (sheet com turmas e alunos) |
| Novo: `EditClassDialog.tsx` | Dialog para editar turma |
| Novo: `CourseDetailsSheet.tsx` | Sheet com detalhes do curso |

