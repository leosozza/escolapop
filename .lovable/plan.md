

# Plano: Carregar Mensagens de Clientes Novos no WhatsApp

## Problema

A lista de contatos em `/whatsapp` é construída exclusivamente a partir da tabela `leads`. Quando um cliente novo (sem cadastro como lead) envia mensagem, ela é salva em `whatsapp_messages` com `lead_id = null`, mas nunca aparece na interface porque não existe lead correspondente.

Além disso, a lista não atualiza automaticamente quando chegam novas mensagens.

## O que será feito

### 1. Mostrar contatos sem lead na lista

Na função `fetchContacts`, após buscar leads e cruzar com mensagens, adicionar uma segunda etapa:
- Identificar telefones em `whatsapp_messages` que **não** correspondem a nenhum lead
- Criar entradas de contato "virtuais" para esses telefones (usando o `phone` e PushName quando disponível)
- Exibi-los na lista com badge "Novo" para indicar que não têm cadastro

### 2. Botão para criar lead a partir de contato novo

No painel de info, quando o contato selecionado não tem lead, mostrar botão "Cadastrar como Lead" que cria o registro na tabela `leads` e associa as mensagens existentes.

### 3. Auto-refresh da lista ao receber mensagens

Adicionar listener realtime em `whatsapp_messages` (INSERT) para atualizar a lista de contatos quando chega uma nova mensagem, incluindo de números desconhecidos.

### 4. Webhook: salvar PushName para identificação

No `whatsapp-webhook`, quando salvar mensagem inbound sem lead, incluir o `PushName` (nome do contato no WhatsApp) no campo `content` de metadado ou em um campo auxiliar para exibição.

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/WhatsApp.tsx` | Buscar contatos sem lead; auto-refresh via realtime; botão cadastrar lead |
| `supabase/functions/whatsapp-webhook/index.ts` | Incluir log de PushName e garantir que mensagens sem lead sejam salvas corretamente |

