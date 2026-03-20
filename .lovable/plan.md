
# Plano: Corrigir o Fluxo Real de Conexão WhatsApp/WuzAPI

## Diagnóstico do problema atual

Pelos logs, a instância **já está conectada de verdade na WuzAPI**, mas o sistema local está interpretando isso errado:

- `check-status` retorna payload com `data.connected=true` e `data.loggedIn=true`
- o código atual em `whatsapp-api` lê **apenas** `data.Connected` / `data.LoggedIn` (maiúsculo)
- resultado: `connected` vira `undefined`, a tabela fica como `disconnected`, e a UI tenta conectar de novo sem necessidade

Isso explica exatamente o comportamento atual:

```text
WuzAPI real: conectado
Banco/UI local: desconectado
Botão: tenta reconectar
Resposta da API: "already connected" / "already logged in"
UI: trata como erro
```

## O que vou ajustar

### 1. Normalizar a leitura do status da WuzAPI
No `supabase/functions/whatsapp-api/index.ts` vou criar uma leitura tolerante para os dois formatos:

- `Connected` ou `connected`
- `LoggedIn` ou `loggedIn`
- `QRCode` ou `qrcode`
- `jid` para preencher/atualizar `phone_number`

Isso será aplicado em:
- `check-status`
- `ensureConnected`
- `connect`
- `get-qr`

### 2. Tratar “already connected” e “already logged in” como estado válido
Hoje o fluxo marca isso como erro. Vou mudar para:

- `already connected` => atualizar instância para `connected`
- `already logged in` => atualizar instância para `connected` e limpar QR antigo
- só marcar erro real quando a sessão estiver de fato indisponível

### 3. Ajustar o estado salvo no banco
A tabela `whatsapp_instances` deve refletir o estado real:

- `connected` quando a sessão estiver autenticada
- `waiting_qr` quando houver QR disponível e ainda não autenticada
- `disconnected` apenas quando realmente não houver sessão ativa

Também vou:
- salvar `phone_number` a partir do `jid`
- limpar `last_error` quando a instância estiver saudável
- limpar `qr_code` quando a sessão já estiver conectada

### 4. Corrigir a lógica da tela de Configurações
No `src/components/settings/WhatsAppSettings.tsx` vou ajustar:

- `handleDiagnostic` para mostrar claramente:
  - conectado
  - aguardando QR
  - já autenticado, então QR não se aplica
- parar de tentar `connect` se `check-status` já indicar sessão ativa
- parar de mostrar “QR não disponível” como falha quando a resposta real for “already logged in”
- mostrar mensagem coerente, por exemplo:
  - “Instância já está conectada”
  - “QR só é exibido quando a sessão ainda não foi autenticada”

### 5. Revisar o envio de mensagens
O helper `ensureConnected` hoje também depende da leitura errada de `Connected`. Isso pode quebrar o envio no atendimento mesmo com a instância online.

Vou corrigir esse helper para que:
- mensagens sejam enviadas normalmente quando a instância já estiver conectada
- a reconexão automática só rode quando realmente necessário

### 6. Validar a configuração automática do webhook
Os logs mostram resposta de webhook com valor vazio em alguns momentos. Ao revisar o fluxo, vou incluir uma checagem pós-configuração para confirmar se o webhook foi realmente persistido, evitando uma instância “conectada” mas sem receber eventos.

## Resultado esperado após a correção

Para a instância atual, o comportamento correto deve ficar assim:

```text
check-status → connected=true, loggedIn=true
↓
banco atualizado para status=connected
↓
card da instância mostra "Conectado"
↓
botão "Conectar" some
↓
botão QR deixa de ser tratado como obrigatório
↓
atendimento pode usar a instância normalmente
```

E o diagnóstico deve passar a informar algo como:

```text
Instância conectada e autenticada.
QR Code não é necessário porque a sessão já está ativa.
```

## Arquivos a modificar

| Arquivo | Ação |
|---|---|
| `supabase/functions/whatsapp-api/index.ts` | Corrigir parser de status, reconexão, QR e tratamento de estados já conectados |
| `src/components/settings/WhatsAppSettings.tsx` | Corrigir diagnóstico e mensagens da UI |
| `src/components/whatsapp/WhatsAppStatusIndicator.tsx` | Validar se o indicador reflete corretamente o status após a sincronização |

## Observação importante

Não parece ser um problema de credencial neste momento. O log mostra que a instância responde com sucesso e já possui `jid`/telefone preenchido. O erro principal agora é de **interpretação do estado**, não de autenticação real.

## Sem migração
Essa correção pode ser feita sem nova tabela ou migração de banco.
