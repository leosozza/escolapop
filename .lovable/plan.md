

# Plano: Sistema de Respostas Rápidas Editáveis no WhatsApp

## Resumo

Criar um sistema de respostas rápidas (templates de mensagem) que o operador pode selecionar com `/`, editar antes de enviar, e gerenciar (criar, editar, excluir) suas próprias respostas.

## Mudanças

### 1. Nova tabela `whatsapp_quick_replies`
Campos: `id`, `title` (nome curto), `content` (texto do template), `shortcut` (atalho tipo `/boas-vindas`), `created_by` (uuid), `is_global` (boolean — visível para todos ou só do criador), `created_at`, `updated_at`.
RLS: staff pode ver globais + próprias, staff pode criar/editar/excluir as próprias, admin pode gerenciar todas.

### 2. Frontend — `WhatsAppChatInput.tsx`
- Ao digitar `/` no início da mensagem, abrir popup acima do textarea com lista filtrada de respostas rápidas
- Ao selecionar uma resposta, inserir o conteúdo no textarea (substituindo o `/comando`) para o operador **editar antes de enviar**
- Suporte a variáveis simples: `{nome}`, `{curso}` — substituídas automaticamente com dados do lead selecionado
- Botão de atalho (ícone de raio/zap) ao lado do clip para abrir o menu completo sem digitar `/`

### 3. Frontend — Gerenciador de Respostas Rápidas
- Dialog/Sheet acessível pelo ícone de configuração no chat ou pelo menu do botão de raio
- Lista de respostas com título, atalho e preview do conteúdo
- Formulário para criar/editar: título, atalho, conteúdo (textarea), checkbox "disponível para todos"
- Botão excluir com confirmação

## Arquivos a modificar/criar

| Arquivo | Ação |
|---------|------|
| **migração SQL** | Criar tabela `whatsapp_quick_replies` com RLS |
| `src/components/whatsapp/WhatsAppChatInput.tsx` | Adicionar popup de `/` e botão de respostas rápidas |
| `src/components/whatsapp/QuickRepliesManager.tsx` | **Novo** — Dialog para CRUD de respostas rápidas |
| `src/components/whatsapp/QuickReplyPopup.tsx` | **Novo** — Popup que aparece ao digitar `/` |

## Fluxo do operador

1. Operador digita `/` → popup aparece com respostas filtráveis
2. Digita `/boa` → filtra para "Boas-vindas", "Boa sorte", etc.
3. Clica ou pressiona Enter → texto é inserido no campo de mensagem
4. Variáveis como `{nome}` são substituídas pelo nome do lead
5. Operador edita livremente o texto e envia quando pronto

## Detalhes técnicos

**Variáveis suportadas inicialmente:**
- `{nome}` — primeiro nome do lead
- `{nome_completo}` — nome completo
- `{curso}` — curso de interesse

**Popup de seleção:**
- Posicionado acima do textarea (absolute, bottom)
- Navegação por setas ↑↓ e Enter
- Fecha com Escape ou ao clicar fora
- Máximo 5 resultados visíveis com scroll

