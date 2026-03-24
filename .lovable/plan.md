

# Plano: Busca de contatos não salvos, info do modelo/responsável no chat, horários cortados e temporizador

## 1. Busca de contatos não salvos na barra de pesquisa

Atualmente, a busca só filtra contatos que já existem na lista (leads + virtuais com mensagens). Se o operador digitar um número que não tem mensagens nem está cadastrado, não encontra nada.

**Solução**: Quando a busca parece um número de telefone (só dígitos, 8+ chars) e não encontra resultados nos contatos carregados, criar um contato virtual temporário com esse número para permitir abrir a conversa e iniciar contato.

**Arquivo**: `src/pages/WhatsApp.tsx`
- No bloco `filteredContacts`, se `searchQuery` parece telefone e resultado é vazio, adicionar um contato virtual fabricado com o número digitado
- Exibir com badge "Iniciar conversa" para diferenciar

## 2. Nome do modelo + responsável no header do chat e na lista de contatos

**Arquivo**: `src/pages/WhatsApp.tsx`
- **Lista de contatos** (linha ~743): Já mostra `full_name`. Adicionar abaixo, em texto menor, o `guardian_name` quando existir (ex: "Resp: Maria Silva")
- **Header do chat** (linha ~793-796): Mostrar `full_name` como título principal e `guardian_name` como subtítulo abaixo do telefone, quando disponível

## 3. Horários cortados nas mensagens

**Arquivo**: `src/components/whatsapp/WhatsAppMessageList.tsx`
- O div do horário + status usa `flex items-center gap-1 mt-1` mas pode estar sendo cortado pelo `max-w-[75%]` do container pai ou pelo overflow do conteúdo
- Adicionar `shrink-0` ao wrapper do horário/status para evitar corte
- Garantir `whitespace-nowrap` no span do horário

## 4. Temporizador não mostra tempo correndo

Atualmente o "tempo de espera" é calculado uma vez com `differenceInHours` e não atualiza em tempo real.

**Arquivo**: `src/pages/WhatsApp.tsx`
- Adicionar um `useEffect` com `setInterval` de 60 segundos que incrementa um contador `now` (state)
- Usar esse `now` nos cálculos de `waitHours` e `getWaitTimeIndicator` para forçar re-render
- Na lista de contatos, o badge de tempo também passará a atualizar automaticamente

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/WhatsApp.tsx` | Busca por telefone não salvo; guardian_name na lista e header; temporizador com tick |
| `src/components/whatsapp/WhatsAppMessageList.tsx` | Fix horários cortados (whitespace-nowrap, shrink-0) |

