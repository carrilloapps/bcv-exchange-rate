# Guía: uso con TypeScript

La librería está escrita en TypeScript y distribuye declaraciones `.d.ts`. Esta guía cubre patrones idiomáticos para aprovechar el tipado.

## Importación

```typescript
import {
  // Funciones
  getBcvRates,
  getBcvHistory,
  getTrmRates,
  clearCache,
  createInMemoryCache,
  setDefaultCache,
  getDefaultCache,
  getCacheStats,
  resetCacheStats,
  // Interfaces de entrada
  BcvParams,
  TrmParams,
  RequestOptions,
  // Interfaces de respuesta
  BcvResponse,
  BcvBankRate,
  TrmResponse,
  // Interfaces de caché
  CacheEntry,
  CacheStore,
  CacheStats,
  // Tipos utilitarios
  Currency,
  SectionStatus,
  Logger,
  // Errores
  BcvExchangeError,
  NetworkError,
  TrmApiError,
  ValidationError,
  ParseError,
} from 'bcv-exchange-rate';
```

## `Currency` como unión literal

Las monedas soportadas están tipadas:

```typescript
type Currency = 'USD' | 'EUR' | 'CNY' | 'TRY' | 'RUB';

await getBcvRates({ currencies: 'USD' }); // correcto
await getBcvRates({ currencies: ['USD', 'EUR'] }); // correcto
await getBcvRates({ currencies: 'BRL' }); // error de tipo en compilación
```

### _Narrowing_ en `current`

```typescript
const result = await getBcvRates({ currencies: ['USD', 'EUR'] });

// `current` es Partial<Record<Currency, number>>, por lo que USD puede ser undefined.
if (result.current.USD !== undefined) {
  const dolar: number = result.current.USD;
}
```

### Iterar las monedas soportadas de forma _type-safe_

```typescript
const ALL_CURRENCIES: readonly Currency[] = ['USD', 'EUR', 'CNY', 'TRY', 'RUB'] as const;

for (const code of ALL_CURRENCIES) {
  const rate = result.current[code];
  if (rate !== undefined) {
    console.log(`${code}: ${rate}`);
  }
}
```

## Discriminar `status`

`SectionStatus` es una unión literal:

```typescript
type SectionStatus = 'ok' | 'skipped' | 'failed';

if (result.status.current === 'failed') {
  // ...
}
```

## Capturar errores tipados

En modo `strict`, `catch` devuelve `unknown`. Utiliza `instanceof`:

```typescript
try {
  await getBcvRates();
} catch (err: unknown) {
  if (err instanceof NetworkError) {
    // err.cause es unknown: contiene el error original envuelto.
    logger.error('Red caída', { cause: err.cause });
  } else if (err instanceof ValidationError) {
    logger.error('Entrada inválida', { message: err.message });
  } else {
    throw err;
  }
}
```

## Implementar `Logger`

```typescript
import type { Logger } from 'bcv-exchange-rate';

class MyAppLogger implements Logger {
  info(msg: string, meta?: Record<string, unknown>): void {
    /* ... */
  }
  debug(msg: string, meta?: Record<string, unknown>): void {
    /* ... */
  }
  warn(msg: string, meta?: Record<string, unknown>): void {
    /* ... */
  }
  error(msg: string, meta?: Record<string, unknown>): void {
    /* ... */
  }
}
```

## Implementar `CacheStore`

```typescript
import type { CacheStore, CacheEntry } from 'bcv-exchange-rate';

class MyCacheStore implements CacheStore {
  private readonly map = new Map<string, CacheEntry>();
  get size(): number {
    return this.map.size;
  }
  get(key: string): CacheEntry | undefined {
    return this.map.get(key);
  }
  set(key: string, entry: CacheEntry): void {
    this.map.set(key, entry);
  }
  delete(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}
```

## Extender tipos para tu aplicación

Si necesitas añadir metadatos a la respuesta (por ejemplo, una marca de tiempo propia):

```typescript
import type { BcvResponse } from 'bcv-exchange-rate';

interface EnrichedBcvResponse extends BcvResponse {
  fetchedAt: string;
  source: 'live' | 'cache';
}

function enrich(data: BcvResponse, source: 'live' | 'cache'): EnrichedBcvResponse {
  return { ...data, fetchedAt: new Date().toISOString(), source };
}
```

## `tsconfig` recomendado para consumidores

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

La librería funciona tanto con `module: "commonjs"` como con `module: "NodeNext"` gracias al campo `exports`.

## Dual CJS y ESM

La librería publica ambos formatos:

- `require('bcv-exchange-rate')` → bundle CJS en `dist/cjs/index.js`.
- `import ... from 'bcv-exchange-rate'` → bundle ESM en `dist/esm/index.js`.

Los tipos se emiten una sola vez en `dist/types/` y se comparten entre ambos formatos.
