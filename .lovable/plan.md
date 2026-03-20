

# Plano: Adicionar Logo no Header da Sidebar

## Problema
O `SidebarHeader` (linhas 138-148) tem o import do `logoImg` mas o `<img>` tag está ausente — o header está vazio.

## O que será feito

1. **Copiar a nova imagem** `LOGOS_APP_02_6-2.png` para `src/assets/logo-pep.png` (substituindo o arquivo atual)
2. **Adicionar a tag `<img>`** dentro do `SidebarHeader`, centralizada, com tamanho responsivo:
   - Expandido: `h-28` (grande, como definido anteriormente)
   - Colapsado: `h-10` (compacto, apenas o ícone)

## Arquivo

| Arquivo | Ação |
|---------|------|
| `src/assets/logo-pep.png` | Substituir pela nova imagem enviada |
| `src/components/layout/AppSidebar.tsx` | Adicionar `<img src={logoImg}>` no SidebarHeader |

