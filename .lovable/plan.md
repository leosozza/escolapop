

## Capturar mensagens enviadas pelo WhatsApp nativo no sistema

### Problema
Atualmente, quando a WuzAPI envia um evento `Message` com `IsFromMe: true` (mensagem enviada pelo celular/WhatsApp Web nativo), o webhook ignora completamente (linha 98-101: `"IsFromMe echo, skipping inbound save"`). Isso significa que qualquer mensagem enviada fora do sistema nunca aparece na interface.

### Solução

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**

Remover o `return okResponse()` do bloco `isFromMe` e, em vez disso, permitir que o fluxo continue normalmente — mas com duas diferenças:

1. **`direction: 'outbound'`** em vez de `'inbound'`
2. **`status: 'sent'`** em vez de `'received'`
3. **Dedup por `wuzapi_message_id`**: verificar se já existe uma mensagem com o mesmo `wuzapi_message_id` antes de inserir, para evitar duplicatas quando o sistema envia uma mensagem (que já é salva no envio) e a WuzAPI ecoa de volta

### Mudanças concretas

**Linha 98-101** — Substituir o early return por uma flag:
```typescript
// REMOVER:
if (isFromMe) {
  console.log("IsFromMe echo, skipping inbound save");
  return okResponse();
}

// SUBSTITUIR POR: (deixar o fluxo continuar, a flag isFromMe já existe)
// Nenhum early return — o isFromMe será usado no insert
```

**Linha 361-371** — Usar `isFromMe` para definir direction/status e adicionar dedup:
```typescript
// Antes do insert, verificar se já existe (dedup para msgs enviadas pelo sistema)
if (isFromMe && msgId) {
  const { data: existing } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("wuzapi_message_id", msgId)
    .limit(1)
    .maybeSingle();
  if (existing) {
    console.log("Skipping duplicate outbound echo:", msgId);
    return okResponse();
  }
}

const { error: insertErr } = await supabase.from("whatsapp_messages").insert({
  phone,
  content,
  lead_id: lead?.id || null,
  direction: isFromMe ? "outbound" : "inbound",
  message_type: messageType,
  media_url: mediaUrl,
  wuzapi_message_id: msgId || null,
  status: isFromMe ? "sent" : "received",
  instance_id: instanceId,
});
```

**Log** — Ajustar mensagem de sucesso:
```typescript
console.log(isFromMe ? "✅ Outbound echo saved" : "✅ Inbound message saved", "from:", phone);
```

### Resultado
- Mensagens enviadas pelo celular nativo aparecerão automaticamente no chat como outbound
- Mensagens já enviadas pelo sistema não serão duplicadas (dedup por `wuzapi_message_id`)
- Mídias enviadas pelo nativo também serão baixadas e armazenadas normalmente
- Reações enviadas pelo nativo também serão capturadas (já funcionam, pois o bloco de reações vem antes do early return removido — na verdade não, ele vem depois, então reações `isFromMe` também passarão a funcionar)

### Arquivo alterado
- `supabase/functions/whatsapp-webhook/index.ts` (apenas)

