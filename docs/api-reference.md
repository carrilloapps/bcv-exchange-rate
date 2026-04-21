# Referencia de la API

Documentación exhaustiva de los símbolos exportados por `bcv-exchange-rate`.

## Tabla de contenido

- [Funciones](#funciones)
  - [`getBcvRates`](#getbcvrates)
  - [`getBcvHistory`](#getbcvhistory)
  - [`getTrmRates`](#gettrmrates)
  - [API de caché](#api-de-caché)
- [Interfaces de entrada](#interfaces-de-entrada)
  - [`RequestOptions`](#requestoptions)
  - [`BcvParams`](#bcvparams)
  - [`TrmParams`](#trmparams)
- [Interfaces de respuesta](#interfaces-de-respuesta)
  - [`BcvResponse`](#bcvresponse)
  - [`BcvBankRate`](#bcvbankrate)
  - [`TrmResponse`](#trmresponse)
- [Interfaces de caché](#interfaces-de-caché)
  - [`CacheEntry`](#cacheentry)
  - [`CacheStore`](#cachestore)
  - [`CacheStats`](#cachestats)
- [Tipos](#tipos)
  - [`Currency`](#currency)
  - [`SectionStatus`](#sectionstatus)
  - [`Logger`](#logger)
- [Clases de error](#clases-de-error)

---

## Funciones

### `getBcvRates`

```typescript
function getBcvRates(params?: BcvParams): Promise<BcvResponse>;
```

Obtiene las tasas oficiales actuales del Banco Central de Venezuela y, opcionalmente, el historial de tasas informativas del sistema bancario.

**Comportamiento:**

- Si `includeCurrent` es `true` (default), consulta `https://www.bcv.org.ve/`.
- Si `includeHistory` es `true` (default), delega a [`getBcvHistory`](#getbcvhistory).
- Si una sección falla pero la otra se pidió también, la función **no lanza**: marca `status.<sección>: 'failed'` y retorna los datos disponibles.
- Si la única sección pedida falla, la función lanza la excepción correspondiente.

**Lanza:**

- `ValidationError`: `days < 1` o `page < 0`.
- `NetworkError`: fallo transitorio no recuperado tras los reintentos, con todas las secciones solicitadas fallidas.

**Ejemplo:**

```typescript
const result = await getBcvRates({
  currencies: ['USD', 'EUR'],
  days: 14,
  page: 0,
  retries: 3,
  cacheTtlMs: 60_000,
});

if (result.status.current === 'failed') {
  console.warn('Tasa actual no disponible; se usa el historial');
}
```

---

### `getBcvHistory`

```typescript
function getBcvHistory(params?: BcvParams): Promise<Pick<BcvResponse, 'history' | 'pagination'>>;
```

Obtiene únicamente el histórico bancario. Útil para reportes o auditorías que no necesitan la portada.

**Lanza:**

- `ValidationError`: `days < 1` o `page < 0`.
- `NetworkError`: la petición no pudo recuperarse.

**Ejemplo:**

```typescript
const { history, pagination } = await getBcvHistory({ days: 30, page: 2 });
```

---

### `getTrmRates`

```typescript
function getTrmRates(params?: TrmParams): Promise<TrmResponse | null>;
```

Consulta la Tasa Representativa del Mercado de Colombia publicada por la Superintendencia Financiera en `datos.gov.co`.

**Retorna:** `null` cuando la API responde con una colección vacía o con una carga no iterable.

**Lanza:**

- `ValidationError`: `limit` fuera del rango `[1, 1000]` o `offset < 0`.
- `TrmApiError`: el endpoint respondió con error o falló la red.

**Ejemplo:**

```typescript
const trm = await getTrmRates({ limit: 30 });
if (trm) {
  console.log(`TRM actual: ${trm.current.value} COP`);
}
```

---

### API de caché

La librería activa la caché por defecto (60 s). Estas funciones permiten administrarla.

```typescript
function clearCache(): void;
function createInMemoryCache(options?: { maxEntries?: number }): CacheStore;
function setDefaultCache(store: CacheStore): void;
function getDefaultCache(): CacheStore;
function getCacheStats(): CacheStats;
function resetCacheStats(): void;
```

| Función                   | Descripción                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `clearCache()`            | Vacía la caché por defecto. No toca los stores inyectados por llamada.              |
| `createInMemoryCache(o?)` | Factoría LRU en memoria con `maxEntries` (valor por defecto `200`, mínimo 1).       |
| `setDefaultCache(store)`  | Reemplaza la caché global por defecto. Útil para instalar un backend personalizado. |
| `getDefaultCache()`       | Devuelve la instancia actual de la caché por defecto.                               |
| `getCacheStats()`         | Snapshot inmutable: `{ hits, misses, staleServes, size }`.                          |
| `resetCacheStats()`       | Reinicia los contadores globales. No borra entradas.                                |

Guía completa: [Caché y resiliencia](./guides/caching.md).

---

## Interfaces de entrada

### `RequestOptions`

Opciones compartidas por todas las funciones públicas.

| Propiedad         | Tipo                        | Default      | Descripción                                                                          |
| ----------------- | --------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| `timeout`         | `number`                    | `25000`      | Tiempo máximo HTTP en milisegundos.                                                  |
| `strictSSL`       | `boolean`                   | `true`       | Si es `false`, se desactiva la validación TLS y se emite un `warn`.                  |
| `userAgent`       | `string`                    | UA de Chrome | Cabecera `User-Agent`.                                                               |
| `logger`          | [`Logger`](#logger)         | Silencioso   | Logger basado en interfaz. Con `BCV_DEBUG` definido, usa `console` si no se inyecta. |
| `retries`         | `number`                    | `2`          | Intentos adicionales ante fallo transitorio (total = `retries + 1`).                 |
| `retryDelayMs`    | `number`                    | `400`        | Retardo base del backoff exponencial (`base * 2^attempt`).                           |
| `cacheTtlMs`      | `number`                    | `60000`      | TTL _fresh_. `0` desactiva la caché para esta llamada.                               |
| `cacheStaleTtlMs` | `number`                    | `0`          | Ventana extra (ms) para servir _stale_ si el upstream falla.                         |
| `cacheStore`      | [`CacheStore`](#cachestore) | LRU global   | Backend personalizado para esta llamada. Sin él, usa el global por defecto.          |

### `BcvParams`

Extiende [`RequestOptions`](#requestoptions).

| Propiedad        | Tipo                     | Default | Descripción                                |
| ---------------- | ------------------------ | ------- | ------------------------------------------ |
| `currencies`     | `Currency \| Currency[]` | Todas   | Filtra el bloque `current`.                |
| `includeCurrent` | `boolean`                | `true`  | Consulta la portada.                       |
| `includeHistory` | `boolean`                | `true`  | Consulta el histórico bancario.            |
| `days`           | `number`                 | `7`     | Rango en días (≥ 1) hacia atrás desde hoy. |
| `page`           | `number`                 | `0`     | Número de página (≥ 0) del histórico.      |

### `TrmParams`

Extiende [`RequestOptions`](#requestoptions).

| Propiedad | Tipo     | Default | Descripción                              |
| --------- | -------- | ------- | ---------------------------------------- |
| `limit`   | `number` | `10`    | Registros a devolver. Rango `[1, 1000]`. |
| `offset`  | `number` | `0`     | Desplazamiento para paginar.             |

---

## Interfaces de respuesta

### `BcvResponse`

```typescript
interface BcvResponse {
  current: Partial<Record<Currency, number>>;
  effectiveDate: string;
  history: BcvBankRate[];
  pagination: {
    currentPage: number;
    hasNextPage: boolean;
  };
  status: {
    current: SectionStatus;
    history: SectionStatus;
  };
}
```

`status` permite distinguir tres casos por sección:

- `'ok'`: la sección se completó con éxito.
- `'skipped'`: la sección no se solicitó (`includeCurrent: false` o `includeHistory: false`).
- `'failed'`: la sección se solicitó, pero falló; los demás campos quedan vacíos.

### `BcvBankRate`

```typescript
interface BcvBankRate {
  date: string; // ISO 8601 (YYYY-MM-DD) cuando se reconoce el formato
  bank: string;
  buy: number | null; // null si no pudo parsearse
  sell: number | null;
}
```

### `TrmResponse`

```typescript
interface TrmResponse {
  current: {
    value: number;
    unit: string;
    validityDate: string;
  };
  history: Array<{
    value: number;
    validityDate: string;
  }>;
  pagination: {
    limit: number;
    offset: number;
    count: number;
  };
}
```

---

## Interfaces de caché

### `CacheEntry`

```typescript
interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number; // epoch ms: límite de fresh hit
  staleUntil: number; // epoch ms: límite para servir stale-on-error
}
```

### `CacheStore`

```typescript
interface CacheStore {
  readonly size: number;
  get(key: string): CacheEntry | undefined;
  set(key: string, entry: CacheEntry): void;
  delete(key: string): void;
  clear(): void;
}
```

Backend pluggable para la caché. La interfaz es **síncrona**; para backends asíncronos (Redis, DynamoDB) escribe un adaptador con una caché local síncrona. Ejemplo completo en la [guía de caché](./guides/caching.md#backend-custom-la-interfaz-cachestore).

### `CacheStats`

```typescript
interface CacheStats {
  hits: number; // total de llamadas servidas desde la caché fresh
  misses: number; // llamadas que tuvieron que ir al upstream
  staleServes: number; // llamadas degradadas sirviendo caché stale
  size: number; // entradas en la caché por defecto (no refleja stores custom)
}
```

---

## Tipos

### `Currency`

```typescript
type Currency = 'USD' | 'EUR' | 'CNY' | 'TRY' | 'RUB';
```

Unión literal de monedas soportadas. TypeScript detectará errores de tipo al pasar valores no válidos.

### `SectionStatus`

```typescript
type SectionStatus = 'ok' | 'skipped' | 'failed';
```

### `Logger`

```typescript
interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
```

Compatible con `console`, `winston`, `pino`, `bunyan` y la mayoría de loggers. Consulta la [guía de logging](./guides/logging.md) para ejemplos de adaptación.

---

## Clases de error

Todas heredan de `BcvExchangeError`, que a su vez extiende `Error`.

```mermaid
classDiagram
    class Error {
        <<builtin>>
    }
    class BcvExchangeError {
        <<abstract>>
        +cause: unknown
    }
    class NetworkError {
        Fallo de red tras agotar los reintentos
    }
    class ParseError {
        HTML inesperado (reservado)
    }
    class ValidationError {
        Parámetros inválidos
    }
    class TrmApiError {
        Fallo específico de la API de Colombia
    }

    Error <|-- BcvExchangeError
    BcvExchangeError <|-- NetworkError
    BcvExchangeError <|-- ParseError
    BcvExchangeError <|-- ValidationError
    BcvExchangeError <|-- TrmApiError
```

Detalles y patrones de captura en la [guía de manejo de errores](./guides/errors.md).
