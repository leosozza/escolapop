

# Plano: Suporte a Áudio e Arquivos no WhatsApp

## O que será feito

Adicionar envio e recebimento de áudio e arquivos na interface do WhatsApp, tanto no frontend (input e lista de mensagens) quanto no backend (edge functions).

## Mudanças

### 1. Frontend — `WhatsAppChatInput.tsx`
- Adicionar botão de **gravar áudio** (microfone) usando `MediaRecorder` API do navegador
- Adicionar botão de **anexar arquivo** (clip) com `<input type="file">` oculto
- Ao gravar áudio: converter para base64, enviar via action `send-audio`
- Ao anexar arquivo: converter para base64, enviar via action `send-document` (já existe) ou `send-image`/`send-audio` conforme tipo MIME
- UI: botão de microfone à esquerda do send, botão de clip ao lado; durante gravação, mostrar indicador vermelho com timer e botão de cancelar/enviar

### 2. Frontend — `WhatsAppMessageList.tsx`
- Renderizar mensagens de tipo `audio` com player `<audio>` inline (controles nativos)
- Renderizar mensagens de tipo `image` com `<img>` clicável
- Renderizar mensagens de tipo `document` com ícone de arquivo e link para download
- Renderizar mensagens de tipo `video` com player `<video>` inline
- Usar `media_url` da mensagem para o src

### 3. Backend — `whatsapp-api/index.ts`
- Adicionar action `send-audio`: enviar áudio via WuzAPI endpoint `/chat/send/audio` com `Audio` (base64 ou URL)
- Adicionar action `send-image`: enviar imagem via `/chat/send/image` com `Image` (base64 ou URL)
- Salvar mensagens com `message_type` correto e `media_url`

### 4. Backend — `whatsapp-webhook/index.ts`
- No handler de mensagens inbound, quando `message.audioMessage`, `message.imageMessage`, `message.documentMessage` ou `message.videoMessage` estiver presente:
  - Extrair `media_url` se disponível no payload (WuzAPI pode incluir URL de download)
  - Salvar `message_type` correto (`audio`, `image`, `document`, `video`)
  - Salvar `media_url` no registro

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `src/components/whatsapp/WhatsAppChatInput.tsx` | Adicionar gravação de áudio e upload de arquivo |
| `src/components/whatsapp/WhatsAppMessageList.tsx` | Renderizar áudio, imagem, documento e vídeo |
| `supabase/functions/whatsapp-api/index.ts` | Adicionar actions `send-audio` e `send-image` |
| `supabase/functions/whatsapp-webhook/index.ts` | Extrair e salvar media_url de mensagens recebidas |

## Detalhes técnicos

**Gravação de áudio:**
- Usar `navigator.mediaDevices.getUserMedia({ audio: true })` + `MediaRecorder`
- Formato: `audio/ogg; codecs=opus` (compatível com WhatsApp)
- Converter blob para base64 para enviar na edge function

**WuzAPI endpoints:**
- `/chat/send/audio` — `{ Phone, Audio }` (base64 com prefixo data URI)
- `/chat/send/image` — `{ Phone, Image, Caption }` (base64 ou URL)
- `/chat/send/document` — já implementado

**Upload de arquivo no input:**
- Aceitar: `image/*`, `audio/*`, `video/*`, `.pdf,.doc,.docx,.xls,.xlsx`
- Limite: 16MB (limite do WhatsApp)
- Converter para base64 antes de enviar

