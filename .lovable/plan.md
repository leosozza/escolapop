

# Plano: Criar Página de WhatsApp para Atendimento

## Contexto

O componente `WhatsAppContactPanel` já existe e funciona (lista de contatos + conversa), mas só está acessível como aba dentro de `ProducerQueue`. Falta uma página dedicada no menu lateral para acesso direto ao WhatsApp.

## O que será feito

### 1. Criar página `src/pages/WhatsApp.tsx`
Página simples que renderiza o `WhatsAppContactPanel` em tela cheia, com título e layout adequado.

### 2. Adicionar rota no `App.tsx`
Nova rota `/whatsapp` com `AppLayout`.

### 3. Adicionar item no sidebar
Adicionar "WhatsApp" no grupo **Comercial** (após "Studio") com ícone `MessageCircle`.

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/WhatsApp.tsx` | Criar — página com WhatsAppContactPanel |
| `src/App.tsx` | Adicionar rota `/whatsapp` |
| `src/components/layout/AppSidebar.tsx` | Adicionar item "WhatsApp" no grupo Comercial |

