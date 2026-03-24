

## URL State para WhatsApp e sistema

### Objetivo
Ao selecionar uma conversa no WhatsApp, a URL deve refletir o contato ativo (ex: `/whatsapp/5511919372024`), permitindo compartilhar links diretos, manter estado no refresh e navegar com back/forward.

### Mudanças

**1. `src/App.tsx` - Adicionar rota com parâmetro opcional**
- Adicionar rota `/whatsapp/:phone` apontando para o mesmo componente `WhatsApp`
- Manter `/whatsapp` sem parâmetro (lista sem conversa selecionada)

**2. `src/pages/WhatsApp.tsx` - Sincronizar URL com contato selecionado**
- Importar `useParams` do react-router-dom
- Ler `phone` da URL via `useParams`
- Ao selecionar contato: chamar `navigate(`/whatsapp/${phone}`, { replace: true })` em vez de apenas `setSelectedContact`
- Ao carregar com `phone` na URL: após fetch dos contatos, encontrar o contato correspondente e selecioná-lo automaticamente. Se não existir na lista, criar um contato virtual temporário (mesmo padrão já usado na busca)
- Ao fechar/desselecionar: navegar para `/whatsapp`
- Ao trocar instância: navegar para `/whatsapp`

### Escopo
Focado no WhatsApp conforme prioridade. Outras páginas (Students, CRM) já possuem rotas com parâmetros onde aplicável (`/students/:leadId`).

