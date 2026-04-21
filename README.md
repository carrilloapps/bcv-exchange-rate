# bcv-exchange-rate

[![npm version](https://img.shields.io/npm/v/bcv-exchange-rate.svg?logo=npm)](https://www.npmjs.com/package/bcv-exchange-rate)
[![npm downloads](https://img.shields.io/npm/dm/bcv-exchange-rate.svg?logo=npm)](https://www.npmjs.com/package/bcv-exchange-rate)
[![CI](https://github.com/carrilloapps/bcv-exchange-rate/actions/workflows/ci.yml/badge.svg)](https://github.com/carrilloapps/bcv-exchange-rate/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/carrilloapps/bcv-exchange-rate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/node/v/bcv-exchange-rate.svg?logo=node.js&logoColor=white)](https://nodejs.org)

Librería profesional de Node.js para consultar indicadores económicos oficiales de **Venezuela (BCV)** y **Colombia (TRM)**. Extrae los datos directamente del Banco Central de Venezuela y del portal de datos abiertos del Gobierno de Colombia, con tipado estricto, reintentos con backoff, caché en memoria activa por defecto, jerarquía de errores tipada y logger basado en interfaz, sin dependencias forzadas.

---

## Características

- **Multi-indicador.** Tasas oficiales del BCV (`USD`, `EUR`, `CNY`, `TRY`, `RUB`) y TRM de Colombia (`COP`).
- **Historial bancario paginado.** Tasas de compra y venta por institución financiera venezolana.
- **Reintentos automáticos** con backoff exponencial configurable.
- **Caché en memoria** con TTL por llamada y _stale-while-error_ opcional.
- **Jerarquía de errores tipada** (`NetworkError`, `TrmApiError`, `ValidationError`).
- **Logger basado en interfaz.** Compatible con winston, pino, bunyan o `console`, sin dependencias forzadas.
- **TLS seguro por defecto** (`strictSSL: true`), con desactivación explícita cuando sea necesario.
- **Dual CJS/ESM** con declaraciones `.d.ts`.
- **Estado por sección** (`status.current`, `status.history`) para detectar fallos parciales.
- **Cobertura del 100 %** forzada en CI.

## Instalación

```bash
npm install bcv-exchange-rate
```

Requiere **Node.js 20 LTS o superior**. Si usas winston como logger (opcional):

```bash
npm install winston
```

## Inicio rápido

```typescript
import { getBcvRates, getTrmRates } from 'bcv-exchange-rate';

const bcv = await getBcvRates({ currencies: 'USD', includeHistory: false });
console.log(`USD/VES: ${bcv.current.USD} (vigencia ${bcv.effectiveDate})`);

const trm = await getTrmRates({ limit: 1 });
console.log(`TRM: ${trm?.current.value} COP`);
```

Versión CommonJS:

```javascript
const { getBcvRates } = require('bcv-exchange-rate');
```

## Ejemplo con caché y reintentos

```typescript
const bcv = await getBcvRates({
  currencies: ['USD', 'EUR'],
  retries: 3,
  retryDelayMs: 500,
  cacheTtlMs: 60_000,
  cacheStaleTtlMs: 10 * 60_000,
});

if (bcv.status.current === 'failed') {
  console.warn('Tasa actual no disponible; se usa el historial como alternativa');
}
```

## Documentación

La documentación extendida vive en [`docs/`](./docs/README.md):

### Primeros pasos

- [Guía de inicio](./docs/getting-started.md)
- [Ejemplos ejecutables](./docs/examples/README.md)

### Referencia

- [Referencia completa de la API](./docs/api-reference.md)
- [Arquitectura interna](./docs/architecture.md)

### Guías temáticas

- [Logging y observabilidad](./docs/guides/logging.md)
- [Manejo de errores](./docs/guides/errors.md)
- [Caché y resiliencia](./docs/guides/caching.md)
- [Reintentos y resiliencia](./docs/guides/retries.md)
- [Seguridad y TLS](./docs/guides/security.md)
- [Uso con TypeScript](./docs/guides/typescript.md)

### Operaciones

- [Solución de problemas](./docs/troubleshooting.md)

## Desarrollo

```bash
npm install
npm test             # Jest con cobertura del 100 % forzada.
npm run lint         # ESLint.
npm run format       # Prettier.
npm run build        # Dual CJS/ESM más declaraciones.
```

Más detalles en [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Seguridad

Reporta vulnerabilidades según lo descrito en [`SECURITY.md`](./SECURITY.md). **No abras incidencias públicas** para problemas de seguridad.

## Licencia

MIT © [José Carrillo](https://carrillo.app). Consulta el archivo [`LICENSE`](./LICENSE).
