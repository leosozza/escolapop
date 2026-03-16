

# Plano: Cadastro de Funcionários

## Resumo

Vou adicionar todos os funcionários listados ao sistema. Para isso, preciso:
1. Adicionar novos cargos (setores) que ainda não existem no banco
2. Adicionar nova área "Produção" para profissionais do Studio
3. Inserir todos os 21 funcionários
4. Atualizar o frontend para exibir os novos cargos

---

## Funcionários a Cadastrar

| Cargo | Nome | Área |
|-------|------|------|
| **Produtor** | Maryana Mesquita | Produção |
| **Produtor** | Ana Paula | Produção |
| **Produtor** | Chelly | Produção |
| **Produtor** | Rafael | Produção |
| **Recepcionista** | Yara | Comercial |
| **Recepcionista** | Ligida | Comercial |
| **Recepcionista** | Juliana | Comercial |
| **Recepcionista** | Alice | Comercial |
| **Recepcionista** | Carol | Comercial |
| **Editor de Imagem** | Helo | Produção |
| **Editor de Imagem** | Thales | Produção |
| **Maquiagem** | Jessica | Produção |
| **Maquiagem** | Gael | Produção |
| **Fotógrafa** | Nagila | Produção |
| **Gerente** | Ramon | Gestão (Todas as áreas) |
| **Video Maker** | Layne | Produção |
| **Video Maker** | Augusto | Produção |

### Agentes de Relacionamento (tabela `agents`)

| Nome |
|------|
| Ana Paula |
| Ana Beatriz |
| Emilly |
| Camila |
| Andressa |

---

## Alterações no Banco de Dados

### 1. Novos valores no enum `team_sector`

Setores a adicionar:
- `maquiagem` - Profissionais de maquiagem
- `edicao_imagem` - Editores de foto/vídeo
- `fotografo` - Fotógrafos
- `gerente` - Gerentes
- `video_maker` - Produtores de vídeo

### 2. Novo valor no enum `team_area`

- `producao` - Para profissionais do Studio

### 3. Inserir funcionários na tabela `team_members`

17 registros na tabela `team_members`

### 4. Inserir agentes na tabela `agents`

5 registros na tabela `agents`

---

## Alterações no Frontend

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Team.tsx` | Adicionar novos setores (maquiagem, edicao_imagem, etc.) e área (producao) |
| `src/components/team/AddTeamMemberDialog.tsx` | Adicionar novos setores e área no formulário |
| `src/components/team/EditTeamMemberDialog.tsx` | Mesmas opções novas |

### Novos Setores no Frontend

```text
SECTORS:
  maquiagem → "Maquiagem" (ícone: Brush)
  edicao_imagem → "Edição de Imagem" (ícone: Image)
  fotografo → "Fotógrafo(a)" (ícone: Camera)
  gerente → "Gerente" (ícone: Crown)
  video_maker → "Video Maker" (ícone: Video)
```

### Nova Área no Frontend

```text
AREAS:
  producao → "Produção" (cor: pink)
```

---

## Estrutura Visual

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ EQUIPE                                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ [Todos] [Comercial] [Financeiro] [Acadêmico] [Gestão] [Produção]       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│ │ [MN]         │ │ [AP]         │ │ [CH]         │ │ [RF]         │    │
│ │ Maryana M.   │ │ Ana Paula    │ │ Chelly       │ │ Rafael       │    │
│ │ 📹 Produtor  │ │ 📹 Produtor  │ │ 📹 Produtor  │ │ 📹 Produtor  │    │
│ │ [Produção]   │ │ [Produção]   │ │ [Produção]   │ │ [Produção]   │    │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘    │
│                                                                         │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│ │ [YA]         │ │ [LG]         │ │ [JU]         │ │ [AL]         │    │
│ │ Yara         │ │ Ligida       │ │ Juliana      │ │ Alice        │    │
│ │ 🚪 Recepção  │ │ 🚪 Recepção  │ │ 🚪 Recepção  │ │ 🚪 Recepção  │    │
│ │ [Comercial]  │ │ [Comercial]  │ │ [Comercial]  │ │ [Comercial]  │    │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Ordem de Implementação

1. **Migração SQL** - Adicionar novos valores aos enums
2. **Migração SQL** - Inserir funcionários em `team_members`
3. **Migração SQL** - Inserir agentes em `agents`
4. **Atualizar Team.tsx** - Novos setores e áreas
5. **Atualizar AddTeamMemberDialog.tsx** - Opções novas
6. **Atualizar EditTeamMemberDialog.tsx** - Opções novas

---

## Resumo Técnico

- **1 migração SQL** com:
  - 5 novos valores em `team_sector`
  - 1 novo valor em `team_area`
  - 17 inserts em `team_members`
  - 5 inserts em `agents`
- **3 arquivos frontend** a modificar
- **22 funcionários** cadastrados no total

