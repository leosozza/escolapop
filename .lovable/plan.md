

# Plano: Corrigir Áudio, Imagens, Vídeos e Reações no WhatsApp

## Problemas identificados

1. **Áudio/Imagem/Vídeo não reproduz**: O webhook salva `directPath` do WuzAPI (caminho relativo como `/v/t62.7114-24/...`) que não é uma URL válida para o navegador. O `<audio>`, `<img>` e `<video>` precisam de URLs completas.

2. **Reações com emoji não aparecem**: WuzAPI envia reações como `Message` com `reactionMessage` no payload. O webhook não trata isso — salva como "[Mídia recebida]".

## Solução

### 1. Webhook — Download de mídia e upload para Storage

No `whatsapp-webhook/index.ts`, quando uma mensagem de mídia chega:
- Usar o endpoint WuzAPI `/chat/downloadmedia` (passando o message ID) para obter o arquivo em base64
- Fazer upload para Supabase Storage (bucket `whatsapp-media`)
- Salvar a URL pública do Storage como `media_url`
- Para isso, o webhook precisa buscar o `wuzapi_token` da instância resolvida

### 2. Webhook — Tratar reações (emoji)

- Detectar `message.reactionMessage` no payload
- Salvar como `message_type: 'reaction'` com o emoji no `content`
- Incluir referência à mensagem reagida via `reactionMessage.key.id`

### 3. Frontend — Exibir reações

- No `WhatsAppMessageList.tsx`, agrupar reações com a mensagem original
- Mostrar emoji abaixo do balão da mensagem reagida (estilo WhatsApp)

### 4. Migração — Bucket de Storage

- Criar bucket `whatsapp-media` no Supabase Storage com política pública de leitura

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| **migração SQL** | Criar bucket `whatsapp-media` + políticas de storage |
| `supabase/functions/whatsapp-webhook/index.ts` | Download de mídia via WuzAPI, upload para Storage, tratar reações |
| `src/components/whatsapp/WhatsAppMessageList.tsx` | Exibir reações agrupadas nas mensagens; fallback para player nativo de áudio |

## Fluxo de mídia corrigido

```text
WuzAPI Webhook → detecta mídia → busca token da instância
→ chama /chat/downloadmedia com msgId
→ recebe base64 → upload para Supabase Storage
→ salva URL pública em media_url
→ frontend renderiza normalmente com URL válida
```

## Detalhes técnicos

**Download de mídia (WuzAPI):**
```
POST /chat/downloadmedia
Headers: { token: <instance_token> }
Body: { MessageID: "<msg_id>" }
Response: { data: { Media: "base64...", Mimetype: "audio/ogg", ... } }
```

**Reações (payload WuzAPI):**
```json
{
  "reactionMessage": {
    "key": { "id": "<original_msg_id>" },
    "text": "👍"
  }
}
```

**Storage bucket:**
- Nome: `whatsapp-media`
- Estrutura: `whatsapp-media/{instance_id}/{msg_id}.{ext}`
- Política: leitura pública para staff autenticado

