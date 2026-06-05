# Guía de inicio

Esta guía te lleva desde `npm install` hasta tu primera consulta útil en menos de cinco minutos.

## Requisitos

- Node.js **20 LTS** o superior.
- Acceso de red saliente a `bcv.org.ve`, `datos.gov.co` y `olinda.bcb.gov.br`.

## Instalación

```bash
npm install bcv-exchange-rate
```

```bash
yarn add bcv-exchange-rate
```

```bash
pnpm add bcv-exchange-rate
```

¿Sin proyecto? También puedes consultar directo desde la terminal sin instalar:

```bash
npx bcv-exchange-rate            # tasas BCV (comando por defecto)
npx bcv-exchange-rate trm        # TRM de Colombia
npx bcv-exchange-rate brl        # dólar PTAX de Brasil
```

## Primera llamada

### CommonJS

```javascript
const { getBcvRates, getTrmRates, getBrlRates } = require('bcv-exchange-rate');

(async () => {
  const bcv = await getBcvRates({ currencies: 'USD' });
  console.log('USD/VES:', bcv.current.USD, 'vigencia:', bcv.effectiveDate);

  const trm = await getTrmRates({ limit: 1 });
  console.log('TRM:', trm?.current.value, 'COP');

  const brl = await getBrlRates({ days: 7 });
  console.log('PTAX venta:', brl?.current.sell, 'BRL por USD');
})();
```

### ESM / TypeScript

```typescript
import { getBcvRates, getTrmRates, getBrlRates } from 'bcv-exchange-rate';

const bcv = await getBcvRates({ currencies: 'USD' });
console.log('USD/VES:', bcv.current.USD);
```

## Estructura de la respuesta

Las tres fuentes comparten el mismo esqueleto: `current` + `history` + `pagination` + `range`. Los campos de `pagination` que no aplican a una fuente son `null` (nunca se omiten).

### BCV

```typescript
{
  current: { USD: 48.16, EUR: 51.20 },       // Monedas filtradas
  effectiveDate: '2026-04-21T00:00:00',      // ISO cuando el sitio lo expone
  history: [
    { date: '2026-04-20', bank: 'Banco X', buy: 47.5, sell: 48.5 }
  ],
  pagination: { limit: null, offset: null, page: 0, count: 1, hasMore: true },
  range: { startDate: '2026-04-14', endDate: '2026-04-21' },
  status: { current: 'ok', history: 'ok' }   // Desglose por sección
}
```

El campo `status` es la forma recomendada de detectar fallos parciales: si solicitas ambas secciones y una falla, `status.current` o `status.history` quedará en `'failed'`.

### TRM

```typescript
{
  current: { value: 3573.30, unit: 'COP', validityDate: '2026-04-21' },
  history: [ { value: 3590.00, validityDate: '2026-04-20' } ],
  pagination: { limit: 10, offset: 0, page: null, count: 10, hasMore: null },
  range: null // ventana de fechas solo cuando pasas days
}
```

`getTrmRates` devuelve `null` cuando la API responde sin registros.

### BRL (PTAX)

```typescript
{
  current: { buy: 5.0409, sell: 5.0415, dateTime: '2026-06-03 13:06:26.54' },
  history: [ { buy: 5.0154, sell: 5.016, dateTime: '2026-06-02 13:10:30.711' } ],
  pagination: { limit: null, offset: 0, page: null, count: 2, hasMore: null },
  range: { startDate: '2026-05-28', endDate: '2026-06-04' }
}
```

`getBrlRates` devuelve `null` cuando la ventana no contiene cotizaciones (fines de semana o feriados sin PTAX).

## Próximos pasos

- Comprende el modelo de errores: [Manejo de errores](./guides/errors.md).
- Ajusta la caché si haces varias llamadas por minuto: [Caché y resiliencia](./guides/caching.md).
- Integra tu logger: [Logging y observabilidad](./guides/logging.md).
- Consulta la referencia completa: [Referencia de la API](./api-reference.md).
- Usa la librería desde Claude o Cursor: sección [Servidor MCP del README](../README.md#servidor-mcp).
