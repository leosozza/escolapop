

# Corrigir Envio e Recebimento de Audio WhatsApp

## Correcoes Aplicadas

### `supabase/functions/whatsapp-api/index.ts`
1. ✅ Regex base64 corrigida: `^data:[^,]+,` (remove tudo ate a virgula)
2. ✅ Base64 puro enviado para WuzAPI em Audio, Image, Video e Document

### `supabase/functions/whatsapp-webhook/index.ts`
3. ✅ `MessageID: msgId` adicionado de volta ao body do download de midia
4. ✅ Log do payload completo do mediaMessage para diagnostico
5. ✅ Checagem de midia embutida (base64) no evento antes de tentar download
6. ✅ `DirectPath` adicionado ao body do download
7. ✅ Fallback CDN usando DirectPath quando Url esta vazio
