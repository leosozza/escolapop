

# Plano: Corrigir Integração WhatsApp WuzAPI

## Problemas Identificados

### 1. Endpoints WuzAPI incorretos na Edge Function
A documentação WuzAPI mostra que:
- `POST /chat/send/text` espera `Phone` como **número simples** (ex: `5491155553935`), **sem** o sufixo `@s.whatsapp.net`
- O código atual em `whatsapp-api` (linha 278) adiciona `@s.whatsapp.net` ao número antes de enviar — isso está **errado** segundo a doc

### 2. Webhook recebendo formato diferente do esperado
A documentação mostra que o webhook WuzAPI envia no formato:
```json
{
  "event": "Message",
  "instance": "5491155553934.0:53@s.whatsapp.net",
  "data": {
    "id": "3EB0ABCD...",
    "pushName": "Nome",
    "sender": "5491199999999@s.whatsapp.net",
    "message": { "conversation": "Olá" }
  }
}
```
Mas o código do webhook (linhas 62-65) procura por `body.Info?.MessageSource`, `body.Message`, `body.Info?.Sender` — que é o formato **antigo** do whatsmeow, não o formato atual do WuzAPI. O webhook vai ignorar todas as mensagens recebidas.

### 3. Webhook de status também com formato errado
Eventos de conexão vêm como `{ "event": "Connected", "instance": "..." }`, mas o código (linhas 116-117) procura `eventType === "connected"` (minúsculo) e `"Ready"` — deveria ser `"Connected"` e `"Disconnected"` (maiúsculo).

### 4. Configuração do webhook na instância usa `POST /webhook` com body incorreto
O campo correto é `webhook` e `events` (que está certo), mas o endpoint usa o **token da instância** (header `token`), o que está correto.

### 5. `check-status` parseia resposta incorretamente
O código (linha 198) verifica `res.data?.data?.Connected` — segundo a doc, a resposta é `{ code: 200, data: { Connected: true, LoggedIn: true } }`, então `res.data.data.Connected` está correto se o JSON parse funciona bem.

## O que será feito

### Edge Function `whatsapp-api`
1. **Corrigir `send-text`**: Enviar `Phone` como número puro sem `@s.whatsapp.net`
2. **Corrigir `send-document`**: Mesmo fix — número sem JID suffix

### Edge Function `whatsapp-webhook`
1. **Reescrever parser de mensagens** para o formato correto do WuzAPI:
   - Evento `"Message"`: dados em `body.data` (não `body.Info`/`body.Message`)
   - Sender em `body.data.sender`, conteúdo em `body.data.message.conversation`
   - Instance ID em `body.instance`
2. **Corrigir eventos de status**: `"Connected"` e `"Disconnected"` (maiúsculo)
3. **Melhorar identificação da instância**: usar `body.instance` (JID da instância) para encontrar qual `whatsapp_instance` corresponde, buscando pelo `wuzapi_user_id` ou `phone_number`

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/whatsapp-api/index.ts` | Remover `@s.whatsapp.net` do Phone em send-text e send-document |
| `supabase/functions/whatsapp-webhook/index.ts` | Reescrever para formato correto do WuzAPI |

## Detalhes técnicos

**send-text fix (whatsapp-api linha 277-283):**
```typescript
// Antes (ERRADO):
const jid = formattedPhone.startsWith("55")
  ? `${formattedPhone}@s.whatsapp.net`
  : `55${formattedPhone}@s.whatsapp.net`;
body: JSON.stringify({ Phone: jid, Body: message })

// Depois (CORRETO):
const phoneNumber = formattedPhone.startsWith("55")
  ? formattedPhone
  : `55${formattedPhone}`;
body: JSON.stringify({ Phone: phoneNumber, Body: message })
```

**webhook rewrite — formato correto:**
```typescript
// Formato real do WuzAPI:
// { event: "Message", instance: "55...@s.whatsapp.net", data: { sender: "55...@s.whatsapp.net", message: { conversation: "text" } } }

if (eventType === "Message") {
  const sender = body.data?.sender || "";
  const phone = sender.replace("@s.whatsapp.net", "");
  const content = body.data?.message?.conversation
    || body.data?.message?.extendedTextMessage?.text
    || body.data?.message?.imageMessage?.caption
    || "[Mídia recebida]";
  // ... save to whatsapp_messages
}
```

