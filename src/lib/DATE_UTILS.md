# Utilitários de Data e Hora

Este projeto utiliza um sistema centralizado de formatação de datas no padrão brasileiro (Brasília - GMT-3).

## Configurações Padrão

- **Formato de Data:** `dd/MM/yyyy` (ex: 25/12/2024)
- **Formato de Hora:** `HH:mm` (24 horas, ex: 14:30)
- **Timezone:** America/Sao_Paulo (Brasília)
- **Locale:** pt-BR

---

## Hooks Disponíveis

### 1. `useDateFormatter()` - Recomendado para múltiplas datas

Use quando precisar formatar várias datas diferentes no mesmo componente.

```tsx
import { useDateFormatter } from "@/hooks/useFormattedDate";

function MeuComponente() {
  const { date, time, dateTime, dateTimeLong, monthYear, custom } = useDateFormatter();

  return (
    <div>
      <p>Data: {date(occurrence.created_at)}</p>
      <p>Hora: {time(occurrence.created_at)}</p>
      <p>Data e Hora: {dateTime(occurrence.created_at)}</p>
      <p>Completo: {dateTimeLong(occurrence.created_at)}</p>
      <p>Mês/Ano: {monthYear(occurrence.created_at)}</p>
      <p>Personalizado: {custom(occurrence.created_at, "EEEE, dd 'de' MMMM")}</p>
    </div>
  );
}
```

**Funções retornadas:**

| Função | Formato | Exemplo |
|--------|---------|---------|
| `date(data)` | dd/MM/yyyy | 25/12/2024 |
| `time(data)` | HH:mm | 14:30 |
| `dateTime(data)` | dd/MM/yyyy HH:mm | 25/12/2024 14:30 |
| `dateTimeLong(data)` | dd 'de' MMMM 'de' yyyy 'às' HH:mm | 25 de dezembro de 2024 às 14:30 |
| `monthYear(data)` | MMMM 'de' yyyy | dezembro de 2024 |
| `custom(data, formato)` | Qualquer formato date-fns | Personalizado |
| `toSaoPaulo(data)` | Date object | Retorna Date no timezone de SP |
| `now()` | Date object | Data/hora atual em SP |

---

### 2. `useFormattedDate(data)` - Para uma única data

Use quando precisar de todas as formatações de uma data específica.

```tsx
import { useFormattedDate } from "@/hooks/useFormattedDate";

function DetalhesOcorrencia({ occurrence }) {
  const formatted = useFormattedDate(occurrence.created_at);

  return (
    <div>
      <p>Criado em: {formatted.date}</p>
      <p>Às: {formatted.time}</p>
      <p>Completo: {formatted.dateTime}</p>
      <p>Formato longo: {formatted.dateTimeLong}</p>
      <p>Mês: {formatted.monthYear}</p>
      <p>Personalizado: {formatted.custom("EEEE")}</p>
    </div>
  );
}
```

**Propriedades retornadas:**

```tsx
{
  date: string;        // "25/12/2024"
  time: string;        // "14:30"
  dateTime: string;    // "25/12/2024 14:30"
  dateTimeLong: string; // "25 de dezembro de 2024 às 14:30"
  monthYear: string;   // "dezembro de 2024"
  custom: (format: string) => string;  // Formato personalizado
  raw: Date | null;    // Date no timezone de São Paulo
}
```

**Tratamento de valores nulos:**

```tsx
const formatted = useFormattedDate(null);
// Todas as propriedades retornam "-" quando a data é null/undefined
```

---

### 3. `useNowInSaoPaulo()` - Data atual

Retorna a data/hora atual no timezone de Brasília.

```tsx
import { useNowInSaoPaulo } from "@/hooks/useFormattedDate";

function Relogio() {
  const agora = useNowInSaoPaulo();
  
  return <p>Hora atual: {agora.toLocaleTimeString("pt-BR")}</p>;
}
```

---

## Funções Utilitárias (Importação Direta)

Para uso fora de componentes React ou em casos específicos:

```tsx
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatDateTimeLong,
  formatMonthYear,
  formatCustom,
  toSaoPauloTime,
  nowInSaoPaulo,
} from "@/lib/dateUtils";

// Exemplos de uso
const data = formatDate("2024-12-25T14:30:00Z");           // "25/12/2024"
const hora = formatTime("2024-12-25T14:30:00Z");           // "14:30"
const dataHora = formatDateTime("2024-12-25T14:30:00Z");   // "25/12/2024 14:30"
const completo = formatDateTimeLong("2024-12-25T14:30:00Z"); // "25 de dezembro de 2024 às 14:30"
const mesAno = formatMonthYear("2024-12-25T14:30:00Z");    // "dezembro de 2024"
const custom = formatCustom("2024-12-25T14:30:00Z", "EEEE"); // "quarta-feira"
const dataSP = toSaoPauloTime("2024-12-25T14:30:00Z");     // Date object
const agora = nowInSaoPaulo();                              // Date object
```

---

## Formatos Personalizados (date-fns)

Use com `custom()` ou `formatCustom()`:

| Código | Descrição | Exemplo |
|--------|-----------|---------|
| `yyyy` | Ano (4 dígitos) | 2024 |
| `yy` | Ano (2 dígitos) | 24 |
| `MMMM` | Mês por extenso | dezembro |
| `MMM` | Mês abreviado | dez |
| `MM` | Mês (2 dígitos) | 12 |
| `dd` | Dia (2 dígitos) | 25 |
| `d` | Dia | 25 |
| `EEEE` | Dia da semana | quarta-feira |
| `EEE` | Dia abreviado | qua |
| `HH` | Hora (24h) | 14 |
| `hh` | Hora (12h) | 02 |
| `mm` | Minutos | 30 |
| `ss` | Segundos | 45 |
| `'texto'` | Texto literal | 'de', 'às' |

**Exemplos de formatos:**

```tsx
const { custom } = useDateFormatter();

custom(data, "dd/MM/yyyy");                    // "25/12/2024"
custom(data, "EEEE, dd 'de' MMMM");           // "quarta-feira, 25 de dezembro"
custom(data, "dd MMM yyyy");                   // "25 dez 2024"
custom(data, "HH:mm:ss");                      // "14:30:45"
custom(data, "dd/MM/yyyy 'às' HH:mm");        // "25/12/2024 às 14:30"
```

---

## Migração: De toLocaleDateString para Hook

### ❌ Antes (evitar):

```tsx
<p>{new Date(occurrence.created_at).toLocaleDateString("pt-BR")}</p>
<p>{new Date(occurrence.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
```

### ✅ Depois (recomendado):

```tsx
const { date, time } = useDateFormatter();

<p>{date(occurrence.created_at)}</p>
<p>{time(occurrence.created_at)}</p>
```

---

## Boas Práticas

1. **Use `useDateFormatter()`** para a maioria dos casos - é mais flexível
2. **Use `useFormattedDate(data)`** quando trabalhar com uma única data e precisar de múltiplos formatos
3. **Nunca use** `toLocaleDateString()` ou `toLocaleTimeString()` diretamente
4. **Evite importar** diretamente do `date-fns` para formatação - use os utilitários centralizados
5. **Todas as datas** são automaticamente convertidas para o timezone de Brasília

---

## Configuração

As configurações estão centralizadas em `src/lib/dateUtils.ts`:

```tsx
export const DATE_TIME_CONFIG = {
  timezone: "America/Sao_Paulo",
  dateFormat: "dd/MM/yyyy",
  timeFormat: "HH:mm",
  dateTimeFormat: "dd/MM/yyyy HH:mm",
  dateTimeLongFormat: "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
  locale: ptBR,
};
```
