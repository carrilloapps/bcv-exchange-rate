# Ejemplo: endpoint Express

API HTTP que expone las tasas en formato JSON.

```typescript
import express from 'express';
import { getBcvRates, getTrmRates, NetworkError, TrmApiError } from 'bcv-exchange-rate';

const app = express();
const CACHE_MS = 60_000;

app.get('/api/rates/bcv', async (_req, res) => {
  try {
    const result = await getBcvRates({
      includeHistory: false,
      retries: 2,
      cacheTtlMs: CACHE_MS,
    });

    if (result.status.current === 'failed') {
      return res.status(503).json({ error: 'BCV temporarily unavailable' });
    }

    res.json({
      rates: result.current,
      effectiveDate: result.effectiveDate,
      cacheTtlMs: CACHE_MS,
    });
  } catch (err) {
    if (err instanceof NetworkError) {
      return res.status(503).json({ error: 'Upstream unavailable' });
    }
    throw err;
  }
});

app.get('/api/rates/trm', async (_req, res) => {
  try {
    const trm = await getTrmRates({ limit: 1, cacheTtlMs: CACHE_MS });
    if (!trm) return res.status(204).send();
    res.json(trm.current);
  } catch (err) {
    if (err instanceof TrmApiError) {
      return res.status(503).json({ error: 'Colombia TRM API unavailable' });
    }
    throw err;
  }
});

app.listen(3000);
```

**Buenas prácticas aplicadas:**

- Caché de 60 segundos para amortiguar la carga sobre el BCV.
- Códigos HTTP apropiados: `503` para el upstream caído y `204` cuando la TRM no tiene datos.
- Los errores desconocidos se propagan al manejador de Express por defecto.
