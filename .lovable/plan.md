

# Plano: Corrigir age_range + Detecção de Conflito de Turmas

## Problema 1: age_range nao atualiza
O `EditClassDialog` usa `defaultValues` no `useForm`, mas React Hook Form nao reseta automaticamente quando `classData` muda. Precisa de um `useEffect` com `form.reset()` quando o dialog abre com dados novos.

Tambem no `AddClassDialog`, o `age_range` esta tipado corretamente e salva com `as any`. Preciso confirmar que o form.reset() limpa corretamente ao fechar.

## Problema 2: Turmas duplicadas
Adicionar validacao antes do insert/update que verifica se ja existe uma turma ativa com a mesma combinacao de:
- **sala** + **dia da semana** + **horario** + **faixa etaria**
- E cujo periodo (start_date a end_date) se sobreponha com a nova turma

## Mudancas

### `EditClassDialog.tsx`
- Adicionar `useEffect` que chama `form.reset(newValues)` quando `classData` ou `open` mudam
- Remover `as any` do interface (adicionar `age_range` ao tipo)

### `AddClassDialog.tsx`
- Antes do insert, buscar turmas ativas com mesma sala + dia + horario cujas datas se sobreponham
- Se encontrar conflito, mostrar toast de erro com o nome da turma conflitante e impedir criacao
- Mesma logica no `EditClassDialog` antes do update

### Interface `Class` em `Classes.tsx`
- Adicionar `age_range` ao tipo para remover todos os `as any`

## Logica de conflito

```text
Antes de salvar:
1. Buscar classes WHERE room = X AND is_active = true AND id != current_id
2. Filtrar no JS: schedule tem mesmo dia E mesmo horario
3. Verificar sobreposicao de datas (start_date <= new_end AND end_date >= new_start)
4. Se encontrar → toast.error("Ja existe a turma [nome] nessa sala, dia e horario no mesmo periodo")
```

## Arquivos a modificar

| Arquivo | Acao |
|---------|------|
| `src/pages/Classes.tsx` | Adicionar `age_range` ao tipo `Class` |
| `src/components/classes/AddClassDialog.tsx` | Validacao de conflito antes do insert |
| `src/components/classes/EditClassDialog.tsx` | `form.reset()` no useEffect + validacao de conflito |

