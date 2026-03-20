

# Plano: Integração WhatsApp via WuzAPI (Automática e Completa)

## Resumo

Integrar a API WuzAPI ao sistema com automação total: envio/recebimento de mensagens, reconexão automática, webhooks para receber mensagens, e alertas de erro — tudo sem intervenção manual do operador.

## Arquitetura

```text
Frontend (React)
  ↓ supabase.functions.invoke('whatsapp-api')
Edge Function (whatsapp-api) → proxy seguro
  ↓ fetch()
WuzAPI (https://wazapi.ybrasil.com.br/api)

WuzAPI webhook POST →
Edge Function (whatsapp-webhook) → salva em whatsapp_messages
  ↓ realtime
Frontend atualiza automaticamente
```

## Etapas

### 1. Salvar Secrets
Usar `add_secret` para armazenar:
- `WUZAPI_URL` = `https://wazapi.ybrasil.com.br`
- `WUZAPI_ADMIN_TOKEN` = `4059539e1c60f8c77daab20591e1cdbf`
- `WUZAPI_SECRET_KEY` = `6c9c4fed1fc71aba1153a40d81de9b24`

### 2. Migração SQL — Tabela `whatsapp_messages`
```sql
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id),
  phone text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  message_type text NOT NULL DEFAULT 'text',
  content text,
  media_url text,
  wuzapi_message_id text,
  status text DEFAULT 'sent',
  error_message text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage messages" ON public.whatsapp_messages
  FOR ALL USING (public.is_staff(auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
```

Tabela `whatsapp_session` para estado da conexão:
```sql
CREATE TABLE public.whatsapp_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'disconnected',
  phone_number text,
  last_check_at timestamptz DEFAULT now(),
  last_error text,
  qr_code text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.whatsapp_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage session" ON public.whatsapp_session
  FOR ALL USING (public.is_staff(auth.uid()));
```

### 3. Edge Function `whatsapp-api` (Proxy)
Ações:
- `send-text` → `POST /chat/send/text`
- `send-document` → `POST /chat/send/document`
- `check-status` → `GET /session/status` — retorna status, salva em `whatsapp_session`
- `get-qr` → `GET /session/qr`
- `connect` → `POST /session/connect`
- `reconnect` → automaticamente tenta reconectar se status != "connected"

Lógica de auto-reconexão:
- Antes de cada envio, verifica status da sessão
- Se desconectado, tenta `POST /session/connect` automaticamente
- Se falha, salva erro em `whatsapp_session.last_error` e retorna erro ao frontend

### 4. Edge Function `whatsapp-webhook` (Receber mensagens)
- Recebe POST do WuzAPI com mensagens inbound
- Valida usando `WUZAPI_SECRET_KEY`
- Salva em `whatsapp_messages` com `direction = 'inbound'`
- Vincula ao lead pelo número de telefone (busca na tabela `leads`)

### 5. UI — Painel de Conversa Real
Refatorar `AcademicConversationPanel.tsx` e `WhatsAppConversation.tsx`:
- Substituir botão "Abrir WhatsApp Web" por campo de input para enviar mensagens diretamente
- Mostrar histórico real de mensagens (da tabela `whatsapp_messages`) com realtime
- Indicador de status da conexão WhatsApp (verde/vermelho) no header
- Botão de fallback "Abrir no WhatsApp Web" caso a API esteja offline

### 6. UI — Configuração WhatsApp em Settings
Nova aba "WhatsApp" na página Settings:
- Status da conexão (conectado/desconectado) com indicador visual
- QR Code para escanear (exibido automaticamente se desconectado)
- Botão "Reconectar" manual
- Log de erros recentes
- URL do webhook para configurar no WuzAPI: `https://yrotoothzhdagtiukxdx.supabase.co/functions/v1/whatsapp-webhook`

### 7. Alertas Automáticos de Erro
- Se a sessão desconectar, toast de aviso no sistema para todos os operadores logados
- Se o envio falhar, salvar `error_message` na mensagem e exibir ícone de erro no chat
- Retry automático: 1 tentativa de reenvio após 5 segundos em caso de falha

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar `whatsapp_messages` e `whatsapp_session` |
| `supabase/functions/whatsapp-api/index.ts` | Criar — proxy + auto-reconexão |
| `supabase/functions/whatsapp-webhook/index.ts` | Criar — receber mensagens |
| `supabase/config.toml` | Registrar novas funções |
| `src/components/academic/AcademicConversationPanel.tsx` | Refatorar para chat real + realtime |
| `src/components/whatsapp/WhatsAppConversation.tsx` | Refatorar para chat real |
| `src/components/whatsapp/WhatsAppStatusIndicator.tsx` | Criar — indicador de status |
| `src/components/settings/WhatsAppSettings.tsx` | Criar — QR code + status + config |
| `src/pages/Settings.tsx` | Adicionar aba WhatsApp |
| `src/lib/whatsapp.ts` | Adicionar funções de envio via API |

## Fluxo Automático Completo

1. Admin escaneia QR code uma vez em Settings → sessão conectada
2. Operador abre contato → histórico de mensagens carrega automaticamente
3. Operador digita mensagem → envio via API (sem abrir browser externo)
4. Mensagem recebida → webhook salva → realtime atualiza a conversa
5. Sessão cai → sistema tenta reconectar automaticamente → se falha, alerta visual
6. Certificados podem ser enviados como documento PDF diretamente pelo chat

