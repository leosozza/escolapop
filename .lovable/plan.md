

# Plano: Perfil Completo do Aluno com Edicao e Historico

## Contexto

Hoje o `StudentDetailsSheet` abre uma sheet lateral com dados do aluno vindos da tabela `leads`. Nao permite editar telefone, nome, observacoes, guardian_name, etc. Tambem nao consolida o historico completo do aluno (todos os cursos, certificados emitidos, presencas totais).

O aluno e identificado pelo `lead_id` na tabela `enrollments`. Seus dados ficam em `leads` (full_name, phone, guardian_name, notes).

## O que sera criado

### 1. Novo componente: `StudentProfilePage.tsx`
Uma pagina completa (nao sheet) acessivel por `/students/:leadId` que mostra:

**Cabecalho editavel:**
- Nome, telefone, email, nome do responsavel (guardian_name), observacoes gerais
- Botao "Salvar Alteracoes" para gravar no `leads`
- Botao WhatsApp Web

**Secao: Historico de Cursos (todas as enrollments do lead)**
- Cards por enrollment mostrando: curso, turma, status, tipo de matricula, influenciador, codigo
- Grade de 8 aulas (presenca) por enrollment
- Indicador de certificado emitido ou pendente
- Botao para emitir certificado (redireciona para /certificates)
- Select para alterar status da enrollment

**Secao: Historico de Alteracoes**
- Timeline com todas as mudancas de status de todas as enrollments

**Secao: Certificados**
- Lista de enrollments com `certificate_issued = true` e data de emissao
- Indicador visual de certificado pendente vs emitido

### 2. Atualizar `Students.tsx`
- Botao "Ver" agora navega para `/students/:leadId` em vez de abrir sheet lateral
- Manter sheet como opcao rapida (hover/click no nome abre sheet, botao "Perfil Completo" navega)

### 3. Rota nova no `App.tsx`
- Adicionar rota `/students/:leadId` apontando para `StudentProfilePage`

### 4. Campos editaveis na pagina do aluno
Dados do `leads` que serao editaveis:
- `full_name` (nome)
- `phone` (telefone)
- `email`
- `guardian_name` (responsavel)
- `notes` (observacoes gerais)

Dados do `enrollments` editaveis por enrollment:
- `status` (via select)
- `notes` (observacoes da matricula)
- `student_age` (idade)

## Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| `src/pages/StudentProfile.tsx` | Novo - pagina completa do aluno |
| `src/pages/Students.tsx` | Adicionar navegacao para perfil completo |
| `src/App.tsx` | Adicionar rota `/students/:leadId` |

Nenhuma alteracao de banco necessaria - todos os campos ja existem nas tabelas `leads` e `enrollments`.

