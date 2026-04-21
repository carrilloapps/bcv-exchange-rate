# Guía de inicio

Esta guía te lleva del `npm install` a tu primera consulta útil en menos de cinco minutos.

## Requisitos

- Node.js **18 LTS** o superior.
- Acceso de red saliente a `bcv.org.ve` y `datos.gov.co`.

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

## Primer llamado

### CommonJS

```javascript
const { getBcvRates, getTrmRates } = require('bcv-exchange-rate');

(async () => {
  const bcv = await getBcvRates({ currencies: 'USD' });
  console.log('USD/VES:', bcv.current.USD, 'vigencia:', bcv.effectiveDate);

  const trm = await getTrmRates({ limit: 1 });
  console.log('TRM:', trm?.current.value, 'COP');
})();
```

### ESM / TypeScript

```typescript
import { getBcvRates, getTrmRates } from 'bcv-exchange-rate';

const bcv = await getBcvRates({ currencies: 'USD' });
console.log('USD/VES:', bcv.current.USD);
```

## Qué esperar en la respuesta

### BCV

```typescript
{
  current: { USD: 48.16, EUR: 51.20 },       // Monedas filtradas
  effectiveDate: '2026-04-21T00:00:00',      // ISO cuando el sitio lo expone
  history: [
    { date: '2026-04-20', bank: 'Banco X', buy: 47.5, sell: 48.5 }
  ],
  pagination: { currentPage: 0, hasNextPage: true },
  status: { current: 'ok', history: 'ok' }   // Desglose por sección
}
```

El campo `status` es la forma recomendada de detectar fallos parciales: si solicitas ambas secciones y una falla, `status.current` o `status.history` quedará en `'failed'`.

### TRM

```typescript
{
  current: { value: 3573.30, unit: 'COP', validityDate: '2026-04-21' },
  history: [ { value: 3590.00, validityDate: '2026-04-20' } ],
  pagination: { limit: 10, offset: 0, count: 10 }
}
```

`getTrmRates` devuelve `null` cuando la API responde con cero registros.

## Próximos pasos

- Comprende el modelo de errores: [Manejo de errores](./guides/errors.md).
- Ajusta la caché si haces varias llamadas por minuto: [Caché y resiliencia](./guides/caching.md).
- Integra tu logger: [Logging y observabilidad](./guides/logging.md).
- Consulta la referencia completa: [Referencia de la API](./api-reference.md).
