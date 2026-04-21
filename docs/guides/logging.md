# Guía: logging y observabilidad

`bcv-exchange-rate` no impone un logger concreto. Acepta cualquier objeto con la interfaz `Logger` (`info`, `debug`, `warn`, `error`). Esta guía muestra cómo integrarlo con los loggers más comunes.

## Niveles emitidos

| Nivel   | Cuándo                                                         |
| ------- | -------------------------------------------------------------- |
| `info`  | Inicio y fin exitoso de extracciones, métricas de alto nivel.  |
| `debug` | URL y número de intento de cada petición HTTP.                 |
| `warn`  | Parseo parcial, reintentos, tabla no encontrada, SSL relajado. |
| `error` | Fallo no recuperable de una sección o endpoint.                |

## Logger silencioso por defecto

Sin configuración, la librería no imprime nada. Puedes activar `console` con la variable de entorno:

```bash
BCV_DEBUG=1 node app.js
```

Esto sólo aplica cuando **no** has inyectado un `logger` propio.

## Integración con `winston`

`winston` está declarada como `peerDependency` opcional. Instálalo en tu proyecto:

```bash
npm install winston
```

```typescript
import winston from 'winston';
import { getBcvRates } from 'bcv-exchange-rate';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

await getBcvRates({ logger });
```

## Integración con `pino`

`pino` expone la misma forma (`info/debug/warn/error`), así que funciona directamente:

```typescript
import pino from 'pino';
import { getBcvRates } from 'bcv-exchange-rate';

const logger = pino({ level: 'debug' });
await getBcvRates({ logger });
```

## Integración con `bunyan`

```typescript
import bunyan from 'bunyan';
import { getBcvRates } from 'bcv-exchange-rate';

const logger = bunyan.createLogger({ name: 'bcv-integration' });
await getBcvRates({ logger });
```

## Adaptador para loggers personalizados

Si tu logger no tiene los cuatro métodos con la misma firma, escribe un adaptador mínimo:

```typescript
import type { Logger } from 'bcv-exchange-rate';

const toBcvLogger = (myLogger: MyLogger): Logger => ({
  info: (msg, meta) => myLogger.log('info', msg, meta),
  debug: (msg, meta) => myLogger.log('debug', msg, meta),
  warn: (msg, meta) => myLogger.log('warn', msg, meta),
  error: (msg, meta) => myLogger.log('error', msg, meta),
});

await getBcvRates({ logger: toBcvLogger(myLogger) });
```

## Uso directo de `console`

Para depuración rápida en desarrollo:

```typescript
await getBcvRates({ logger: console });
```

## Capturar sólo advertencias y errores

```typescript
const quietLogger: Logger = {
  info: () => {},
  debug: () => {},
  warn: (msg, meta) => console.warn(msg, meta),
  error: (msg, meta) => console.error(msg, meta),
};

await getBcvRates({ logger: quietLogger });
```

## Integración con stacks de observabilidad

### Datadog / New Relic / Sentry

Usa el logger de tu APM como `logger`:

```typescript
import * as Sentry from '@sentry/node';

const sentryLogger: Logger = {
  info: (msg, meta) => Sentry.addBreadcrumb({ level: 'info', message: msg, data: meta }),
  debug: (msg, meta) => Sentry.addBreadcrumb({ level: 'debug', message: msg, data: meta }),
  warn: (msg, meta) => Sentry.captureMessage(msg, { level: 'warning', extra: meta }),
  error: (msg, meta) => Sentry.captureMessage(msg, { level: 'error', extra: meta }),
};

await getBcvRates({ logger: sentryLogger });
```

## Qué registrar en producción

Recomendación mínima:

- `warn` y `error`: envíalos a la salida estándar estructurada y a tu sistema de alertas. Los `warn` de SSL relajado o de parseo inesperado son señales tempranas de que algo cambió en el BCV.
- `info`: a la salida estándar si quieres métricas de frecuencia.
- `debug`: desactivado; actívalo sólo para depuración puntual.
