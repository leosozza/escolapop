

## Corrigir lógica de "sem resposta" e contadores no WhatsApp

### Problemas identificados

1. **Filtro "Novas" mostra qualquer conversa com inbound** -- usa `_hasNewInbound` que marca `true` se a última mensagem do telefone é inbound, ignorando se já foi respondida ou lida
2. **Contador de unread conta TODAS as mensagens inbound desde o último "read"** -- deveria contar apenas mensagens inbound que ainda não foram respondidas (sem outbound posterior)
3. **"Sem resposta" deveria significar**: cliente enviou mensagem e nenhum outbound foi enviado DEPOIS dela

### Solução

**Arquivo: `src/pages/WhatsApp.tsx` -- função `fetchContacts`**

Alterar a lógica de processamento das mensagens (linhas ~350-377):

1. **Novo conceito `_needsReply`**: para cada telefone, verificar se a última mensagem é `inbound` (cliente mandou e ninguém respondeu ainda). Substituir `_hasNewInbound` por `_needsReply`

2. **Contador `unread_count` deve contar apenas mensagens inbound consecutivas no final** (sem outbound depois):
   - Iterar as mensagens do telefone em ordem cronológica reversa
   - Contar inbound até encontrar um outbound ou até o `lastRead` timestamp
   - Se a conversa já foi aberta (markAsRead) E existe outbound posterior ao último inbound, count = 0

3. **Lógica concreta**:
   - Para cada telefone, ao processar mensagens (já vem `desc`):
     - `lastDirection`: direção da mensagem mais recente
     - Se `lastDirection === 'inbound'`: `_needsReply = true`
     - Contar inbound consecutivos do topo até achar outbound = `pendingInboundCount`
     - `unread_count` = se conversa está aberta: 0. Se `lastRead` existe E `lastRead` >= último inbound: 0. Senão: `pendingInboundCount`

4. **Filtro "Novas"** (linha ~511): trocar de `_hasNewInbound` para `_needsReply` -- só mostra conversas que precisam de resposta

5. **Badge de unread** na lista de contatos: já usa `unread_count`, vai funcionar automaticamente

### Mudanças detalhadas

**`fetchContacts` -- substituir lógica de tracking**:
```
// Para cada telefone, rastrear:
const needsReplySet = new Set<string>();       // última msg é inbound
const pendingInboundCounts = new Map<string, number>(); // msgs inbound consecutivas no final

// Ao iterar mensagens (já em desc order):
for (const msg of lastMessages) {
  const cleanPhone = msg.phone.replace(/\D/g, '').slice(-8);
  phonesWithMessages.add(cleanPhone);
  
  if (!messageMap.has(cleanPhone)) {
    messageMap.set(cleanPhone, { ...msg, rawPhone: msg.phone });
    // A primeira msg encontrada (mais recente) define se precisa resposta
    if (msg.direction === 'inbound') {
      needsReplySet.add(cleanPhone);
      pendingInboundCounts.set(cleanPhone, 1);
    }
  } else if (needsReplySet.has(cleanPhone) && !pendingInboundCounts.has(cleanPhone + '_stopped')) {
    // Continuar contando inbound consecutivos
    if (msg.direction === 'inbound') {
      pendingInboundCounts.set(cleanPhone, (pendingInboundCounts.get(cleanPhone) || 0) + 1);
    } else {
      // Encontrou outbound, parar de contar
      pendingInboundCounts.set(cleanPhone + '_stopped', 1);
    }
  }
}

// unread_count: usar pendingInboundCounts, mas zerar se conversa aberta ou lida
```

**Substituir `_hasNewInbound` por `_needsReply`** em:
- Montagem de `contactsWithMessages` (linha ~409)
- Montagem de `virtualContacts` (linha ~441)
- Filtro `novas` (linha ~512)

### Arquivos alterados
- `src/pages/WhatsApp.tsx` (apenas)

