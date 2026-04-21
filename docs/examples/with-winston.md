# Ejemplo: integración con winston

Logs estructurados listos para producción.

```bash
npm install winston
```

```typescript
import winston from 'winston';
import { getBcvRates } from 'bcv-exchange-rate';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'bcv-integration' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

await getBcvRates({ logger, retries: 3 });
```

Salida:

```json
{"level":"info","message":"Starting BCV extraction","service":"bcv-integration","timestamp":"2026-04-21T14:32:01.234Z","days":7,"page":0,"includeCurrent":true,"includeHistory":true}
{"level":"debug","message":"HTTP request","service":"bcv-integration","timestamp":"2026-04-21T14:32:01.245Z","url":"https://www.bcv.org.ve/","attempt":0}
{"level":"info","message":"BCV history retrieved","service":"bcv-integration","timestamp":"2026-04-21T14:32:02.891Z","count":12,"hasNextPage":false}
```
