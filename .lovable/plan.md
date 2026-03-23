
## Plano: corrigir o recebimento real dos eventos do WhatsApp

## Diagnóstico confirmado

O problema principal não é mais “webhook não configurado”. O webhook está sendo chamado, mas o sistema está interpretando o payload errado.

### O que os logs mostram
Os eventos que chegam hoje têm formato como este:

```json
{
  "event": { ...payload... },
  "instanceName": "Escola de modelo",
  "state": "Delivered",
  "type": "ReadReceipt",
  "userID": "9bbb96dc59e3f6b1d1efa579c6be8450"
}
```

### Onde o código falha
No `whatsapp-webhook` atual:
- `const eventType = body.event || body.type`
- como `body.event` é um objeto, `eventType` vira o objeto inteiro, não `"ReadReceipt"` ou `"Message"`
- por isso os blocos `if (eventType === "Message")`, `if (eventType === "Receipt")`, etc. nunca executam

Além disso:
- o código tenta ler `body.instance`, mas os logs mostram `instanceName` e `userID`
- os eventos de status/receipt estão chegando, mas não são aplicados no banco
- na tabela `whatsapp_messages`, as mensagens outbound estão com `wuzapi_message_id = null`, então mesmo quando o receipt for processado, hoje ele não terá como localizar a mensagem enviada para marcar como `delivered/read`
- no banco há apenas mensagens outbound e zero inbound, confirmando que nada do retorno está sendo persistido

## O que vou ajustar

### 1. Reescrever o parser do `whatsapp-webhook`
Adaptar para aceitar o payload real que está chegando agora:
- `type` como tipo do evento
- `event` como objeto de dados
- `instanceName` e `userID` para localizar a instância
- compatibilidade com o formato antigo já tratado, para não quebrar se a WuzAPI variar o schema

### 2. Corrigir o mapeamento da instância
A resolução da instância deve buscar por:
1. `userID -> whatsapp_instances.wuzapi_user_id`
2. `instanceName -> whatsapp_instances.name`
3. fallback por telefone/JID quando existir

Isso é essencial para salvar inbound e atualizar status na instância correta.

### 3. Corrigir eventos de mensagem recebida
No handler de mensagem:
- ler texto a partir do payload real (`event.Info`, `event.Message`, `event.RawMessage`, etc.)
- identificar telefone remoto corretamente
- ignorar mensagens de grupo
- ignorar mensagens enviadas pela própria instância (`IsFromMe`)
- salvar inbound em `whatsapp_messages`
- vincular ao lead pelo telefone

### 4. Corrigir eventos de entrega e leitura
No handler de receipt/read receipt:
- ler IDs de mensagem a partir de `event.MessageIDs` e campos equivalentes
- converter `state/type` para status internos:
  - `Delivered` -> `delivered`
  - `Read` / `read` / `played` -> `read`
- atualizar mensagens outbound existentes

### 5. Corrigir o envio para salvar o ID real da mensagem
No `whatsapp-api`:
- revisar a resposta real de `/chat/send/text`
- capturar corretamente o ID retornado pela WuzAPI
- salvar esse ID em `wuzapi_message_id`

Sem isso, os receipts nunca conseguirão marcar `delivered/read`.

### 6. Melhorar observabilidade
Adicionar logs objetivos no webhook:
- tipo recebido
- instância resolvida
- mensagem ignorada e motivo
- IDs de receipt processados
- quantidade de linhas afetadas no update

Isso vai permitir validar rapidamente se o retorno está funcionando.

### 7. Preparar o suporte a presença/digitando
Hoje `ChatPresence` só faz log. Vou estruturar o plano para:
- primeiro estabilizar inbound + delivered + read
- depois, em etapa seguinte, expor “digitando...” em tempo real se o payload realmente estiver chegando

## Arquivos a modificar

| Arquivo | Ação |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | Reescrever parser dos eventos reais, mapear instância corretamente, salvar inbound, processar receipt/read |
| `supabase/functions/whatsapp-api/index.ts` | Corrigir captura do `wuzapi_message_id` no envio e adicionar logs de resposta |
| `src/components/whatsapp/WhatsAppMessageList.tsx` | Validar renderização de status `sent/delivered/read` após correção backend |

## Resultado esperado

Depois da correção:
- mensagens recebidas passam a entrar na conversa
- mensagens enviadas passam de `sent` para `delivered/read`
- o chat interno reflete os eventos reais da WuzAPI
- os logs deixam claro se um evento foi recebido, processado ou descartado

## Observação importante
Pelos logs atuais, o webhook já está ativo. O problema agora é principalmente de compatibilidade com o formato real dos eventos e de persistência do ID da mensagem enviada. Não parece ser mais um problema de conexão da instância.

## Sem migração
A princípio, essa correção pode ser feita sem nova tabela. Só revisarei migração se for necessário guardar presença/digitando de forma persistente.
