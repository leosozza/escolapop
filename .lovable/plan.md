

# Corrigir Envio e Recebimento de Audio WhatsApp

## Problemas Identificados nos Logs

### 1. Envio: `Failed to decode base64`
A regex `^data:[^;]+;base64,` nao funciona com MIME types que contem ponto-e-virgula como `data:audio/ogg; codecs=opus;base64,DATA`. O `[^;]+` para no primeiro `;` (de `codecs=opus`), deixando lixo no base64.

Alem disso, o campo `Audio` enviado para a WuzAPI contem o prefixo `data:...;base64,` — a WuzAPI espera base64 puro.

### 2. Recebimento: `"failed to download audio no url present"`
O webhook da WuzAPI nao inclui o campo `url` no `audioMessage`. O endpoint `/chat/downloadaudio` precisa de um `MessageID` para localizar e baixar a midia — campo que foi removido na edicao anterior.

## Correcoes

### `supabase/functions/whatsapp-api/index.ts`

**Fix 1**: Trocar TODAS as ocorrencias da regex de strip base64 de:
```
.replace(/^data:[^;]+;base64,/, "")
```
Para:
```
.replace(/^data:[^,]+,/, "")
```
Isso remove tudo ate a virgula, independente de quantos `;` existam no MIME type.

**Fix 2**: Enviar base64 puro (sem data URL prefix) para a WuzAPI no campo `Audio`. Extrair o base64 antes de enviar:
```typescript
const audioBase64 = audio.replace(/^data:[^,]+,/, "");
body: JSON.stringify({ Phone: ..., Audio: audioBase64, PTT: true, MimeType: "audio/ogg; codecs=opus" })
```

Aplicar o mesmo para `Image`, `Video`, `Document`.

### `supabase/functions/whatsapp-webhook/index.ts`

**Fix 3**: Adicionar `MessageID: msgId` de volta ao body do download:
```typescript
body: JSON.stringify({
  MessageID: msgId,
  Url: mediaFields.Url,
  MediaKey: mediaFields.MediaKey,
  Mimetype: mediaFields.Mimetype,
  FileSHA256: mediaFields.FileSHA256,
  FileLength: mediaFields.FileLength,
}),
```

## Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/whatsapp-api/index.ts` | Fix regex base64 + enviar base64 puro para WuzAPI |
| `supabase/functions/whatsapp-webhook/index.ts` | Adicionar MessageID ao download |

