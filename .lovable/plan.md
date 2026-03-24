

## Redesenhar layout dos itens da lista de conversas WhatsApp

### Problema
O layout atual comprime nome, badge de não lida e horário em uma única linha, cortando o horário. A segunda imagem mostra o layout desejado: mais espaçado, com informações em linhas separadas.

### Layout desejado (baseado na referência)
```text
┌─────────────────────────────────────────┐
│ [Avatar]  Nome (bold, maior)    [2] 15:13│
│    •      5511954001026                  │
│           🔵 Em Atendimento  🟢 Agendados│
│           ✓ Preview da mensagem...       │
│           👤 Nome do agente              │
└─────────────────────────────────────────┘
```

### Mudanças em `src/pages/WhatsApp.tsx`

**1. Reestruturar o item de contato (linhas ~753-823)**

Reorganizar o conteúdo de cada item para seguir o layout da referência:

- **Linha 1**: Nome (font-medium, text-sm → text-base) + badge não lida + horário (alinhado à direita)
- **Linha 2**: Número de telefone (text-xs, text-muted-foreground) - sempre visível
- **Linha 3**: Badges de status (Em Atendimento, Agendados, etc.) - mover para antes da preview
- **Linha 4**: Preview da última mensagem (line-clamp-1)
- **Linha 5**: Nome do responsável/agente com ícone 👤 (quando disponível)

**2. Ajustes de espaçamento**

- Aumentar padding vertical de `py-2.5` para `py-3`
- Nome com `text-sm` mantido mas com `font-semibold` para destaque
- Telefone como linha separada abaixo do nome
- Badges de status movidos para linha própria entre telefone e preview

**3. Garantir que horário e badge de não lida não sejam cortados**

- Manter `shrink-0` no horário e badge
- Nome com `truncate` e `flex-1` para ocupar espaço disponível sem empurrar o horário

### Detalhes técnicos

Apenas o bloco de renderização do item na lista (dentro do `.map()`) será alterado. Nenhuma lógica de dados muda - apenas a estrutura visual do JSX.

