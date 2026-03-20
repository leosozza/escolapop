

# Plano: WhatsApp Multi-Instância com Permissões de Acesso

## Contexto

A WuzAPI suporta múltiplas instâncias (cada "user" na API = uma instância com seu próprio token, número WhatsApp e webhook). Atualmente o sistema trata como sessão única. Precisamos:

1. Gerenciar múltiplas instâncias (criar, conectar via QR ou oficial, desconectar, excluir)
2. Controlar quais usuários do sistema podem acessar cada instância
3. Configurar webhook automaticamente ao criar a instância

## Arquitetura

```text
Admin cria instância → POST /admin/users (WuzAPI)
  → Salva na tabela whatsapp_instances (token, nome, tipo)
  → Configura webhook automaticamente: POST /webhook
  → Conecta: POST /session/connect
  → Exibe QR: GET /session/qr

Permissões:
  whatsapp_instance_access (instance_id, user_id)
  → Operador só vê/usa instâncias que tem acesso
```

## Migração SQL

1. **Criar tabela `whatsapp_instances`** (substitui `whatsapp_session` como entidade principal):
   - `id`, `name` (nome da instância), `wuzapi_user_id` (ID do user na WuzAPI), `wuzapi_token` (token gerado), `connection_type` (qrcode/oficial), `status` (disconnected/connecting/connected), `phone_number`, `qr_code`, `last_error`, `last_check_at`, `created_by`, `created_at`, `updated_at`

2. **Criar tabela `whatsapp_instance_access`** (permissões):
   - `id`, `instance_id` (FK → whatsapp_instances), `user_id` (FK → auth.users), `created_at`
   - RLS: admin/gestor pode gerenciar; staff pode ler apenas instâncias que têm acesso

3. **Atualizar `whatsapp_messages`**: adicionar coluna `instance_id` (FK → whatsapp_instances) para saber por qual instância a mensagem foi enviada/recebida

## Edge Function `whatsapp-api` — Refatoração

Adicionar novas ações:
- `create-instance`: Chama `POST /admin/users` com `WUZAPI_ADMIN_TOKEN`, salva na tabela `whatsapp_instances`, configura webhook automaticamente via `POST /webhook`
- `delete-instance`: Chama `DELETE /admin/users/{id}/full`, remove da tabela
- `list-instances`: Lista instâncias da WuzAPI via `GET /admin/users`

Ações existentes (`connect`, `get-qr`, `check-status`, `disconnect`, `send-text`, `send-document`) passam a receber `instanceId` como parâmetro para identificar qual instância usar. O token da instância é buscado na tabela `whatsapp_instances` e usado no header `token` (em vez do `WUZAPI_ADMIN_TOKEN`).

A configuração do webhook é automática: ao criar a instância, a Edge Function faz `POST /webhook` com a URL do `whatsapp-webhook` e eventos `["Message", "ReadReceipt", "Connected", "Disconnected"]`.

## Edge Function `whatsapp-webhook` — Ajuste

Ao receber mensagem, identificar a instância pelo campo `instance` do payload (que contém o JID da instância). Buscar na tabela `whatsapp_instances` pelo `phone_number` e salvar o `instance_id` na mensagem.

## UI — Nova Página de Gestão de Instâncias

Refatorar `WhatsAppSettings.tsx` para:

1. **Lista de instâncias**: Cards mostrando cada instância com nome, número, status (badge colorido), tipo de conexão
2. **Botão "Nova Instância"**: Dialog para criar — campos: nome da instância, tipo (QR Code / Oficial)
3. **Ações por instância**: Conectar, Desconectar, Ver QR Code, Gerenciar Acessos, Excluir
4. **Dialog "Gerenciar Acessos"**: Lista de usuários do sistema com checkboxes para conceder/revogar acesso à instância

## Permissões no Frontend

- Apenas `admin` e `gestor` podem criar/excluir instâncias e gerenciar acessos
- Operadores com acesso a uma instância podem: ver status, enviar mensagens, ver conversas
- No painel de conversa WhatsApp, mostrar selector de instância (apenas as que o operador tem acesso)

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar `whatsapp_instances`, `whatsapp_instance_access`, adicionar `instance_id` em `whatsapp_messages` |
| `supabase/functions/whatsapp-api/index.ts` | Refatorar para multi-instância (create/delete/list + token por instância) |
| `supabase/functions/whatsapp-webhook/index.ts` | Identificar instância pelo payload |
| `src/components/settings/WhatsAppSettings.tsx` | Refatorar para gerenciar múltiplas instâncias |
| `src/components/settings/WhatsAppInstanceAccessDialog.tsx` | Criar — gerenciar permissões por instância |
| `src/components/whatsapp/WhatsAppConversation.tsx` | Adicionar selector de instância |
| `src/components/academic/AcademicConversationPanel.tsx` | Usar instância com acesso para enviar |
| `src/types/database.ts` | Adicionar tipos WhatsAppInstance e WhatsAppInstanceAccess |

## Fluxo Completo

1. Admin acessa Settings → WhatsApp → clica "Nova Instância"
2. Escolhe nome e tipo (QR Code ou Oficial) → sistema cria user na WuzAPI + salva localmente
3. Webhook é configurado automaticamente (sem ação manual)
4. Admin clica "Conectar" → exibe QR Code → escaneia com celular
5. Admin vai em "Gerenciar Acessos" → seleciona quais operadores podem usar esta instância
6. Operador abre conversa → vê apenas instâncias que tem acesso → envia/recebe mensagens pela instância selecionada

