

# Corrigir Download de Midia no Webhook WhatsApp

## Problema
Audios e midias chegam como "midia indisponivel" porque o download falha com 404 nos endpoints da WuzAPI.

## Correcoes no `supabase/functions/whatsapp-webhook/index.ts`

1. **Normalizar WUZAPI_URL** — `WUZAPI_URL.replace(/\/+$/, "")` para evitar URLs com `//chat/...`
2. **Logar URL completa** — `console.log` do URL final para debug
3. **Remover `MessageID` do body** — a spec WuzAPI nao inclui esse campo no schema `DownloadMedia`, enviar apenas `Url`, `MediaKey`, `Mimetype`, `FileSHA256`, `FileLength`
4. **Adicionar `/chat/downloadsticker`** ao endpoint map
5. **Remover fallback `/chat/downloadmedia`** — endpoint inexistente na spec
6. **Novo fallback: fetch direto da URL do WhatsApp CDN** — se o download via WuzAPI falhar, tentar baixar diretamente da `Url` presente no payload da mensagem

## Arquivo

| Arquivo | Acao |
|---------|------|
| `supabase/functions/whatsapp-webhook/index.ts` | Todas as correcoes acima |

