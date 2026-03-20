

# Plano: Página WhatsApp Web-Like para Atendimento

## Problema

A página `/whatsapp` usa `WhatsAppContactPanel` que, ao selecionar um contato, mostra `WhatsAppConversation` — um painel de **dados do contato** (notas, status, info). Não exibe mensagens reais nem permite enviar. Os componentes `WhatsAppMessageList` e `WhatsAppChatInput` existem mas não são usados nessa página.

## Solução

Redesenhar a página `/whatsapp` como um layout estilo WhatsApp Web:

```text
┌──────────────┬─────────────────────────────────────┐
│  Sidebar     │  Chat Area                          │
│  ─────────── │  ┌─────────────────────────────────┐│
│  [Search]    │  │ Header: Nome + Status + Info btn ││
│  [Instance]  │  ├─────────────────────────────────┤│
│              │  │                                 ││
│  Contact 1 ● │  │  Message bubbles (realtime)     ││
│  Contact 2   │  │  ...                            ││
│  Contact 3   │  │                                 ││
│              │  ├─────────────────────────────────┤│
│              │  │ [Input box]            [Send]   ││
│              │  └─────────────────────────────────┘│
└──────────────┴─────────────────────────────────────┘
```

## O que será feito

### 1. Reescrever `src/pages/WhatsApp.tsx`
Layout completo com 3 zonas:
- **Sidebar esquerda** (~350px): busca, seletor de instância (dropdown com instâncias que o usuário tem acesso), lista de contatos com preview da última mensagem e timestamp
- **Área de chat central**: header do contato (avatar, nome, telefone, status badge), `WhatsAppMessageList` ocupando toda a altura, `WhatsAppChatInput` fixo no fundo
- **Painel de info** (opcional, toggle): dados do contato, tabulação, notas — conteúdo atual do `WhatsAppConversation`

### 2. Refatorar lista de contatos
- Buscar leads **com** a última mensagem de cada um (subquery ou join em `whatsapp_messages`)
- Ordenar por última mensagem (contatos com conversa recente primeiro)
- Incluir todos os status (não filtrar matriculados — WhatsApp atende todos)
- Mostrar preview da última mensagem truncada + hora
- Indicador de mensagens não lidas (mensagens inbound sem resposta)

### 3. Integrar instância automaticamente
- Ao abrir a página, buscar instâncias com acesso do usuário (`whatsapp_instance_access`)
- Se houver apenas 1, selecionar automaticamente
- Se houver múltiplas, mostrar dropdown no topo do sidebar
- A instância selecionada é passada para `WhatsAppChatInput`

### 4. Chat com realtime
- `WhatsAppMessageList` já tem realtime — será usado diretamente
- Background estilo WhatsApp (pattern sutil ou cor `bg-[#e5ddd5]` / dark mode `bg-[#0b141a]`)
- Bolhas verdes (outbound) e brancas (inbound) — já existem no componente

### 5. Header do chat
- Avatar com iniciais, nome, telefone
- Badge de status do lead
- Botão "Info" que abre/fecha painel lateral com dados do contato
- Botão fallback "Abrir no WhatsApp Web"
- Indicador de conexão da instância

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/WhatsApp.tsx` | Reescrever completamente — layout WhatsApp Web |
| `src/components/whatsapp/WhatsAppContactPanel.tsx` | Não mais usado pela página WhatsApp (mantido para outros usos) |
| `src/components/whatsapp/WhatsAppConversation.tsx` | Extrair info do contato para um componente `WhatsAppContactInfo` reutilizável |

Componentes existentes reutilizados sem alteração:
- `WhatsAppMessageList` (chat bubbles + realtime)
- `WhatsAppChatInput` (input + envio via API)
- `WhatsAppStatusIndicator` (indicador de conexão)
- `AddWhatsAppContactDialog` (adicionar contato)

