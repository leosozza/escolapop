

# Plano: Integrar e Corrigir Gaps da Secao Academica

## Gaps Encontrados

### 1. Certificado nao marca `certificate_issued` no enrollment
Quando o `QuickCertificateIssuer` gera o PDF, ele salva no storage mas **nunca atualiza** `certificate_issued = true` e `certificate_issued_at` na tabela `enrollments`. O `StudentProfile` e `StudentDetailsSheet` mostram "Certificado Pendente" eternamente.

### 2. `StudentDetailsSheet` duplicada com `StudentProfile`
O `StudentDetailsSheet` (sheet lateral) faz exatamente o mesmo que o `StudentProfile` (pagina completa) -- mesmos dados, mesma logica de presenca, mesmo historico. Mas o `StudentDetailsSheet` nao tem edicao e o `AcademicConversationPanel` ainda usa ele via "Ficha Completa" em vez de navegar para `/students/:leadId`.

### 3. `AcademicConversationPanel` "Ficha Completa" abre sheet em vez de pagina
O botao "Ficha Completa" abre o `StudentDetailsSheet` (sheet lateral) em vez de navegar para `/students/:leadId` que e a pagina completa com edicao.

### 4. `AddAcademicContactDialog` cria aluno sem idade e sem tipo de matricula
O dialog do Atendimento Matricula so pede nome, telefone, curso e turma. Faltam campos obrigatorios: `student_age`, `enrollment_type`. Deveria usar o mesmo `AddEnrollmentDialog` que ja tem tudo.

### 5. `AcademicSupport` nao atualiza ao voltar da pagina do aluno
Usa `useState` + `useEffect` manual em vez de `useQuery`, entao ao navegar para o perfil e voltar os dados ficam stale.

### 6. Status update no `StudentProfile` nao grava `enrollment_history`
O `updateStatusMutation` no `StudentProfile` faz `update` no enrollment mas **nao insere** na tabela `enrollment_history`. O trigger `log_enrollment_status_change` existe como funcao no banco mas os triggers estao listados como "no triggers" -- logo o historico so e gravado manualmente (e o `StudentProfile` esquece de fazer isso).

### 7. Trigger de enrollment_history nao esta ativo
A funcao `log_enrollment_status_change()` existe mas nao ha trigger associado. O historico so funciona onde e gravado manualmente (AcademicSupport).

### 8. `StudentDetailsSheet` status update tambem nao grava historico
Mesmo problema do item 6.

### 9. Certificados: nao filtra por alunos com status `concluido`
O `QuickCertificateIssuer` lista TODOS os leads para emitir certificado, sem filtrar quem realmente concluiu o curso.

## Plano de Implementacao

### A. Criar trigger de enrollment_history no banco (migracao SQL)
```sql
CREATE TRIGGER on_enrollment_status_change
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_enrollment_status_change();
```
Isso resolve os itens 6, 7, 8 de uma vez -- qualquer update de status em qualquer pagina grava historico automaticamente.

### B. Corrigir `QuickCertificateIssuer` -- marcar certificado emitido
Apos gerar o PDF com sucesso, fazer update no enrollment correspondente:
- `certificate_issued = true`
- `certificate_issued_at = now()`
- Filtrar lista de alunos para mostrar apenas os com enrollments `concluido`

### C. Substituir `AddAcademicContactDialog` por `AddEnrollmentDialog`
No `AcademicSupport`, trocar o dialog simplificado pelo `AddEnrollmentDialog` que ja possui todos os campos necessarios (idade, tipo matricula, influenciador, codigo, agente).

### D. Corrigir `AcademicConversationPanel` -- navegar para perfil completo
Trocar o botao "Ficha Completa" de abrir `StudentDetailsSheet` para navegar para `/students/:leadId` usando `useNavigate`.

### E. Remover insercao manual de enrollment_history
No `AcademicSupport.handleStatusUpdate`, remover o insert manual em `enrollment_history` pois o trigger cuida disso agora.

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Criar trigger `on_enrollment_status_change` |
| `QuickCertificateIssuer.tsx` | Marcar `certificate_issued` + filtrar alunos concluidos |
| `AcademicSupport.tsx` | Trocar dialog por `AddEnrollmentDialog`, remover insert manual de historico |
| `AcademicConversationPanel.tsx` | Navegar para `/students/:leadId` em vez de abrir sheet |
| `StudentProfile.tsx` | Nenhuma mudanca necessaria (trigger cuida do historico) |

