

## Documentação Técnica: Integração WhatsApp via WuzAPI

### Objetivo
Criar um arquivo de documentação completo (`docs/WHATSAPP_WUZAPI_INTEGRATION.md`) que sirva como referência para replicar a integração WhatsApp/WuzAPI em futuros projetos, cobrindo todos os aspectos: arquitetura, envio/recebimento de mídia, eventos em tempo real e configurações.

### Arquivo a criar

**`docs/WHATSAPP_WUZAPI_INTEGRATION.md`** -- documento markdown (~3000 linhas) cobrindo:

1. **Visão Geral da Arquitetura**
   - 2 Edge Functions: `whatsapp-api` (proxy de ações) e `whatsapp-webhook` (receptor de eventos)
   - Tabelas: `whatsapp_instances`, `whatsapp_messages`, `whatsapp_instance_access`, `whatsapp_quick_replies`
   - Storage bucket: `whatsapp-media` (público)
   - Realtime: publicação `whatsapp_messages` + broadcast canal `whatsapp-typing`

2. **Secrets necessários**
   - `WUZAPI_URL`, `WUZAPI_ADMIN_TOKEN`, `WUZAPI_SECRET_KEY`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (automáticos)
   - `LOVABLE_API_KEY` (para transcrição de áudio)

3. **Gerenciamento de Instâncias**
   - Fluxo `create-instance`: criar usuário remoto na WuzAPI, salvar token/userId, auto-configurar webhook
   - `connect`: Subscribe em eventos `["Message", "Receipt", "ReadReceipt", "ChatPresence", "Connected", "Disconnected"]`
   - `get-qr`: obter QR code para autenticação
   - `check-status` / `syncInstanceState`: sincronizar estado connected/disconnected
   - `resolveInstanceAuth`: reconciliação automática de token/userId com lista remota
   - `ensureConnected`: auto-reconexão antes de cada envio

4. **Envio de Mensagens (whatsapp-api)**
   - `send-text`: `POST /chat/send/text` com `{ Phone, Body }`
   - `send-audio`: `POST /chat/send/audio` com `{ Phone, Audio (data URI obrigatório), PTT: true, MimeType }`
   - `send-image`: `POST /chat/send/image` com `{ Phone, Image (data URI), Caption }`
   - `send-video`: `POST /chat/send/video` com `{ Phone, Video (base64 sem prefixo), Caption }`
   - `send-document`: `POST /chat/send/document` com `{ Phone, Document (base64), FileName, Caption }`
   - Padrão comum: formatar telefone (55+), capturar `wuzapi_message_id`, salvar no banco, upload mídia enviada ao Storage
   - Retry automático em falha de texto (1x com 3s delay)

5. **Recebimento de Mensagens (whatsapp-webhook)**
   - Parser: `body.type` → eventType, `body.event` → eventData, `body.userID` → instância
   - Detecção de tipo: `imageMessage`, `audioMessage`, `videoMessage`, `documentMessage`, `stickerMessage`, `reactionMessage`
   - Extração de conteúdo: `conversation`, `extendedTextMessage.text`, captions
   - Download de mídia (3 fallbacks):
     1. Base64 embutido no payload (`Data`/`Media`)
     2. Endpoint WuzAPI (`/chat/downloadimage`, `/chat/downloadaudio`, etc.) com metadados completos
     3. CDN direto (`mmg.whatsapp.net`) para mídias não-encriptadas
   - `safeBase64Decode`: regex `/^data:[^,]+,/` para remover prefixo Data URI
   - Vinculação automática com `leads` por telefone (busca fuzzy últimos 8 dígitos)

6. **Eventos em Tempo Real**
   - `Receipt`/`ReadReceipt` → atualiza `status` para "delivered"/"read" via `wuzapi_message_id`
   - `ChatPresence` → broadcast Supabase Realtime no canal `whatsapp-typing` (composing/paused)
   - `Connected`/`Disconnected` → atualiza `whatsapp_instances.status`
   - Frontend: `supabase.channel('whatsapp-typing').on('broadcast', ...)` com timeout de 5s
   - Realtime PostgreSQL: `ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages`

7. **Ações Especiais**
   - `revoke-message`: `POST /chat/revokemessage` com `{ Phone, MessageID }`
   - `reprocess-media`: reprocessamento em lote de mídias sem URL (até 50 msgs)
   - `check-webhook`: verificação e reconfiguração automática do webhook URL
   - Transcrição de áudio: Edge Function `transcribe-audio` via Lovable AI (Gemini 2.5 Flash)

8. **Frontend: Padrões de Implementação**
   - Chat input com gravação de áudio (MediaRecorder, OGG/Opus)
   - Upload de arquivos via FileReader → base64 → Edge Function
   - Respostas rápidas com variáveis `{nome}`, `{nome_completo}`, `{curso}`
   - Context menu (responder, copiar, excluir)
   - Emoji picker com `@emoji-mart`
   - WaveSurfer.js para waveform de áudio
   - URL state: `/whatsapp/:phone`

9. **config.toml**
   - `verify_jwt = false` para `whatsapp-api` e `whatsapp-webhook`

10. **Checklist de Implementação**
    - Lista passo-a-passo para replicar em novo projeto

### Escopo
Um único arquivo markdown. Nenhuma alteração em código existente.

