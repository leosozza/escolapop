
# Plano atualizado: corrigir de verdade mídia e reações do WhatsApp

## Diagnóstico confirmado
Revisei o código, os logs e os dados gravados. O problema atual não é de interface, é principalmente de captura/salvamento:

1. O webhook está tentando baixar mídia por `POST /chat/downloadmedia`, mas os logs mostram `404 page not found`.
2. A documentação da WuzAPI indica endpoints separados por tipo:
   - `/chat/downloadaudio`
   - `/chat/downloadimage`
   - `/chat/downloadvideo`
   - `/chat/downloaddocument`
3. Esses endpoints não usam só `MessageID`; eles exigem dados do próprio payload da mídia (`Url`, `MediaKey`, `Mimetype`, `FileSHA256`, `FileEncSHA256`, `FileLength`).
4. No banco, as mensagens mais recentes de áudio/vídeo continuam entrando com `media_url = null`, então o player inline nunca tem arquivo para tocar.
5. As reações não aparecem porque:
   - não existe nenhuma linha `message_type = 'reaction'` recente salva;
   - mesmo quando salvar, hoje o insert da reação não preenche `lead_id`, e a lista da conversa filtra por `lead_id`, então a reação pode ficar invisível.

## O que vou ajustar

### 1. Corrigir a captura de mídia no webhook
Arquivo: `supabase/functions/whatsapp-webhook/index.ts`

Vou substituir a lógica atual por uma ordem de resolução mais robusta:

1. Se o webhook já trouxer `s3.url`, usar essa URL direto.
2. Se trouxer `base64`, subir para o bucket `whatsapp-media` e salvar a URL pública.
3. Se não vier nada pronto, montar o download usando o endpoint correto por tipo:
   - áudio → `/chat/downloadaudio`
   - imagem → `/chat/downloadimage`
   - vídeo → `/chat/downloadvideo`
   - documento → `/chat/downloaddocument`
4. O body desse download será montado com os campos da própria mensagem recebida.

Também vou adicionar logs objetivos para saber qual caminho foi usado:
- `using s3 url`
- `using base64 from webhook`
- `downloading via /chat/downloadaudio`
- `missing media fields for download`

## 2. Salvar `media_url` válido para preview inline
Arquivos:
- `supabase/functions/whatsapp-webhook/index.ts`
- `src/components/whatsapp/WhatsAppMessageList.tsx`

Hoje o componente já sabe renderizar `<audio>`, `<img>` e `<video>`, mas depende de `media_url` funcionar.

Vou garantir que:
- inbound áudio/imagem/vídeo salvem URL absoluta válida;
- URLs relativas antigas não sejam tratadas como mídia reproduzível;
- quando não houver preview válido, a interface mostre fallback claro em vez de parecer “quebrada”.

## 3. Corrigir reações com emoji
Arquivo: `supabase/functions/whatsapp-webhook/index.ts`

Vou ampliar a leitura da reação para suportar variações do payload da WuzAPI:
- `eventData.Message.reactionMessage`
- `eventData.RawMessage.reactionMessage`
- outros caminhos equivalentes, se vierem aninhados

Ao salvar a reação, vou:
- preencher `reaction_to_id`;
- copiar `lead_id` e `instance_id` da mensagem original usando `wuzapi_message_id`;
- usar fallback por telefone/instância se necessário.

Isso é importante porque a conversa aberta normalmente busca por `lead_id`.

## 4. Garantir que a reação apareça na conversa aberta
Arquivo: `src/components/whatsapp/WhatsAppMessageList.tsx`

Vou ajustar a busca/renderização para que as reações da conversa atual sejam exibidas mesmo quando o chat estiver aberto por lead.

Estratégia:
- manter o agrupamento por `reaction_to_id`;
- garantir que as mensagens de reação entrem no conjunto buscado daquela conversa;
- preservar a exibição abaixo do balão, estilo WhatsApp.

## 5. Corrigir envio e preview de mídia do operador
Arquivo: `supabase/functions/whatsapp-api/index.ts`
Arquivo: `src/components/whatsapp/WhatsAppChatInput.tsx`

Há outra falha estrutural:
- o input aceita vídeo, mas hoje não existe `send-video`;
- vídeo enviado pode cair como documento;
- mensagens outbound de mídia são gravadas com `media_url: null`, então o operador também não vê preview inline.

Vou ajustar para:
- detectar vídeo corretamente no input;
- criar action `send-video` no backend;
- salvar a mídia outbound no bucket antes/depois do envio e gravar `media_url`;
- manter documento como card de download e imagem/vídeo/áudio com preview inline.

## 6. Limite importante sobre mensagens antigas
Mensagens antigas que já foram salvas quebradas podem continuar sem preview se o sistema não tiver mais os metadados completos da mídia para refazer o download.

Então o ajuste ficará dividido em dois efeitos:
- novas mensagens: corrigidas de forma definitiva;
- mensagens antigas já quebradas: posso prever uma rotina de recuperação parcial depois, mas ela depende do que ainda existe salvo.

## Arquivos que entram neste ajuste
- `supabase/functions/whatsapp-webhook/index.ts`
- `supabase/functions/whatsapp-api/index.ts`
- `src/components/whatsapp/WhatsAppMessageList.tsx`
- `src/components/whatsapp/WhatsAppChatInput.tsx`

## Resultado esperado
Depois desse ajuste:
- áudio recebido toca dentro da conversa;
- imagem abre inline na conversa;
- vídeo toca inline na conversa;
- reação com emoji aparece no balão correto;
- mídia enviada pelo operador também aparece corretamente no chat;
- novos registros de mídia deixam de entrar com `media_url = null` nos casos suportados.

## Validação que vou considerar obrigatória
Vou validar estes cenários:
1. receber 1 áudio novo;
2. receber 1 imagem nova;
3. receber 1 vídeo novo;
4. reagir a uma mensagem existente;
5. enviar imagem/vídeo/áudio pelo operador;
6. confirmar no banco que os novos registros têm `media_url` preenchido e que existe reação salva.
