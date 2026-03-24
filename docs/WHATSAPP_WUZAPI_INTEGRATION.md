# Integração WhatsApp via WuzAPI — Documentação Técnica Completa

> **Versão:** 1.0 — Março 2026  
> **Objetivo:** Referência completa para replicar a integração WhatsApp/WuzAPI em novos projetos Lovable Cloud (Supabase).

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Secrets Necessários](#2-secrets-necessários)
3. [Banco de Dados](#3-banco-de-dados)
4. [Storage](#4-storage)
5. [Gerenciamento de Instâncias](#5-gerenciamento-de-instâncias)
6. [Envio de Mensagens (whatsapp-api)](#6-envio-de-mensagens-whatsapp-api)
7. [Recebimento de Mensagens (whatsapp-webhook)](#7-recebimento-de-mensagens-whatsapp-webhook)
8. [Eventos em Tempo Real](#8-eventos-em-tempo-real)
9. [Ações Especiais](#9-ações-especiais)
10. [Transcrição de Áudio](#10-transcrição-de-áudio)
11. [Frontend: Padrões de Implementação](#11-frontend-padrões-de-implementação)
12. [config.toml](#12-configtoml)
13. [Checklist de Implementação](#13-checklist-de-implementação)

---

## 1. Visão Geral da Arquitetura

```
┌──────────────┐    HTTPS     ┌─────────────────┐    HTTPS     ┌──────────┐
│   Frontend   │ ──────────── │  whatsapp-api    │ ──────────── │  WuzAPI  │
│   (React)    │              │  (Edge Function) │              │  Server  │
└──────┬───────┘              └────────┬─────────┘              └────┬─────┘
       │                               │                             │
       │  Realtime                     │  Service Role               │ Webhook
       │  (postgres_changes           │                             │ POST
       │   + broadcast)               ▼                             ▼
       │                     ┌─────────────────┐           ┌─────────────────┐
       └──────────────────── │   Supabase DB   │ ◄──────── │ whatsapp-webhook│
                             │  + Storage      │           │ (Edge Function) │
                             └─────────────────┘           └─────────────────┘
```

### Componentes

| Componente | Função |
|---|---|
| **`whatsapp-api`** | Edge Function proxy — recebe ações do frontend (enviar msg, criar instância, etc.) e repassa para a WuzAPI |
| **`whatsapp-webhook`** | Edge Function receptor — recebe eventos da WuzAPI (mensagens, receipts, presença) e salva no banco |
| **`transcribe-audio`** | Edge Function de transcrição — baixa áudio do Storage e transcreve via Lovable AI (Gemini 2.5 Flash) |

### Tabelas Principais

| Tabela | Descrição |
|---|---|
| `whatsapp_instances` | Instâncias WhatsApp (cada número conectado) |
| `whatsapp_messages` | Todas as mensagens (inbound + outbound) |
| `whatsapp_instance_access` | Permissões de acesso por usuário/instância |
| `whatsapp_quick_replies` | Respostas rápidas reutilizáveis |

### Storage Bucket

- **Nome:** `whatsapp-media`
- **Público:** Sim
- **Uso:** Armazena todas as mídias (áudios, imagens, vídeos, documentos) tanto recebidas quanto enviadas

### Realtime

- **Postgres Changes:** `whatsapp_messages` publicada via `ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages`
- **Broadcast:** Canal `whatsapp-typing` para indicadores de digitação

---

## 2. Secrets Necessários

| Secret | Descrição | Obrigatório |
|---|---|---|
| `WUZAPI_URL` | URL base do servidor WuzAPI (ex: `https://wuzapi.example.com`) | ✅ |
| `WUZAPI_ADMIN_TOKEN` | Token admin para gerenciar usuários na WuzAPI | ✅ |
| `WUZAPI_SECRET_KEY` | Chave secreta para operações sensíveis | ✅ |
| `LOVABLE_API_KEY` | Chave para Lovable AI Gateway (transcrição de áudio) | Para transcrição |
| `SUPABASE_URL` | URL do projeto Supabase (automático) | Automático |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (automático) | Automático |

> **Nota:** `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são automaticamente disponibilizados em Edge Functions.

---

## 3. Banco de Dados

### 3.1. Tabela `whatsapp_instances`

```sql
CREATE TABLE whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  wuzapi_user_id text,          -- ID do usuário remoto na WuzAPI
  wuzapi_token text,            -- Token para autenticação na WuzAPI
  connection_type text NOT NULL DEFAULT 'qrcode',  -- 'qrcode' ou 'oficial'
  status text NOT NULL DEFAULT 'disconnected',     -- disconnected, connecting, waiting_qr, connected
  phone_number text,            -- Número do WhatsApp conectado
  qr_code text,                 -- QR code atual (base64)
  last_error text,
  last_check_at timestamptz DEFAULT now(),
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: Admins/gestores gerenciam, staff visualiza
```

### 3.2. Tabela `whatsapp_messages`

```sql
CREATE TABLE whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  lead_id uuid,                           -- FK opcional para leads
  direction text NOT NULL DEFAULT 'outbound',  -- 'inbound' ou 'outbound'
  message_type text NOT NULL DEFAULT 'text',   -- text, audio, image, video, document, reaction
  content text,                           -- Texto da mensagem
  media_url text,                         -- URL do Storage para mídias
  wuzapi_message_id text,                 -- ID da mensagem na WuzAPI (para tracking)
  status text DEFAULT 'sent',             -- sent, delivered, read, failed, received
  error_message text,
  instance_id uuid,
  reaction_to_id text,                    -- wuzapi_message_id da msg reagida
  created_at timestamptz DEFAULT now()
);

-- Realtime habilitado:
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
```

### 3.3. Tabela `whatsapp_instance_access`

```sql
CREATE TABLE whatsapp_instance_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL,    -- FK para whatsapp_instances
  user_id uuid NOT NULL,        -- FK para auth.users
  created_at timestamptz DEFAULT now()
);

-- RLS: Admins/gestores gerenciam, staff visualiza próprio acesso
```

### 3.4. Tabela `whatsapp_quick_replies`

```sql
CREATE TABLE whatsapp_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  shortcut text NOT NULL,       -- Atalho após "/" (ex: "ola" → "/ola")
  created_at timestamptz DEFAULT now()
);
```

---

## 4. Storage

### Criar o bucket

```sql
-- Via Supabase Dashboard ou migration
INSERT INTO storage.buckets (id, name, public) VALUES ('whatsapp-media', 'whatsapp-media', true);
```

### Estrutura de arquivos

```
whatsapp-media/
  {instance_id}/
    {wuzapi_message_id}.ogg       ← Áudio recebido
    {wuzapi_message_id}.jpg       ← Imagem recebida
    {wuzapi_message_id}.mp4       ← Vídeo recebido
    {wuzapi_message_id}.pdf       ← Documento recebido
    sent_{timestamp}.ogg          ← Áudio enviado
    sent_{timestamp}.jpg          ← Imagem enviada
    sent_{timestamp}.mp4          ← Vídeo enviado
```

### Política de acesso

```sql
-- Permitir leitura pública (bucket público)
-- Upload via service role key (Edge Functions)
```

---

## 5. Gerenciamento de Instâncias

### 5.1. Criar Instância (`create-instance`)

**Fluxo completo:**

1. Gerar token aleatório: `crypto.randomUUID().replace(/-/g, "")`
2. Criar usuário remoto na WuzAPI: `POST /admin/users` com `{ name, token }`
3. Confirmar criação listando usuários: `GET /admin/users` e buscar pelo token
4. Salvar instância no banco com `wuzapi_user_id` e `wuzapi_token`
5. Auto-configurar webhook: `POST /webhook` com URL e eventos

```typescript
// Código simplificado
const createRemoteUser = async (name: string) => {
  const requestedToken = crypto.randomUUID().replace(/-/g, "");
  
  // 1. Criar usuário
  await adminFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify({ name, token: requestedToken }),
  });
  
  // 2. Confirmar listando (a resposta do POST pode não retornar o user completo)
  const listRes = await adminFetch("/admin/users", { method: "GET" });
  const remoteUser = listRes.data.data.find(u => u.token === requestedToken);
  
  return { token: remoteUser.token, user: { id: remoteUser.id, name, phone_number: remoteUser.jid } };
};

// 3. Auto-configurar webhook
const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
await instanceFetch(token, "/webhook", {
  method: "POST",
  body: JSON.stringify({
    webhookURL: webhookUrl,
    events: ["Message", "Receipt", "ReadReceipt", "ChatPresence", "Connected", "Disconnected"],
  }),
});
```

### 5.2. Conectar Instância (`connect`)

```typescript
await instanceFetch(token, "/session/connect", {
  method: "POST",
  body: JSON.stringify({
    Subscribe: ["Message", "Receipt", "ReadReceipt", "ChatPresence", "Connected", "Disconnected"],
    Immediate: true,
  }),
});

// Tratar "already connected" como sucesso
const alreadyConnected = res.data?.error === "already connected" || res.data?.error === "already logged in";
```

### 5.3. Obter QR Code (`get-qr`)

```typescript
// 1. Verificar se já está conectado
const statusCheck = await instanceFetch(token, "/session/status", { method: "GET" });
if (statusInfo.connected && statusInfo.loggedIn) {
  return { alreadyConnected: true };
}

// 2. Obter QR
const res = await instanceFetch(token, "/session/qr", { method: "GET" });
const qrCode = res.data?.data?.QRCode || res.data?.data?.qrcode || null;

// 3. Salvar no banco
await updateInstance(instanceId, { qr_code: qrCode, status: "waiting_qr" });
```

### 5.4. Verificar Status (`check-status`)

```typescript
const res = await instanceFetch(token, "/session/status", { method: "GET" });
const { connected, loggedIn, jid } = readStatus(res.data?.data);
// connected + loggedIn = "connected"
// connected + !loggedIn = "waiting_qr"
// !connected = "disconnected"
```

### 5.5. Reconciliação Automática (`resolveInstanceAuth`)

Antes de qualquer operação com uma instância, o sistema reconcilia os dados locais com a WuzAPI:

```typescript
const resolveInstanceAuth = async (instanceId: string) => {
  const instance = await getInstanceRecord(instanceId);
  
  // Listar usuários remotos
  const listRes = await adminFetch("/admin/users", { method: "GET" });
  
  // Tentar match por: token → userId → nome único
  const remoteUser = matchRemoteUser(remoteUsers, instance.name, instance.wuzapi_token, instance.wuzapi_user_id);
  
  if (remoteUser) {
    // Atualizar token/userId/phone se mudaram
    await updateInstance(instanceId, { wuzapi_token: remoteUser.token, wuzapi_user_id: remoteUser.id });
    return updatedInstance;
  }
  
  // Se não encontrou, criar novo usuário remoto
  const created = await createRemoteUser(instance.name, instance.wuzapi_token);
  return updatedInstance;
};
```

### 5.6. Auto-reconexão (`ensureConnected`)

Chamado automaticamente antes de cada envio de mensagem:

```typescript
const ensureConnected = async (instanceId: string, token: string): Promise<boolean> => {
  // 1. Verificar status atual
  const statusRes = await instanceFetch(token, "/session/status", { method: "GET" });
  if (connected && loggedIn) return true;
  
  // 2. Tentar reconectar
  const connectRes = await instanceFetch(token, "/session/connect", {
    method: "POST",
    body: JSON.stringify({
      Subscribe: ["Message", "Receipt", "ReadReceipt", "ChatPresence", "Connected", "Disconnected"],
      Immediate: true,
    }),
  });
  
  // "already connected" = sucesso
  return connectRes.ok || connectRes.data?.error === "already connected";
};
```

### 5.7. Deletar Instância (`delete-instance`)

```typescript
// 1. Desconectar sessão
await instanceFetch(token, "/session/logout", { method: "POST" });

// 2. Deletar usuário remoto (com dados)
await adminFetch(`/admin/users/${wuzapi_user_id}/full`, { method: "DELETE" });

// 3. Deletar do banco local
await supabase.from("whatsapp_instances").delete().eq("id", instanceId);
```

---

## 6. Envio de Mensagens (whatsapp-api)

### Padrão Comum

Todas as ações de envio seguem este fluxo:

1. **Resolver instância:** `resolveInstanceAuth(instanceId)`
2. **Garantir conexão:** `ensureConnected(instanceId, token)`
3. **Formatar telefone:** Remover não-numéricos, garantir prefixo `55`
4. **Enviar via WuzAPI:** `POST /chat/send/{type}`
5. **Capturar ID:** `res.data?.data?.MessageID || res.data?.data?.Id`
6. **Salvar no banco:** Insert em `whatsapp_messages`
7. **Upload de mídia enviada:** Salvar no Storage para reprodução posterior

```typescript
// Formatação de telefone (usado em todos os envios)
const formattedPhone = phone.replace(/\D/g, "");
const phoneNumber = formattedPhone.startsWith("55") ? formattedPhone : `55${formattedPhone}`;
```

### 6.1. Enviar Texto (`send-text`)

```typescript
// WuzAPI endpoint
POST /chat/send/text
Headers: { "Content-Type": "application/json", "token": instanceToken }
Body: { "Phone": "5511999999999", "Body": "Olá, tudo bem?" }

// Response
{ "data": { "MessageID": "3EB0..." } }
```

**Retry automático:** Se falhar, aguarda 3s e tenta novamente 1x.

```typescript
if (!res.ok) {
  await new Promise((r) => setTimeout(r, 3000));
  const retry = await instanceFetch(token, "/chat/send/text", { ... });
  if (retry.ok) {
    // Atualizar status da msg no banco para "sent"
  }
}
```

### 6.2. Enviar Áudio (`send-audio`)

**⚠️ CRÍTICO:** A WuzAPI exige que o campo `Audio` comece com prefixo `data:audio/`. Sem isso, retorna erro 400.

```typescript
// Garantir prefixo data URI
const audioWithPrefix = audio.startsWith("data:")
  ? audio
  : `data:audio/ogg;codecs=opus;base64,${audio}`;

// WuzAPI endpoint
POST /chat/send/audio
Body: {
  "Phone": "5511999999999",
  "Audio": "data:audio/ogg;codecs=opus;base64,T2dnUw...",  // Data URI obrigatório!
  "PTT": true,                    // Push-to-talk (mensagem de voz nativa)
  "MimeType": "audio/ogg; codecs=opus"
}
```

**Upload do áudio enviado ao Storage:**

```typescript
const audioBase64 = audio.replace(/^data:[^,]+,/, "");
const bytes = base64ToUint8Array(audioBase64);
const storagePath = `${instanceId}/sent_${Date.now()}.ogg`;
await supabase.storage.from("whatsapp-media").upload(storagePath, bytes, {
  contentType: "audio/ogg",
  upsert: true,
});
const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(storagePath);
// Salvar urlData.publicUrl em whatsapp_messages.media_url
```

### 6.3. Enviar Imagem (`send-image`)

```typescript
// Garantir prefixo data URI
const imageWithPrefix = image.startsWith("data:") ? image : `data:image/png;base64,${image}`;

POST /chat/send/image
Body: {
  "Phone": "5511999999999",
  "Image": "data:image/jpeg;base64,/9j/4AAQ...",  // Data URI
  "Caption": "Legenda opcional"
}
```

### 6.4. Enviar Vídeo (`send-video`)

```typescript
// ⚠️ Vídeo usa base64 SEM prefixo data URI (diferente de áudio e imagem!)
const vidBase64Clean = video.replace(/^data:[^,]+,/, "");

POST /chat/send/video
Body: {
  "Phone": "5511999999999",
  "Video": "AAAAIGZ0eXBpc29t...",  // Base64 puro, SEM data URI
  "Caption": "Legenda opcional"
}
```

### 6.5. Enviar Documento (`send-document`)

```typescript
const docBase64Clean = document.replace(/^data:[^,]+,/, "");

POST /chat/send/document
Body: {
  "Phone": "5511999999999",
  "Document": "JVBERi0xLjQ...",   // Base64 puro
  "FileName": "contrato.pdf",
  "Caption": "Segue o documento"
}
```

### 6.6. Revogar Mensagem (`revoke-message`)

```typescript
POST /chat/revokemessage
Body: {
  "Phone": "5511999999999",
  "MessageID": "3EB0..."          // wuzapi_message_id
}
```

---

## 7. Recebimento de Mensagens (whatsapp-webhook)

### 7.1. Estrutura do Payload

A WuzAPI envia webhooks com esta estrutura:

```json
{
  "type": "Message",
  "instanceName": "minha-instancia",
  "userID": "1",
  "event": {
    "Info": {
      "ID": "3EB0...",
      "IsFromMe": false,
      "IsGroup": false,
      "Sender": "5511999999999@s.whatsapp.net",
      "SenderAlt": "5511999999999",
      "Chat": "5511999999999@s.whatsapp.net",
      "PushName": "João"
    },
    "Message": {
      "conversation": "Olá!"
    }
  }
}
```

### 7.2. Parser do Webhook

```typescript
const eventType = typeof body.type === "string" ? body.type : (typeof body.event === "string" ? body.event : null);
const eventData = (typeof body.event === "object" && body.event !== null) ? body.event : body.data || body;
const instanceName = body.instanceName || "";
const userID = body.userID || "";
```

### 7.3. Resolução de Instância

Ordem de prioridade:
1. `body.userID` → match com `whatsapp_instances.wuzapi_user_id`
2. `body.instanceName` → match com `whatsapp_instances.name` (case insensitive)
3. Fallback → primeira instância com `status = 'connected'`

```typescript
const findInstance = async () => {
  if (userID) {
    const { data } = await supabase.from("whatsapp_instances")
      .select("id, wuzapi_token").eq("wuzapi_user_id", userID).maybeSingle();
    if (data) return data;
  }
  if (instanceName) {
    const { data } = await supabase.from("whatsapp_instances")
      .select("id, wuzapi_token").ilike("name", instanceName).maybeSingle();
    if (data) return data;
  }
  // Fallback: qualquer instância conectada
  const { data } = await supabase.from("whatsapp_instances")
    .select("id, wuzapi_token").eq("status", "connected").limit(1).maybeSingle();
  return data || null;
};
```

### 7.4. Extração de Telefone

```typescript
function extractPhone(jidOrAlt: string): string {
  if (!jidOrAlt) return "";
  const cleaned = jidOrAlt.replace(/@.*$/, "").replace(/[.:].*$/, "");
  return /^\d{8,}$/.test(cleaned) ? cleaned : "";
}

// Para mensagens recebidas (IsFromMe = false):
phone = extractPhone(info.SenderAlt) || extractPhone(info.Sender);

// Para mensagens enviadas (IsFromMe = true):
phone = extractPhone(info.RecipientAlt) || extractPhone(info.Chat);
```

### 7.5. Detecção de Tipo de Mensagem

```typescript
const message = eventData.Message || eventData.RawMessage || {};

const isImage = !!message.imageMessage;
const isSticker = !!message.stickerMessage;
const isAudio = !!message.audioMessage;
const isVideo = !!message.videoMessage;
const isDocument = !!message.documentMessage;
const hasMedia = isImage || isSticker || isAudio || isVideo || isDocument;

// Tipo para salvar no banco
const messageType = (isImage || isSticker) ? "image"
  : isDocument ? "document"
  : isAudio ? "audio"
  : isVideo ? "video"
  : "text";
```

### 7.6. Extração de Conteúdo de Texto

```typescript
const content =
  message.conversation ||                    // Mensagem simples
  message.extendedTextMessage?.text ||        // Mensagem com menção/link
  message.imageMessage?.caption ||            // Legenda de imagem
  message.documentMessage?.title ||           // Título de documento
  message.videoMessage?.caption ||            // Legenda de vídeo
  (isSticker ? "🏷️ Sticker" : null) ||
  (hasMedia ? "[Mídia recebida]" : "[sem conteúdo]");
```

### 7.7. Reações

```typescript
if (message.reactionMessage) {
  const emoji = message.reactionMessage.text || "";
  const originalMsgId = message.reactionMessage.key?.id || "";
  
  // Buscar lead_id da mensagem original
  const { data: origMsg } = await supabase.from("whatsapp_messages")
    .select("lead_id").eq("wuzapi_message_id", originalMsgId).maybeSingle();
  
  await supabase.from("whatsapp_messages").insert({
    phone,
    content: emoji,
    direction: "inbound",
    message_type: "reaction",
    reaction_to_id: originalMsgId,  // Vincula à mensagem original
    status: "received",
    instance_id: instanceId,
    lead_id: origMsg?.lead_id || null,
  });
  
  return okResponse();  // Não processar mais nada
}
```

### 7.8. Download de Mídia — 3 Fallbacks

#### Fallback 1: Base64 Embutido no Payload

Algumas versões da WuzAPI incluem a mídia diretamente no webhook:

```typescript
const embeddedBase64 = mediaMessage?.Data || mediaMessage?.Media
  || eventData?.Data || eventData?.Media || null;

if (embeddedBase64 && typeof embeddedBase64 === "string" && embeddedBase64.length > 100) {
  const bytes = safeBase64Decode(embeddedBase64);
  const storagePath = `${instanceId}/${msgId}.${ext}`;
  await supabase.storage.from("whatsapp-media").upload(storagePath, bytes, {
    contentType: mimetype, upsert: true,
  });
  const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(storagePath);
  mediaUrl = urlData?.publicUrl;
}
```

#### Fallback 2: Download via WuzAPI Endpoint

```typescript
const endpointMap = {
  image: "/chat/downloadimage",
  audio: "/chat/downloadaudio",
  video: "/chat/downloadvideo",
  document: "/chat/downloaddocument",
  sticker: "/chat/downloadsticker",
};

// Metadados necessários para descriptografia
const mediaFields = {
  Url: mediaMessage?.url || "",
  MediaKey: mediaMessage?.mediaKey || "",
  Mimetype: mediaMessage?.mimetype || "application/octet-stream",
  FileSHA256: mediaMessage?.fileSha256 || "",
  FileEncSHA256: mediaMessage?.fileEncSha256 || "",
  FileLength: mediaMessage?.fileLength || 0,
  DirectPath: mediaMessage?.directPath || "",
};

const downloadResp = await fetch(fullUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json", "token": instanceToken },
  body: JSON.stringify({ MessageID: msgId, ...mediaFields }),
});

const downloadData = await downloadResp.json();
const base64Media = downloadData?.data?.Data || downloadData?.data?.Media || null;
```

#### Fallback 3: CDN Direto

Para mídias não-encriptadas, tentar download direto do CDN do WhatsApp:

```typescript
if (!mediaUrl) {
  const directUrl = mediaFields.Url || 
    (mediaFields.DirectPath ? `https://mmg.whatsapp.net${mediaFields.DirectPath}` : "");
  const looksEncrypted = /\.enc(?:$|\?)/i.test(directUrl);
  
  if (directUrl && !looksEncrypted) {
    const directResp = await fetch(directUrl);
    if (directResp.ok) {
      const blob = await directResp.arrayBuffer();
      const bytes = new Uint8Array(blob);
      if (bytes.length > 1024) {  // Validar tamanho mínimo
        await supabase.storage.from("whatsapp-media").upload(storagePath, bytes, ...);
      }
    }
  }
}
```

### 7.9. `safeBase64Decode`

Função robusta para decodificar base64 com tratamento de erros:

```typescript
function safeBase64Decode(input: string): Uint8Array | null {
  try {
    // Remover prefixo data URI e whitespace
    const clean = input.replace(/^data:[^,]+,/, "").replace(/\s/g, "");
    if (!clean || clean.length < 10) return null;
    
    const binaryStr = atob(clean);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    return null;
  }
}
```

**⚠️ Importante:** A regex `/^data:[^,]+,/` trata corretamente MIME types com ponto-e-vírgula como `data:audio/ogg; codecs=opus;base64,...`.

### 7.10. Vinculação Automática com Leads

```typescript
const cleanPhone = phone.replace(/^55/, "");
const lastDigits = cleanPhone.slice(-8);

const { data: lead } = await supabase.from("leads")
  .select("id")
  .or(`phone.eq.${phone},phone.eq.${cleanPhone},phone.like.%${lastDigits}%`)
  .limit(1)
  .maybeSingle();

// Salvar mensagem com lead_id vinculado
await supabase.from("whatsapp_messages").insert({
  phone,
  lead_id: lead?.id || null,
  // ...
});
```

### 7.11. Extensão de Arquivo por MIME Type

```typescript
function getExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/ogg; codecs=opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  return map[mime.toLowerCase()] || mime.split("/")[1]?.split(";")[0] || "bin";
}
```

---

## 8. Eventos em Tempo Real

### 8.1. Receipt / ReadReceipt

Atualiza status de entrega das mensagens enviadas:

```typescript
if (eventType === "ReadReceipt" || eventType === "Receipt") {
  const messageIds = eventData.MessageIDs || eventData.ids || (eventData.id ? [eventData.id] : []);
  const rawState = (body.state || eventData.Type || eventType).toLowerCase();
  const newStatus = (rawState === "read" || rawState === "played") ? "read" : "delivered";
  
  for (const msgId of messageIds) {
    await supabase.from("whatsapp_messages")
      .update({ status: newStatus })
      .eq("wuzapi_message_id", msgId);
  }
}
```

### 8.2. ChatPresence (Typing Indicator)

O webhook usa **Supabase Realtime Broadcast** (não postgres_changes) para enviar eventos de digitação:

```typescript
// WEBHOOK (Edge Function):
if (eventType === "ChatPresence") {
  const state = eventData.State || "";  // "composing" ou "paused"
  const presencePhone = extractPhone(eventData.Chat || eventData.JID || "");
  
  const channel = supabase.channel("whatsapp-typing");
  await channel.send({
    type: "broadcast",
    event: "typing",
    payload: { phone: presencePhone, state, instanceId: instanceId || "" },
  });
  supabase.removeChannel(channel);
}

// FRONTEND (React):
useEffect(() => {
  const channel = supabase
    .channel('whatsapp-typing-ui')
    .on('broadcast', { event: 'typing' }, (payload) => {
      const data = payload.payload;
      if (data.phone matches contact.phone) {
        if (data.state === 'composing') {
          setIsTyping(true);
          // Auto-limpar após 5 segundos
          setTimeout(() => setIsTyping(false), 5000);
        } else {
          setIsTyping(false);
        }
      }
    })
    .subscribe();
  
  return () => supabase.removeChannel(channel);
}, [contact.phone]);
```

### 8.3. Connected / Disconnected

```typescript
if (eventType === "Connected" || eventType === "Disconnected" ||
    eventType === "LoggedOut" || eventType === "Ready") {
  const isConnected = eventType === "Connected" || eventType === "Ready";
  const newStatus = isConnected ? "connected" : "disconnected";
  
  await supabase.from("whatsapp_instances").update({
    status: newStatus,
    last_error: isConnected ? null : eventType,
    updated_at: new Date().toISOString(),
  }).eq("id", instanceId);
}
```

### 8.4. Realtime no Frontend (postgres_changes)

```typescript
// Escutar novas mensagens e atualizações em tempo real
const channel = supabase
  .channel(`whatsapp-messages-${cleanPhone}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'whatsapp_messages',
  }, (payload) => {
    const newMsg = payload.new;
    // Verificar se pertence à conversa atual (match por telefone)
    if (matchesPhone(newMsg.phone, cleanPhone)) {
      setMessages(prev => [...prev, newMsg]);
    }
  })
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'whatsapp_messages',
  }, (payload) => {
    const updated = payload.new;
    setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
  })
  .on('postgres_changes', {
    event: 'DELETE',
    schema: 'public',
    table: 'whatsapp_messages',
  }, (payload) => {
    setMessages(prev => prev.filter(m => m.id !== payload.old.id));
  })
  .subscribe();
```

---

## 9. Ações Especiais

### 9.1. Verificar/Reconfigurar Webhook (`check-webhook`)

```typescript
// 1. Verificar configuração atual
const getRes = await instanceFetch(token, "/webhook", { method: "GET" });
const currentWebhook = getRes.data?.data?.webhook || "";

// 2. Comparar com URL esperada
const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
if (currentWebhook !== webhookUrl) {
  // 3. Reconfigurar
  await instanceFetch(token, "/webhook", {
    method: "POST",
    body: JSON.stringify({
      webhookURL: webhookUrl,
      events: ["Message", "Receipt", "ReadReceipt", "ChatPresence", "Connected", "Disconnected"],
    }),
  });
}
```

### 9.2. Reprocessar Mídias (`reprocess-media`)

Reprocessa em lote mensagens que falharam no download inicial:

```typescript
// 1. Buscar mensagens sem media_url
const { data: pendingMessages } = await supabase.from("whatsapp_messages")
  .select("id, phone, message_type, wuzapi_message_id, instance_id")
  .is("media_url", null)
  .in("message_type", ["audio", "image", "video", "document"])
  .not("wuzapi_message_id", "is", null)
  .order("created_at", { ascending: false })
  .limit(50);

// 2. Para cada mensagem, tentar download via WuzAPI
for (const msg of pendingMessages) {
  const dlRes = await instanceFetch(token, endpoint, {
    method: "POST",
    body: JSON.stringify({ MessageID: msg.wuzapi_message_id }),
  });
  // Decodificar, fazer upload, atualizar media_url
}
```

---

## 10. Transcrição de Áudio

### Edge Function `transcribe-audio`

Usa Lovable AI Gateway com modelo Gemini 2.5 Flash:

```typescript
// 1. Download do áudio do Storage
const audioResp = await fetch(audioUrl);
const audioBytes = new Uint8Array(await audioResp.arrayBuffer());

// 2. Converter para base64
let base64 = "";
const chunkSize = 8192;
for (let i = 0; i < audioBytes.length; i += chunkSize) {
  const chunk = audioBytes.subarray(i, i + chunkSize);
  base64 += String.fromCharCode(...chunk);
}
base64 = btoa(base64);

// 3. Chamar Lovable AI Gateway
const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [
      {
        role: "system",
        content: "Você é um transcritor de áudio. Transcreva o áudio fornecido para texto em português brasileiro. Retorne APENAS o texto transcrito.",
      },
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              data: base64,
              format: isOgg ? "ogg" : "mp3",
            },
          },
          { type: "text", text: "Transcreva este áudio para texto." },
        ],
      },
    ],
  }),
});

const transcription = aiData.choices?.[0]?.message?.content;
```

### Chamada do Frontend

```typescript
const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  },
  body: JSON.stringify({ audioUrl: msg.media_url }),
});
const data = await resp.json();
// data.transcription contém o texto
```

---

## 11. Frontend: Padrões de Implementação

### 11.1. Gravação de Áudio

```typescript
// Usar MediaRecorder com OGG/Opus (preferido) ou WebM/Opus (fallback)
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
    ? 'audio/ogg; codecs=opus'
    : 'audio/webm; codecs=opus',
});

// Coletar chunks
mediaRecorder.ondataavailable = (e) => {
  if (e.data.size > 0) chunks.push(e.data);
};

// Ao parar, criar blob e converter para base64
mediaRecorder.onstop = async () => {
  const blob = new Blob(chunks, { type: recorder.mimeType });
  const base64 = await blobToBase64(blob);
  // base64 será um data URI: "data:audio/ogg;codecs=opus;base64,T2dn..."
  
  await supabase.functions.invoke('whatsapp-api', {
    body: { action: 'send-audio', instanceId, phone, audio: base64, leadId },
  });
};
```

### 11.2. Upload de Arquivos

```typescript
// FileReader → base64 → Edge Function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Detectar tipo e chamar action correta
const isImage = file.type.startsWith('image/');
const isAudio = file.type.startsWith('audio/');
const isVideo = file.type.startsWith('video/');
const action = isImage ? 'send-image' : isAudio ? 'send-audio' : isVideo ? 'send-video' : 'send-document';
```

### 11.3. Respostas Rápidas

- Atalho: digitar `/` no campo de texto ativa popup de busca
- Variáveis suportadas: `{nome}`, `{nome_completo}`, `{curso}`
- Substituição automática com dados do lead selecionado

```typescript
const replaceVariables = (text: string) => {
  const firstName = leadName?.split(' ')[0] || '';
  return text
    .replace(/\{nome\}/g, firstName)
    .replace(/\{nome_completo\}/g, leadName || '')
    .replace(/\{curso\}/g, courseName || '');
};
```

### 11.4. Formatação de Texto (WhatsApp Markdown)

```typescript
// Botões de formatação aplicam marcadores do WhatsApp
wrapSelection('*', '*');   // *negrito*
wrapSelection('_', '_');   // _itálico_
wrapSelection('~', '~');   // ~tachado~
wrapSelection('```', '```'); // ```código```
```

### 11.5. Context Menu (Clique Direito)

- **Responder:** Mostra preview da mensagem acima do campo de input
- **Copiar:** `navigator.clipboard.writeText(text)`
- **Excluir para mim:** Remove do banco local (`DELETE` em `whatsapp_messages`)
- **Apagar para todos:** Chama `revoke-message` na WuzAPI + remove do banco

### 11.6. WaveSurfer.js (Player de Áudio)

```typescript
import { WaveSurferPlayer } from './WaveSurferPlayer';

// Usado em mensagens de áudio com media_url válida
<WaveSurferPlayer src={msg.media_url} isOutbound={isOutbound} />
```

### 11.7. Emoji Picker

```typescript
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

<Picker
  data={data}
  onEmojiSelect={(emoji) => insertEmojiAtCursor(emoji.native)}
  theme="light"
  locale="pt"
  previewPosition="none"
  skinTonePosition="none"
/>
```

### 11.8. URL State

```typescript
// Rota
<Route path="/whatsapp/:phone" element={<WhatsApp />} />
<Route path="/whatsapp" element={<WhatsApp />} />

// No componente WhatsApp
const { phone } = useParams();
const navigate = useNavigate();

// Ao selecionar contato
navigate(`/whatsapp/${cleanPhone}`, { replace: true });

// Ao fechar conversa
navigate('/whatsapp');
```

### 11.9. Contatos Virtuais

Quando uma mensagem chega de um número não cadastrado como lead:

- O sistema cria um "contato virtual" na lista usando apenas o telefone
- Não tem `leadId`, então mensagens são buscadas por telefone
- Botão "Cadastrar lead" disponível para converter em lead real
- Ao cadastrar, faz vinculação retroativa de todas as mensagens

### 11.10. Indicadores de Status

```tsx
// Ícones de status das mensagens enviadas
{msg.status === 'read' && <CheckCheck className="text-blue-400" />}
{msg.status === 'delivered' && <CheckCheck className="text-green-200" />}
{msg.status === 'sent' && <Check className="text-green-200" />}
{msg.status === 'failed' && <AlertCircle className="text-destructive" />}
```

---

## 12. config.toml

```toml
[functions.whatsapp-api]
verify_jwt = false

[functions.whatsapp-webhook]
verify_jwt = false

[functions.transcribe-audio]
verify_jwt = false
```

> **Nota:** `verify_jwt = false` é necessário porque:
> - `whatsapp-webhook` recebe chamadas da WuzAPI (sem JWT do Supabase)
> - `whatsapp-api` e `transcribe-audio` validam auth via anon key no header

---

## 13. Checklist de Implementação

### Infraestrutura

- [ ] Criar secrets: `WUZAPI_URL`, `WUZAPI_ADMIN_TOKEN`, `WUZAPI_SECRET_KEY`
- [ ] Criar secret `LOVABLE_API_KEY` (para transcrição)
- [ ] Criar bucket `whatsapp-media` (público)

### Banco de Dados

- [ ] Criar tabela `whatsapp_instances` com RLS
- [ ] Criar tabela `whatsapp_messages` com RLS
- [ ] Criar tabela `whatsapp_instance_access` com RLS
- [ ] Criar tabela `whatsapp_quick_replies`
- [ ] Habilitar Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages`

### Edge Functions

- [ ] Criar `whatsapp-api/index.ts` com todas as actions
- [ ] Criar `whatsapp-webhook/index.ts` com parser de eventos
- [ ] Criar `transcribe-audio/index.ts`
- [ ] Configurar `verify_jwt = false` no `config.toml`

### Frontend

- [ ] Componente de lista de contatos (com busca por telefone e contatos virtuais)
- [ ] Componente de chat (mensagens com Realtime)
- [ ] Componente de input (texto, áudio, arquivos, emojis, respostas rápidas)
- [ ] Player de áudio com WaveSurfer.js
- [ ] Context menu (responder, copiar, excluir)
- [ ] Typing indicator via Realtime Broadcast
- [ ] Gerenciador de instâncias (criar, conectar, QR code)
- [ ] Gerenciador de respostas rápidas
- [ ] URL state (`/whatsapp/:phone`)

### Testes

- [ ] Enviar/receber texto
- [ ] Enviar/receber áudio (PTT)
- [ ] Enviar/receber imagem com legenda
- [ ] Enviar/receber vídeo
- [ ] Enviar/receber documento
- [ ] Verificar status de entrega (sent → delivered → read)
- [ ] Typing indicator
- [ ] Reprocessar mídias que falharam
- [ ] Transcrever áudio
- [ ] QR code e reconexão automática
- [ ] Contatos virtuais → cadastrar como lead
- [ ] URL state persistência e deep linking

---

## Apêndice A: Helpers WuzAPI

### `adminFetch` — Chamada com token admin

```typescript
const adminFetch = async (path: string, options: RequestInit = {}) => {
  const res = await fetch(`${WUZAPI_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: WUZAPI_ADMIN_TOKEN,  // Header "Authorization"
      ...options.headers,
    },
  });
  return { ok: res.ok, status: res.status, data: JSON.parse(await res.text()) };
};
```

### `instanceFetch` — Chamada com token de instância

```typescript
const instanceFetch = async (token: string, path: string, options: RequestInit = {}) => {
  const res = await fetch(`${WUZAPI_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      token: token,  // Header "token" (lowercase!)
      ...options.headers,
    },
  });
  return { ok: res.ok, status: res.status, data: JSON.parse(await res.text()) };
};
```

> **Atenção:** O header para admin é `Authorization`, mas para instância é `token` (lowercase). Isso é uma particularidade da WuzAPI.

---

## Apêndice B: Diferenças entre Tipos de Mídia no Envio

| Tipo | Campo no Body | Formato | Prefixo Data URI |
|---|---|---|---|
| Áudio | `Audio` | Data URI completo | **Obrigatório** (`data:audio/...`) |
| Imagem | `Image` | Data URI completo | Obrigatório |
| Vídeo | `Video` | Base64 puro | **Não usar** (remover prefixo) |
| Documento | `Document` | Base64 puro | **Não usar** (remover prefixo) |

---

## Apêndice C: Fluxo Completo de uma Mensagem Recebida

```
1. WhatsApp → WuzAPI Server
2. WuzAPI → POST /functions/v1/whatsapp-webhook
3. Webhook parser:
   a. Identifica eventType = "Message"
   b. Extrai phone, pushName, msgId
   c. Ignora grupos (IsGroup = true)
   d. Ignora mensagens próprias (IsFromMe = true)
   e. Detecta tipo de mídia
   f. Tenta download (3 fallbacks)
   g. Upload para Storage
   h. Busca lead por telefone (fuzzy match)
   i. Insert em whatsapp_messages
4. Supabase Realtime → postgres_changes → INSERT
5. Frontend: setMessages(prev => [...prev, newMsg])
6. Chat atualiza instantaneamente
```

---

## Apêndice D: Troubleshooting

| Problema | Causa Provável | Solução |
|---|---|---|
| Áudio não envia (400) | Falta prefixo `data:audio/` | Garantir `audioWithPrefix` |
| Mídia não aparece | Falha no download/upload | Usar botão "Recuperar mídias" |
| Mensagens não chegam | Webhook não configurado | Usar `check-webhook` |
| Status não atualiza | `wuzapi_message_id` não capturado | Verificar response do envio |
| QR code não aparece | Sessão já conectada | `check-status` primeiro |
| Token inválido | Dessincronização com WuzAPI | `resolveInstanceAuth` reconcilia |
| Base64 decode falha | Prefixo data URI mal formatado | `safeBase64Decode` trata isso |
