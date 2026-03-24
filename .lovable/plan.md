

# Corrigir Download de Midia WhatsApp + Recuperar Midias Antigas

## Problema

Os logs mostram que tanto audio quanto imagem do numero 5515996045202 falharam com:
```
Media download error: Failed to decode base64
```

Isso acontece na linha `atob(base64Media)` no webhook. O WuzAPI retorna base64 que pode conter:
- Prefixo data URI (`data:audio/ogg;base64,...`)
- Whitespace/newlines
- Caracteres invalidos para `atob()`

Resultado: todas as mensagens recentes de midia estao com `media_url: null` no banco.

## Correcoes

### 1. Decodificacao base64 robusta (`whatsapp-webhook/index.ts`)

Substituir o `atob()` direto por uma funcao auxiliar que:
- Remove prefixo data URI (`data:...;base64,` ou `data:...,`)
- Remove whitespace e newlines
- Usa `Uint8Array` via `atob()` de forma segura com try/catch interno
- Log do tamanho e primeiros caracteres do base64 para diagnostico

### 2. Log da resposta de download

Antes de tentar decodificar, logar as chaves e o tamanho do campo base64 retornado pelo WuzAPI para facilitar diagnostico futuro.

### 3. Fallback direto via URL do payload

O payload do audioMessage e imageMessage ja contem o campo `URL` com link direto do CDN do WhatsApp. Atualmente o fallback CDN e bloqueado para URLs com `.enc` ou `/v/t62.` (que sao criptografadas). Porem, para **imagem**, a URL e descriptografada e funcional. Ajustar a logica para:
- Permitir fallback CDN para imagens (URLs sem `.enc`)
- Manter bloqueio apenas para URLs claramente criptografadas

### 4. Endpoint para reprocessar midias antigas

Adicionar uma nova action `reprocess-media` no `whatsapp-api/index.ts` que:
- Busca mensagens com `media_url IS NULL` e `message_type IN ('audio', 'image', 'video', 'document')`
- Para cada uma, tenta re-baixar via WuzAPI usando o `wuzapi_message_id`
- Atualiza o `media_url` no banco se conseguir
- Pode ser limitada por phone ou quantidade

### 5. Botao na UI para reprocessar

Adicionar um botao discreto no header da conversa para "Reprocessar midias" que chama a action acima.

## Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/whatsapp-webhook/index.ts` | Base64 robusto + log diagnostico + fallback CDN melhorado |
| `supabase/functions/whatsapp-api/index.ts` | Nova action `reprocess-media` |
| `src/components/whatsapp/WhatsAppMessageList.tsx` | Botao reprocessar midias |

## Detalhes tecnicos

**Funcao de decodificacao segura:**
```typescript
function safeBase64Decode(input: string): Uint8Array | null {
  try {
    let clean = input.replace(/^data:[^,]+,/, "").replace(/\s/g, "");
    const binaryStr = atob(clean);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    return bytes;
  } catch (e) {
    console.log("safeBase64Decode failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
}
```

**Reprocess action:** Busca ate 20 mensagens sem media_url, tenta download via WuzAPI com MessageID, e faz update no banco.

