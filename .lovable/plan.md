

# Analise Completa: WuzAPI vs Implementacao Atual

## Status da Compatibilidade

Analisei a documentacao completa da API em `https://wazapi.ybrasil.com.br/api/spec.yml` e comparei com a implementacao atual nos arquivos `whatsapp-api/index.ts`, `whatsapp-webhook/index.ts`, `WhatsAppChatInput.tsx` e `WhatsAppMessageList.tsx`.

---

## O que ja esta implementado e compativel

| Funcionalidade | Enviar | Receber | Renderizar |
|---|---|---|---|
| Texto | OK | OK | OK |
| Imagem | OK | OK | OK |
| Audio | OK | OK | OK (WaveSurfer) |
| Video | OK | OK | OK |
| Documento | OK | OK | OK |
| Reacoes | - | OK | OK |
| Status de entrega | - | OK | OK |
| Typing indicator | - | OK | - |

---

## Problemas encontrados e melhorias necessarias

### 1. Envio de audio: falta `PTT: true`
A API exige `PTT: true` para que o audio apareca como mensagem de voz (bolinha verde) no WhatsApp. Sem isso, o audio chega como arquivo anexo. O campo `MimeType` tambem deve ser enviado explicitamente.

**Correcao**: No `send-audio` do edge function, adicionar `PTT: true` e `MimeType: "audio/ogg; codecs=opus"` ao body.

### 2. Download de midia: campo `Data` vs `Media`
A spec da API retorna o base64 no campo `data.Data` (nao `data.Media`). O webhook atual busca `data.Media` como campo principal. Isso pode causar falha no download de midias recebidas.

**Correcao**: No webhook, verificar `data.Data || data.Media` em vez de apenas `data.Media`.

### 3. Transcrição de audio
A WuzAPI nao oferece transcrição de audio nativa. Para transcrever, precisamos usar um modelo de IA (Lovable AI com Gemini ou GPT) que aceite audio/base64 como input.

**Plano**:
- Adicionar botao "Transcrever" nos baloes de audio recebido
- Ao clicar, baixar o audio do storage, enviar para uma edge function que usa Lovable AI (Gemini 2.5 Flash suporta audio) para transcrever
- Exibir a transcrição inline abaixo do player de audio

### 4. Sticker recebido nao tratado
O webhook nao detecta `stickerMessage`. Stickers recebidos caem como `[sem conteudo]`.

**Correcao**: Adicionar detecao de `message.stickerMessage` no webhook e tratar como imagem.

### 5. Envio de audio: upload para storage apos envio
Quando o usuario envia audio gravado, o `media_url` fica `null` no banco. O audio e enviado como base64 mas nao e salvo no storage para reprodução posterior.

**Correcao**: Apos enviar audio/imagem/video/documento com sucesso, fazer upload do base64 para o bucket `whatsapp-media` e salvar a URL no registro da mensagem.

---

## Implementacao

### Arquivo: `supabase/functions/whatsapp-api/index.ts`

**send-audio** (linhas ~558-591):
- Adicionar `PTT: true` e `MimeType: "audio/ogg; codecs=opus"` no body enviado para `/chat/send/audio`
- Apos envio com sucesso, decodificar o base64, fazer upload para `whatsapp-media` storage, e atualizar o registro com `media_url`

**send-image, send-video, send-document**:
- Mesma logica: apos envio com sucesso, fazer upload do base64 para storage e salvar `media_url` no registro

### Arquivo: `supabase/functions/whatsapp-webhook/index.ts`

**Download de midia** (linhas ~222-256):
- Trocar `downloadData?.data?.Media` por `downloadData?.data?.Data || downloadData?.data?.Media` para compatibilidade com o campo correto da spec

**Sticker** (apos linha ~162):
- Adicionar `const isSticker = !!message.stickerMessage` na detecao de tipo de midia
- Tratar como `image` para download e renderização

### Nova Edge Function: `supabase/functions/transcribe-audio/index.ts`
- Recebe `audioUrl` (URL publica do storage)
- Baixa o audio, converte para base64
- Envia para Lovable AI (Gemini 2.5 Flash) com prompt de transcrição
- Retorna o texto transcrito

### Arquivo: `src/components/whatsapp/WhatsAppMessageList.tsx`
- No bloco de audio com `hasValidMedia`, adicionar botao "Transcrever"
- Ao clicar, chamar a edge function `transcribe-audio`
- Exibir texto da transcrição abaixo do player

---

## Resumo das mudancas

| Arquivo | Acao |
|---|---|
| `supabase/functions/whatsapp-api/index.ts` | PTT:true no audio + upload para storage apos envio de midias |
| `supabase/functions/whatsapp-webhook/index.ts` | Corrigir campo Data vs Media + suporte a sticker |
| `supabase/functions/transcribe-audio/index.ts` | Nova edge function para transcrição via AI |
| `src/components/whatsapp/WhatsAppMessageList.tsx` | Botao transcrever em audios + exibicao da transcrição |

