

## Corrigir botão "+" de adicionar contato no WhatsApp

### Problema
O dialog `AddWhatsAppContactDialog` tem dois problemas:
1. **Requer campo "Agente" obrigatório** -- desnecessário para iniciar uma conversa rápida no WhatsApp
2. **O `onSuccess` no WhatsApp.tsx ignora o `leadId` retornado** -- após criar o lead, não navega para a conversa
3. **Duplicate check bloqueia na primeira tentativa** -- o fluxo `checkDuplicate` retorna sem submeter na primeira vez

### Plano

**1. Simplificar `AddWhatsAppContactDialog.tsx`**
- Remover campo "Agente de Relacionamento" como obrigatório (tornar opcional)
- Remover campo "Código Bitrix" (mover para edição posterior no painel lateral)
- Simplificar validação: exigir apenas Nome e Telefone
- Corrigir fluxo de duplicate check: na primeira submissão sem duplicata encontrada, submeter direto em vez de retornar

**2. Atualizar `onSuccess` no `WhatsApp.tsx`**
- Usar o `leadId` retornado pelo dialog para buscar o lead recém-criado
- Após `fetchContacts()`, navegar para `/whatsapp/{phone}` do novo lead, abrindo a conversa automaticamente

### Detalhes Técnicos

**`AddWhatsAppContactDialog.tsx`:**
- Remover validação obrigatória do `agentId`
- Tornar agente opcional no insert (já aceita null no banco)
- Corrigir lógica do `handleManualSubmit`: quando `checkDuplicate` retorna sem encontrar duplicata, prosseguir com o insert na mesma chamada

**`WhatsApp.tsx` (linha ~1254):**
```
onSuccess={(leadId) => {
  fetchContacts();
  setIsAddDialogOpen(false);
  // Buscar phone do lead e navegar
  if (leadId) {
    supabase.from('leads').select('phone').eq('id', leadId).single()
      .then(({ data }) => {
        if (data?.phone) navigate(`/whatsapp/${data.phone.replace(/\D/g, '')}`, { replace: true });
      });
  }
}}
```

