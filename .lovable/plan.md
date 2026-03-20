

# Plano: Remover Toda Lógica de "Abrir WhatsApp Web"

## O que será feito

Remover todas as referências a `openWhatsAppWeb` e `getWhatsAppWebLink` do sistema, já que agora todo atendimento WhatsApp é feito pela página `/whatsapp` integrada.

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/WhatsApp.tsx` | Remover botão "Abrir WhatsApp Web" do header do chat, remover import |
| `src/components/academic/AcademicConversationPanel.tsx` | Remover botão "WhatsApp Web" e imports relacionados |
| `src/components/whatsapp/WhatsAppContactPanel.tsx` | Remover `handleOpenWhatsApp` e import |
| `src/components/students/StudentDetailsSheet.tsx` | Substituir botão WhatsApp por link para `/whatsapp` ou remover |
| `src/pages/StudentProfile.tsx` | Substituir 3 botões WhatsApp por navegação para `/whatsapp` |
| `src/pages/Overdue.tsx` | Substituir botão de cobrança WhatsApp por navegação para `/whatsapp` |
| `src/components/classes/ClassStudentsList.tsx` | Remover referência a `openWhatsAppWeb` |
| `src/lib/whatsapp.ts` | Remover funções `openWhatsAppWeb` e `getWhatsAppWebLink` |

Em páginas como StudentProfile e Overdue, onde o botão WhatsApp tinha contexto (enviar mensagem de cobrança, certificado), o botão será mantido mas redirecionará para `/whatsapp` com o contato pré-selecionado via query param ou simplesmente abrirá a página `/whatsapp`.

