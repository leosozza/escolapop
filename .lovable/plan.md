

# Plano: Realtime + Indicador de Digitando no WhatsApp

## 1. Ativar Realtime na tabela `whatsapp_messages`

Migração SQL:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
```

Isso garante que INSERT e UPDATE na tabela sejam propagados automaticamente via WebSocket para o frontend. O código em `WhatsAppMessageList.tsx` já escuta `postgres_changes` — só falta a publicação estar ativa.

## 2. Indicador de "digitando..." via Broadcast

### Backend — `whatsapp-webhook/index.ts`
No handler de `ChatPresence`, em vez de apenas logar, fazer broadcast via Supabase Realtime:
- Extrair o telefone e o estado (`composing` / `paused`)
- Usar o Supabase client para enviar broadcast no canal `whatsapp-typing`
- Payload: `{ phone, state, instanceId }`

### Frontend — `WhatsAppConversation.tsx`
- Adicionar listener no canal `whatsapp-typing` (Broadcast)
- Quando `state === "composing"` e o phone corresponde ao contato aberto, mostrar "digitando..." abaixo do nome no header
- Auto-ocultar após 5 segundos sem novo evento
- Animação com 3 pontos pulsantes

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| **migração SQL** | `ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages` |
| `supabase/functions/whatsapp-webhook/index.ts` | Broadcast do ChatPresence via Supabase Realtime |
| `src/components/whatsapp/WhatsAppConversation.tsx` | Listener de typing + indicador visual |

