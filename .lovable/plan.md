

# Plano: Corrigir exclusão de turmas

## Problema

A exclusão de turma falha silenciosamente porque:
1. A tabela `class_enrollments` tem FK para `classes` e não é limpa antes do `DELETE`
2. O erro de FK faz o delete falhar, mas o catch genérico não mostra detalhes
3. Após o erro, `fetchClasses` pode falhar ou o estado fica inconsistente, fazendo todas as turmas sumirem

## Correção

### `src/pages/Classes.tsx` — `handleDeleteClass`

Ajustar a ordem de limpeza para incluir `class_enrollments`:

```
1. DELETE FROM attendance WHERE class_id = X
2. DELETE FROM class_enrollments WHERE class_id = X
3. UPDATE enrollments SET class_id = null, status = 'ativo' WHERE class_id = X
4. DELETE FROM classes WHERE id = X
```

Também:
- Atualizar o estado local (`setClasses`) removendo a turma deletada imediatamente, sem depender apenas do `fetchClasses`
- Limpar `selectedClass` após exclusão
- Melhorar o tratamento de erro para mostrar a mensagem real

