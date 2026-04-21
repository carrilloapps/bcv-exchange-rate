# Guía: caché y resiliencia

La librería incluye una caché en memoria con TTL, modo _stale-while-error_ opcional, evicción LRU y un backend pluggable para quienes necesiten Redis u otras implementaciones. Esta guía explica cuándo y cómo usar cada pieza.

## Resumen rápido

```typescript
import { getBcvRates } from 'bcv-exchange-rate';

// Valor por defecto: caché activa durante 60 segundos para toda URL scrapeada.
const bcv = await getBcvRates();

// Aumentar el TTL a 5 minutos.
await getBcvRates({ cacheTtlMs: 5 * 60_000 });

// Desactivar la caché para esta llamada.
await getBcvRates({ cacheTtlMs: 0 });

// Tolerar la caída del BCV durante hasta 10 minutos sirviendo datos vencidos.
await getBcvRates({ cacheTtlMs: 60_000, cacheStaleTtlMs: 10 * 60_000 });
```

## Valores por defecto y controles básicos

Toda URL consultada se cachea durante **60 000 ms (un minuto)** por defecto, en un LRU en memoria compartido por el proceso.

| Opción            | Valor por defecto | Efecto                                                         |
| ----------------- | ----------------- | -------------------------------------------------------------- |
| `cacheTtlMs`      | `60000`           | TTL _fresh_. `0` desactiva completamente la caché.             |
| `cacheStaleTtlMs` | `0`               | Ventana extra en la que se sirve _stale_ si el upstream falla. |
| `cacheStore`      | LRU global        | Backend personalizado (ver más abajo).                         |

La caché **nunca cachea errores**. Si la petición falla, sólo se intenta servir un valor vencido cuando existe una entrada previa dentro de `cacheStaleTtlMs`.

## Estados posibles

Para una llamada con caché activa (`cacheTtlMs > 0`):

```mermaid
stateDiagram-v2
    [*] --> Fresh: respuesta exitosa del upstream
    Fresh --> Fresh: hit (la entrada se promueve en LRU)
    Fresh --> Stale: se alcanza expiresAt
    Stale --> Fresh: refresco exitoso del upstream
    Stale --> ServedStale: upstream falla<br/>y staleUntil > now
    ServedStale --> Stale: se emite warn y se devuelve<br/>el valor cacheado
    Stale --> Expired: se alcanza staleUntil
    Expired --> [*]: descartado o evictado por LRU
```

1. **Fresh hit.** Dentro de `expiresAt`: devuelve la caché sin tocar el upstream.
2. **Miss (_fresh_ vencido).** Va al upstream. Si responde, actualiza la caché; si falla, intenta servir _stale_.
3. **Stale serve.** La entrada sigue dentro de `staleUntil` y el upstream falló: devuelve el valor vencido y emite un `warn`.
4. **Hard miss.** No hay entrada, o bien se pasó `staleUntil`: propaga el error.

## Modo _stale-while-error_: resiliencia ante caídas del BCV

El BCV tiene ventanas de indisponibilidad frecuentes. La opción `cacheStaleTtlMs` permite degradar de forma elegante:

```typescript
// Devuelve la última tasa buena si el BCV está caído, hasta 15 minutos después de que expire el fresh.
const rates = await getBcvRates({
  cacheTtlMs: 60_000,
  cacheStaleTtlMs: 15 * 60_000,
});
```

Cuando se sirve una respuesta _stale_, la librería emite:

```json
{
  "level": "warn",
  "message": "Serving stale cache after upstream failure",
  "key": "bcv:current",
  "error": "Request failed after 1 attempts: Request failed with status code 500"
}
```

Monitorea esta línea para saber cuánto tiempo lleva caído el BCV antes de que te afecte realmente.

### Combinación recomendada para APIs en producción

```typescript
await getBcvRates({
  retries: 3,
  retryDelayMs: 500,
  cacheTtlMs: 60_000,
  cacheStaleTtlMs: 30 * 60_000,
});
```

Con esta configuración:

- Hasta **tres reintentos** automáticos por petición.
- La caché _fresh_ de **un minuto** evita golpear al BCV más de unas 60 veces por hora.
- El _stale_ de **30 minutos** mantiene tu endpoint respondiendo aunque el BCV caiga durante media hora.

## Evicción LRU

La caché por defecto usa una política **Least-Recently-Used** con un límite de entradas (200 por defecto). Al alcanzar el límite, la entrada usada menos recientemente se descarta.

Ajusta el tamaño instalando un nuevo store global:

```typescript
import { setDefaultCache, createInMemoryCache } from 'bcv-exchange-rate';

setDefaultCache(createInMemoryCache({ maxEntries: 1000 }));
```

O inyecta un store sólo para una llamada concreta (sin tocar el global):

```typescript
const myStore = createInMemoryCache({ maxEntries: 50 });
await getBcvRates({ cacheStore: myStore });
```

## Observabilidad: `getCacheStats` y `resetCacheStats`

```typescript
import { getCacheStats, resetCacheStats } from 'bcv-exchange-rate';

// Métricas agregadas desde la última llamada a resetCacheStats().
const stats = getCacheStats();
// { hits: 142, misses: 37, staleServes: 3, size: 18 }
```

| Campo         | Significado                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| `hits`        | Número total de llamadas servidas desde la caché fresca.                    |
| `misses`      | Llamadas que tuvieron que ir al upstream.                                   |
| `staleServes` | Llamadas degradadas que sirvieron caché _stale_ ante un fallo del upstream. |
| `size`        | Entradas actuales en la caché por defecto (no refleja los stores custom).   |

Úsalo para emitir métricas a Prometheus o Datadog:

```typescript
setInterval(() => {
  const s = getCacheStats();
  metrics.gauge('bcv.cache.hits', s.hits);
  metrics.gauge('bcv.cache.misses', s.misses);
  metrics.gauge('bcv.cache.stale_serves', s.staleServes);
  metrics.gauge('bcv.cache.size', s.size);
}, 30_000);
```

## Backend personalizado: la interfaz `CacheStore`

```typescript
interface CacheStore {
  readonly size: number;
  get(key: string): CacheEntry | undefined;
  set(key: string, entry: CacheEntry): void;
  delete(key: string): void;
  clear(): void;
}

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number; // epoch ms: deadline de fresh
  staleUntil: number; // epoch ms: deadline de stale
}
```

La interfaz es **síncrona** por diseño. Es un compromiso consciente:

- **A favor:** mantiene el flujo de llamada simple y rápido (un hit no hace un `await` innecesario).
- **En contra:** no puedes conectar Redis directamente. Si necesitas persistencia compartida entre procesos, escribe un **adaptador síncrono respaldado por una caché local**:

```typescript
import { CacheStore, CacheEntry, createInMemoryCache } from 'bcv-exchange-rate';
import { createClient } from 'redis';

const redis = createClient();
await redis.connect();

function redisBackedStore(localMaxEntries = 200): CacheStore {
  const local = createInMemoryCache({ maxEntries: localMaxEntries });

  return {
    get size() {
      return local.size;
    },
    get: (key) => local.get(key), // ruta síncrona rápida
    set: (key, entry) => {
      local.set(key, entry);
      // Envío a Redis en segundo plano para persistencia compartida.
      redis.setEx(`bcv:${key}`, Math.ceil((entry.staleUntil - Date.now()) / 1000), JSON.stringify(entry));
    },
    delete: (key) => {
      local.delete(key);
      redis.del(`bcv:${key}`);
    },
    clear: () => {
      local.clear();
      // Purga el prefijo en Redis si aplica.
    },
  };
}
```

Calentamiento de la caché local desde Redis al arrancar:

```typescript
async function warmFromRedis(store: CacheStore): Promise<void> {
  const keys = await redis.keys('bcv:*');
  for (const fullKey of keys) {
    const raw = await redis.get(fullKey);
    if (!raw) continue;
    const entry: CacheEntry = JSON.parse(raw);
    if (entry.staleUntil > Date.now()) {
      store.set(fullKey.replace(/^bcv:/, ''), entry);
    }
  }
}
```

## Claves de caché

Las claves son **deterministas** y se basan en la URL:

| Función         | Clave                                             |
| --------------- | ------------------------------------------------- |
| `getBcvRates`   | `bcv:current` (sólo la portada)                   |
| `getBcvHistory` | `bcv:history:<url completa, incluye page y days>` |
| `getTrmRates`   | `trm:<url completa, incluye limit y offset>`      |

Varios consumidores con distintos `cacheTtlMs` comparten la entrada: el primero que la puebla define el TTL efectivo hasta que expire.

Las claves son un detalle de implementación y pueden cambiar entre versiones menores. No construyas dependencias externas basándote en estos nombres.

## API de administración

```typescript
import {
  clearCache,
  createInMemoryCache,
  setDefaultCache,
  getDefaultCache,
  getCacheStats,
  resetCacheStats,
} from 'bcv-exchange-rate';
```

| Función                   | Qué hace                                                                 |
| ------------------------- | ------------------------------------------------------------------------ |
| `clearCache()`            | Vacía la caché por defecto. No toca los stores inyectados por llamada.   |
| `createInMemoryCache(o?)` | Crea un LRU en memoria nuevo. Útil para inyectarlo en llamadas aisladas. |
| `setDefaultCache(store)`  | Reemplaza la caché global por defecto. Ideal para backends con Redis.    |
| `getDefaultCache()`       | Devuelve la instancia actual de la caché por defecto. Útil en pruebas.   |
| `getCacheStats()`         | _Snapshot_ de contadores más el tamaño de la caché por defecto.          |
| `resetCacheStats()`       | Pone `hits`, `misses` y `staleServes` en cero. No toca las entradas.     |

## Casos de uso y configuraciones sugeridas

### API pública de bajo tráfico

```typescript
await getBcvRates({
  cacheTtlMs: 60_000,
  cacheStaleTtlMs: 5 * 60_000,
  retries: 2,
});
```

### Dashboard en tiempo real con muchos clientes

```typescript
await getBcvRates({
  cacheTtlMs: 30_000,
  cacheStaleTtlMs: 30 * 60_000,
  retries: 3,
});
```

### Proceso por lotes diario o reporte

```typescript
await getBcvRates({
  cacheTtlMs: 0,
  retries: 5,
  retryDelayMs: 2000,
});
// Sin caché: buscas dato fresco. Los reintentos largos son aceptables porque puedes esperar.
```

### Pruebas de integración

```typescript
await getBcvRates({ cacheTtlMs: 0 });
// Evita resultados inestables por caché cruzada entre pruebas.
```

## Consideraciones importantes

- **La caché vive en el heap del proceso.** No sobrevive a reinicios. Para persistencia, usa un `cacheStore` personalizado.
- **No hay invalidación fina.** La clave se basa en la URL; no puedes borrar «sólo USD» sin borrar toda la portada. Usa `clearCache()` o `store.delete(key)` manualmente.
- **Las estadísticas son globales al proceso.** No se reinician automáticamente; llama a `resetCacheStats()` en intervalos si las exportas.
- **`cacheStaleTtlMs: 0` desactiva el modo _stale-while-error_.** Un fallo tras la expiración del _fresh_ se propaga inmediatamente.
- **Los stores personalizados no se reflejan en `getCacheStats().size`.** Los contadores (`hits`, `misses` y `staleServes`) sí se actualizan porque son globales a `withCache`.
