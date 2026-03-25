

## Problema: Página recarrega ao trocar de conversa no WhatsApp

### Causa raiz

Dois problemas combinados:

1. **`AppLayout.tsx` linha 115**: `<motion.div key={location.pathname}>` — quando a URL muda de `/whatsapp/5511913608141` para `/whatsapp/5511999998888`, o `key` muda, fazendo o `AnimatePresence` desmontar e remontar o componente inteiro com animação de fade-out/fade-in.

2. **`AppLayout.tsx` linha 120**: O check `location.pathname === '/whatsapp'` para aplicar `h-full` não funciona quando a rota é `/whatsapp/:phone` — o container recebe classes `container py-6` em vez de `h-full`.

3. **`App.tsx`**: As rotas `/whatsapp` e `/whatsapp/:phone` são rotas separadas, cada uma criando uma nova instância de `<AppLayout>` + `<WhatsApp />`.

### Solução

**1. `AppLayout.tsx`** — Usar apenas o primeiro segmento da rota como `key` do motion.div, e corrigir o check de classe:

```tsx
// Extrair base da rota para usar como key (ex: "/whatsapp/123" → "/whatsapp")
const routeBase = '/' + location.pathname.split('/')[1];

<motion.div
  key={routeBase}  // não remonta ao trocar /whatsapp/phone1 → /whatsapp/phone2
  ...
  className={routeBase === '/whatsapp' ? 'h-full' : 'container py-6 h-full overflow-auto'}
>
```

**2. `WhatsApp.tsx`** — Trocar `navigate()` por `window.history.replaceState()` para atualizar a URL sem triggar re-render do React Router:

```tsx
// Em vez de: navigate(`/whatsapp/${cleanPhone}`, { replace: true })
window.history.replaceState(null, '', `/whatsapp/${cleanPhone}`);
```

Isso mantém a URL sincronizada para deep linking mas sem causar navegação React.

### Arquivos alterados
- `src/components/layout/AppLayout.tsx` (2 linhas)
- `src/pages/WhatsApp.tsx` (substituir todas as chamadas `navigate` internas por `replaceState`)

