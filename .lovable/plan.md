

# Plano: Duplicidade de Contatos + Player de Áudio

## 1. Verificação de duplicidade ao cadastrar contato

### `AddWhatsAppContactDialog.tsx` — aba Manual
- Antes de inserir, consultar `leads` pelo telefone (normalizado)
- Se encontrar, mostrar um alert inline no dialog com: nome do lead existente, telefone, status
- Botões: "Ver contato existente" (fecha dialog e seleciona o lead) ou "Criar mesmo assim"
- Não permitir submit automático se duplicado; exigir confirmação explícita

### `RegisterLeadDialog.tsx` — cadastro de lead virtual
- Mesmo padrão: antes de inserir, buscar por telefone
- Se duplicado, exibir alert com dados do lead existente
- Oferecer opção de vincular mensagens ao lead existente ou criar novo

## 2. Player de áudio robusto

O `InlineAudioPlayer` atual usa `<audio>` nativo que pode falhar com formatos OGG/Opus do WhatsApp em alguns navegadores (Safari, por exemplo).

### Solução: instalar `wavesurfer.js` como player de áudio
- Instalar `wavesurfer.js` (leve, sem dependências pesadas, suporta OGG/Opus)
- Substituir o `InlineAudioPlayer` por um componente que usa WaveSurfer para renderizar waveform + play/pause
- Visual: barra de onda estilo WhatsApp, botão play/pause, duração
- Fallback: se WaveSurfer falhar ao carregar, usar `<audio controls>` nativo como última opção

### Alternativa mais simples (se preferir evitar dependência):
- Usar `<audio controls>` nativo do HTML5 diretamente, que funciona na maioria dos navegadores com OGG
- Estilizar minimamente

**Recomendação**: Usar `wavesurfer.js` para ter a experiência visual de waveform do WhatsApp.

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `src/components/whatsapp/AddWhatsAppContactDialog.tsx` | Verificar duplicidade por telefone antes de inserir; mostrar alert com dados do existente |
| `src/components/whatsapp/RegisterLeadDialog.tsx` | Mesma verificação de duplicidade por telefone |
| `src/components/whatsapp/WhatsAppMessageList.tsx` | Substituir `InlineAudioPlayer` por player com wavesurfer.js |
| `package.json` | Adicionar `wavesurfer.js` |

## Fluxo de duplicidade

```text
Operador preenche telefone → blur/submit
→ busca leads com mesmo telefone
→ se encontrar:
   ┌──────────────────────────────────────────┐
   │ ⚠️ Contato já cadastrado!               │
   │ Nome: João Silva                         │
   │ Telefone: (11) 99999-9999               │
   │ Status: Agendado                         │
   │                                          │
   │ [Ver contato existente] [Criar mesmo assim] │
   └──────────────────────────────────────────┘
→ se não encontrar: prossegue normalmente
```

