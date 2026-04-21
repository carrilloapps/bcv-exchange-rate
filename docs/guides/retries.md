# Guía: reintentos y resiliencia

Los portales oficiales del BCV y de `datos.gov.co` no son infraestructuras con SLA garantizado. Los errores transitorios son comunes. Esta guía documenta el sistema de reintentos integrado.

## Comportamiento por defecto

```typescript
await getBcvRates();
// retries: 2, retryDelayMs: 400
// Intentos: inicial + 2 reintentos = 3 totales
// Esperas: 400 ms y 800 ms (backoff exponencial: base * 2^attempt)
```

## Configuración

```typescript
await getBcvRates({
  retries: 5, // intentos adicionales tras el inicial
  retryDelayMs: 1000, // base del backoff
});
// Esperas: 1000, 2000, 4000, 8000 y 16000 ms.
```

## Qué se reintenta

**Se reintenta:**

- Fallos de red (DNS, TCP, TLS).
- Respuestas HTTP 5xx (gracias a `validateStatus < 500`).
- Expiraciones de tiempo (_timeouts_).

**No se reintenta:**

- Respuestas 4xx (pasan el parseo directamente).
- Errores de parseo de HTML (no son transitorios).
- Errores de validación de entrada.

## Patrones

### Baja latencia, ráfaga corta

Aplicaciones interactivas que prefieren fallar rápido:

```typescript
await getBcvRates({ retries: 1, retryDelayMs: 200 });
// Máximo ~200 ms de espera.
```

### Procesos por lotes tolerantes

Scripts nocturnos que pueden esperar:

```typescript
await getBcvHistory({ retries: 6, retryDelayMs: 2000 });
// Esperas: 2 s, 4 s, 8 s, 16 s, 32 s, 64 s → hasta ~2 minutos antes de rendirse.
```

### Sin reintentos

Si quieres implementar tu propia política (_circuit breaker_, _bulkhead_):

```typescript
await getBcvHistory({ retries: 0 });
```

## Combinar reintentos con caché

Recomendado para aplicaciones que sirven a usuarios finales:

```typescript
await getBcvRates({
  retries: 3,
  retryDelayMs: 500,
  cacheTtlMs: 60_000,
  cacheStaleTtlMs: 15 * 60_000,
});
```

Si la primera llamada exitosa puebla la caché, los siguientes 60 segundos no pagan el coste de los reintentos. Cuando la caché expira, la siguiente invocación vuelve a aplicar los reintentos si hace falta, y el stale cubre hasta 15 minutos adicionales si el upstream cae por completo.

## Interacción con el _timeout_

El `timeout` aplica **por intento individual**, no al total. Con `timeout: 10_000` y `retries: 3`, el peor caso total es aproximadamente:

```text
10 s (intento 1) + 400 ms + 10 s (intento 2) + 800 ms + 10 s (intento 3) + 1600 ms + 10 s (intento 4) = ~43 s
```

Dimensiona en conjunto.

## Observabilidad

Cada reintento emite un `warn` con `url`, `attempt` y `delay`:

```json
{
  "level": "warn",
  "message": "Request failed, retrying",
  "url": "https://www.bcv.org.ve/tasas-informativas-sistema-bancario?...",
  "attempt": 0,
  "delay": 400
}
```

Alertar cuando el ritmo de _warns_ supera un umbral ayuda a detectar la degradación del BCV antes de que escale a fallo.

## Política externa (_circuit breaker_)

La librería no implementa _circuit breaking_. Si necesitas uno, envuelve las llamadas:

```typescript
import CircuitBreaker from 'opossum';
import { getBcvRates } from 'bcv-exchange-rate';

const breaker = new CircuitBreaker(() => getBcvRates({ retries: 1 }), {
  timeout: 30_000,
  errorThresholdPercentage: 50,
  resetTimeout: 60_000,
});

await breaker.fire();
```
