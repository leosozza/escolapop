

# Plano: Corrigir Recebimento de Mensagens e Status de Entrega

## Diagnóstico

Três problemas distintos identificados:

### 1. Webhook não está recebendo chamadas
Os logs do webhook estão **completamente vazios** — a WuzAPI não está enviando eventos. Isso explica por que mensagens recebidas não aparecem. Causa provável: a configuração do webhook na WuzAPI não está persistindo ou o formato da URL/eventos está incorreto.

### 2. ReadReceipt não atualiza status das mensagens
O webhook recebe `ReadReceipt` mas apenas faz `console.log("Read receipt received")` — não atualiza o status da mensagem na tabela `whatsapp_messages` de `sent` para `delivered`/`read`.

### 3. Frontend não escuta atualizações de status
O `WhatsAppMessageList` escuta apenas `INSERT` no realtime. Quando o status de uma mensagem muda (sent → delivered → read), o componente não atualiza.

## O que será feito

### Edge Function `whatsapp-webhook`
1. **Adicionar logs detalhados** no início para debugar se chamadas chegam
2. **Implementar handler de `Receipt`** (WuzAPI envia `Receipt`, não apenas `ReadReceipt`): atualizar `whatsapp_messages.status` para `delivered` ou `read` baseado no tipo de recibo
3. **Tratar evento `ChatPresence`** (digitando): não persiste, mas pode ser retransmitido via broadcast channel

### Edge Function `whatsapp-api`
4. **Adicionar action `check-webhook`**: verificar se o webhook está configurado corretamente na WuzAPI (GET /webhook) e reconfigurar se necessário
5. **Incluir `Receipt` e `ChatPresence`** na lista de eventos assinados ao conectar/configurar webhook

### Frontend `WhatsAppMessageList`
6. **Escutar evento `UPDATE`** além de `INSERT` no canal realtime, para refletir mudanças de status (sent → delivered → read)
7. **Adicionar status `read`**: duplo check azul (CheckCheck com cor diferente)

### Frontend `WhatsApp.tsx`
8. **Adicionar botão de diagnóstico de webhook**: permite verificar e reconfigurar o webhook da instância selecionada

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/whatsapp-webhook/index.ts` | Implementar handler de Receipt/ReadReceipt que atualiza status; adicionar logs |
| `supabase/functions/whatsapp-api/index.ts` | Adicionar action `check-webhook`; incluir Receipt nos eventos; adicionar `diagnose-webhook` |
| `src/components/whatsapp/WhatsAppMessageList.tsx` | Escutar UPDATE no realtime; adicionar status `read` com check azul |

## Detalhes técnicos

**Webhook Receipt handler:**
```typescript
if (eventType === "Receipt" || eventType === "ReadReceipt") {
  const receiptData = body.data || {};
  const messageIds = receiptData.ids || [receiptData.id];
  const receiptType = receiptData.type; // "delivered", "read", "played"
  const newStatus = receiptType === "read" || receiptType === "played" ? "read" : "delivered";
  
  // Update all matching messages
  for (const msgId of messageIds) {
    await supabase.from("whatsapp_messages")
      .update({ status: newStatus })
      .eq("wuzapi_message_id", msgId);
  }
}
```

**Realtime UPDATE listener:**
```typescript
.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
  const updated = payload.new as Message;
  setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
})
```

**Eventos assinados expandidos:**
```json
["Message", "Receipt", "ReadReceipt", "ChatPresence", "Connected", "Disconnected"]
```

