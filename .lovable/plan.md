

# Plano: Ajustar Input do Chat e Adicionar Matrícula de Irmão

## 1. Aumentar campo de mensagem para 4 linhas
- Em `WhatsAppChatInput.tsx`, alterar o `Textarea` de `rows={1}` e `min-h-[36px]` para `rows={4}` e `min-h-[100px]`

## 2. Esconder ícones de formatação/emoji em menu suspenso
- Remover a toolbar de formatação (Bold, Italic, Strikethrough, Code) e os botões laterais (Emoji, Clip, Zap, Settings) do layout direto
- Criar um botão "+" ou seta que abre um menu dropdown/popover com todas essas opções organizadas
- Manter apenas o textarea, o botão de enviar/mic, e o botão "+" para expandir as ferramentas
- Ao clicar no "+", mostrar popover com: Emoji, Anexar arquivo, Formatação (sub-grupo), Respostas rápidas, Gerenciar respostas

## 3. Botão "Matricular Irmão" no painel de informações
- No info panel do WhatsApp (`WhatsApp.tsx`), dentro de "Ações Rápidas", adicionar botão "Novo Aluno (Irmão)"
- Ao clicar, abrir um dialog que:
  - Pré-preenche o telefone do responsável atual e o nome do responsável (guardian_name)
  - Pede: Nome do Modelo (obrigatório), e opcionais: Nº Contrato MaxSystem, ID Bitrix, ID Ficha MaxSystem
  - Cria um **novo lead** separado com o mesmo telefone e guardian_name do responsável
  - Cria um **novo student** vinculado a esse lead
  - Abre o `AddEnrollmentDialog` para matricular o novo aluno

## Arquivos a modificar/criar

| Arquivo | Ação |
|---------|------|
| `src/components/whatsapp/WhatsAppChatInput.tsx` | Textarea 4 linhas; agrupar ferramentas em menu suspenso |
| `src/components/whatsapp/RegisterSiblingDialog.tsx` | **Novo** — Dialog para cadastrar irmão do mesmo responsável |
| `src/pages/WhatsApp.tsx` | Adicionar botão e estado para o RegisterSiblingDialog nas ações rápidas |

