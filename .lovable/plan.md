

## Ajuste do Layout da Lista de Conversas (Referencia)

O layout atual ja esta bastante proximo da referencia. As diferencas identificadas sao pontuais:

### Mudancas planejadas

**1. Alinhamento vertical do item**
- Trocar `items-center` para `items-start` no container principal do item (linha 757), para que o avatar fique alinhado ao topo quando o conteudo cresce com multiplas linhas.

**2. Tamanho do avatar**
- Reduzir de `h-11 w-11` para `h-10 w-10` (igual a referencia).

**3. Adicionar badges de status abaixo da preview**
- Adicionar uma linha de badges (flex-wrap) abaixo da mensagem preview mostrando:
  - Status do lead (usando `STATUS_CONFIG` existente) com icone e cor
  - Badge de tempo de espera (ja existe logica de `waitHours`, mover para badge inline)
  - Badge "Em Atendimento" quando aplicavel

**4. Padding do item**
- Ajustar de `py-3` para `py-2.5` para compactar levemente a lista (mais proximo da referencia que usa `p-3` com `rounded-lg`).

### Arquivos modificados
- `src/pages/WhatsApp.tsx` - Ajustes no bloco de renderizacao dos itens da lista (linhas ~753-812)

### Detalhes tecnicos
- Container principal: `flex items-start gap-3 px-3 py-2.5`
- Avatar: `h-10 w-10 rounded-full`
- Manter a estrutura existente de nome + badge + timestamp na mesma linha
- Adicionar `<div className="flex flex-wrap items-center gap-1 mt-1">` apos a mensagem preview para os badges de status
- Mover o indicador de tempo de espera (Timer) do canto do avatar para um badge inline no rodape do item

