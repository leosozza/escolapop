

# Plano: Padronizar WhatsApp Web e Melhorar Layout do Atendimento Matrícula

## O que será feito

### 1. Padronizar todas as funções de WhatsApp do sistema
Hoje existem 5 implementações duplicadas de `openWhatsApp` espalhadas pelo código. Vou unificar todas para usar a função centralizada em `src/lib/whatsapp.ts`, garantindo que o formato do número sempre funcione com `wa.me`.

**Arquivos a atualizar:**
- `src/pages/Students.tsx` - trocar função local por import de `@/lib/whatsapp`
- `src/components/students/StudentDetailsSheet.tsx` - idem
- `src/components/classes/ClassStudentsList.tsx` - idem
- `src/components/whatsapp/WhatsAppContactPanel.tsx` - idem

### 2. Melhorar `src/lib/whatsapp.ts`
- Tratar números que já vêm com `55` para não duplicar
- Tratar números com formatação `(XX) XXXXX-XXXX`
- Garantir que números armazenados sem código de país funcionem

### 3. Melhorar layout do Atendimento Matrícula
O `AcademicConversationPanel` será atualizado para ter um layout mais focado em ação:

- **Botão "Abrir WhatsApp Web"** mais destacado (verde, estilo WhatsApp) que abre `web.whatsapp.com/send?phone=55XXXXXXXXXXX` em nova aba - isso abre direto o WhatsApp Web na conversa com o aluno
- Usar `web.whatsapp.com/send` em vez de `wa.me` para direcionar ao WhatsApp Web no navegador
- Manter painel de tabulação e observações ao lado

### 4. Adicionar opção WhatsApp Web
Atualizar `src/lib/whatsapp.ts` para incluir função `openWhatsAppWeb` que usa `https://web.whatsapp.com/send?phone=NÚMERO` - isso abre diretamente no WhatsApp Web do navegador em vez do app mobile.

## Resumo de mudanças

| Arquivo | Ação |
|---------|------|
| `src/lib/whatsapp.ts` | Adicionar `openWhatsAppWeb()` com URL `web.whatsapp.com` |
| `src/components/academic/AcademicConversationPanel.tsx` | Usar `openWhatsAppWeb`, botão verde destacado |
| `src/pages/Students.tsx` | Substituir função local por import centralizado |
| `src/components/students/StudentDetailsSheet.tsx` | Idem |
| `src/components/classes/ClassStudentsList.tsx` | Idem |
| `src/components/whatsapp/WhatsAppContactPanel.tsx` | Idem |

Nenhuma alteração de banco de dados necessária.

