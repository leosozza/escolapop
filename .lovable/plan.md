

# Corrigir Recebimento de Audio WhatsApp

## Problema
Os logs mostram claramente:
```
Download media failed (/chat/downloadaudio): 500 {"code":500,"error":"failed to download audio no url present","success":false}
No direct URL available for fallback
```

O campo `Url` no `audioMessage` do webhook esta vazio. O WuzAPI nao consegue baixar sem URL, e o fallback CDN tambem falha porque nao ha URL.

## Causa Raiz

A WuzAPI suporta um modo `mediaDelivery` que pode ser `base64`, `s3` ou `both`. Quando configurado como `base64`, a midia e entregue diretamente no evento do webhook (campo `Data` ou `Media` no corpo da mensagem). Atualmente o codigo ignora essa possibilidade e tenta sempre baixar via endpoint.

Alem disso, o campo `DirectPath` pode estar presente no payload mesmo quando `Url` esta vazio -- esse campo pode ser usado para construir a URL completa.

## Correcoes no `supabase/functions/whatsapp-webhook/index.ts`

### 1. Logar o payload completo do audioMessage
Adicionar `console.log("mediaMessage fields:", JSON.stringify(mediaMessage))` logo apos extrair o `mediaMessage`, para poder diagnosticar exatamente quais campos chegam.

### 2. Checar midia embutida no evento ANTES de tentar download
Antes de chamar o endpoint de download, verificar se o evento ja contem a midia em base64 nos campos `mediaMessage.Data`, `mediaMessage.Media`, `eventData.Data`, ou `eventData.Media`. Se existir, pular o download e ir direto para upload no Storage.

### 3. Adicionar `DirectPath` ao body do download
Incluir o campo `DirectPath` no body da requisicao de download -- o WuzAPI pode usa-lo para construir a URL quando o campo `Url` esta vazio.

### 4. Construir URL do CDN a partir do DirectPath como fallback
Se `Url` estiver vazio mas `DirectPath` existir, construir a URL como `https://mmg.whatsapp.net${DirectPath}` e tentar o fetch direto.

## Mudancas detalhadas

| Local | Acao |
|-------|------|
| Apos linha ~190 | `console.log("mediaMessage fields:", JSON.stringify(mediaMessage))` |
| Apos linha ~213 | Checar `mediaMessage.Data` / `mediaMessage.Media` -- se existir, pular download e ir direto para upload |
| Linha ~222-229 | Adicionar `DirectPath: mediaFields.DirectPath` ao body do POST |
| Linha ~272-299 | No fallback, se `Url` vazio mas `DirectPath` presente, construir URL `https://mmg.whatsapp.net${DirectPath}` |

## Arquivo

| Arquivo | Acao |
|---------|------|
| `supabase/functions/whatsapp-webhook/index.ts` | Todas as correcoes acima |

