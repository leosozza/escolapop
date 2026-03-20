

# Plano: Filtrar Contatos por Conversas Existentes

## Problema

A página `/whatsapp` lista **todos os leads** (até 200), incluindo contatos que nunca tiveram nenhuma conversa no WhatsApp. Isso polui a lista e dificulta o atendimento.

## Solução

Mudar a lógica de `fetchContacts` para mostrar **apenas contatos que possuem mensagens** na tabela `whatsapp_messages`. Em vez de buscar leads e depois cruzar com mensagens, inverter: buscar telefones distintos com mensagens e então carregar os leads correspondentes.

## Mudança em `src/pages/WhatsApp.tsx`

Na função `fetchContacts`:

1. Buscar telefones distintos com mensagens em `whatsapp_messages` (agrupado por phone, com última mensagem e timestamp)
2. Para cada telefone com mensagem, buscar o lead correspondente na tabela `leads` pelo phone
3. Manter o botão "+" para iniciar conversa com novo contato (que aparecerá na lista após a primeira mensagem)
4. Adicionar um botão/toggle "Todos os contatos" para quem quiser ver a lista completa de leads (sem conversa)

Fluxo simplificado:
- Por padrão: só contatos com conversa (mensagens existentes)
- Toggle "Todos": mostra todos os leads como hoje
- Busca: funciona em ambos os modos

