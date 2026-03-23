

# Plano: Ajustar Layout do Chat WhatsApp

## Problemas identificados (da screenshot e código)

1. **Lista de conversas não mostra horário** — exibe "há X tempo" em vez de hora real (ex: "09:00", "14:30")
2. **Sidebar muito estreita** — `w-[340px]` fixo, dificulta leitura
3. **Layout não ocupa toda a página** — `h-[calc(100vh-4rem)]` limita, e o chat não é expansível

## Mudanças

### 1. Mostrar horário real na lista de contatos
Substituir `formatDistanceToNow` por lógica tipo WhatsApp:
- Hoje: mostra `HH:mm` (ex: "09:00")
- Ontem: "Ontem"
- Mais antigo: `dd/MM/yyyy`

### 2. Aumentar largura do sidebar
- De `w-[340px]` para `w-[380px]`

### 3. Layout full-height expansível
- Mudar `h-[calc(100vh-4rem)]` para `h-[calc(100vh-3.5rem)]` ou usar flex que preenche todo o espaço disponível
- Garantir que a área de chat ocupe 100% da altura restante sem overflow escondido

## Arquivo a modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/WhatsApp.tsx` | Ajustar largura sidebar, formato de hora, altura do layout |

