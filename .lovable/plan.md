

## Corrigir alinhamento dos ícones no sidebar colapsado

### Problema
Quando o sidebar está colapsado, os ícones dos itens de menu não ficam centralizados. Isso acontece porque:
1. O `SidebarContent` tem `px-2` que consome espaço lateral
2. Os `SidebarGroupLabel` (títulos dos grupos como "Comercial", "Acadêmico") continuam visíveis e ocupam espaço
3. O `CollapsibleTrigger` com texto e chevron desalinha o layout

### Mudanças planejadas

**Arquivo: `src/components/layout/AppSidebar.tsx`**

1. **Remover padding lateral do SidebarContent quando colapsado** - Trocar `px-2` por padding condicional: `px-2` expandido, `px-0` colapsado.

2. **Esconder os títulos dos grupos quando colapsado** - Adicionar classe condicional no `SidebarGroupLabel` para esconder o trigger inteiro quando `isCollapsed`, já que os grupos não fazem sentido sem texto.

3. **Manter os itens do menu sempre visíveis** - Remover o `Collapsible` wrapping quando colapsado, ou forçar `defaultOpen={true}` + esconder o label, para que todos os ícones fiquem acessíveis.

4. **Centralizar ícones** - Garantir que o `SidebarMenuButton` e o `Link` interno usem `justify-center` quando colapsado, removendo o `gap-3` desnecessário.

### Detalhes técnicos

```tsx
// SidebarContent - padding condicional
<SidebarContent className={cn("overflow-x-hidden", isCollapsed ? "px-0" : "px-2")}>

// SidebarGroupLabel - esconder quando colapsado  
<SidebarGroupLabel asChild className={cn(isCollapsed && "hidden")}>

// Collapsible - forçar aberto quando colapsado
<Collapsible defaultOpen={isGroupOpen(group) || group.title === 'Comercial' || isCollapsed}>

// Link interno - centralizar ícone quando colapsado
<Link to={item.href} className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
```

