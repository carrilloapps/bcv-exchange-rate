# Ejemplo: cron job diario

Tarea programada que se ejecuta cada mañana y persiste las tasas oficiales en tu base de datos.

```typescript
import { getBcvRates, getTrmRates, BcvExchangeError } from 'bcv-exchange-rate';

interface RateRecord {
  source: 'BCV' | 'TRM';
  currency: string;
  value: number;
  effectiveDate: string;
  fetchedAt: string;
}

export async function dailyRateJob(): Promise<void> {
  const fetchedAt = new Date().toISOString();
  const records: RateRecord[] = [];

  try {
    const bcv = await getBcvRates({
      includeHistory: false,
      retries: 5,
      retryDelayMs: 2000,
    });

    for (const [currency, value] of Object.entries(bcv.current)) {
      if (value !== undefined) {
        records.push({ source: 'BCV', currency, value, effectiveDate: bcv.effectiveDate, fetchedAt });
      }
    }
  } catch (err) {
    console.error('[cron] BCV failed:', err instanceof BcvExchangeError ? err.message : err);
  }

  try {
    const trm = await getTrmRates({ limit: 1, retries: 5, retryDelayMs: 2000 });
    if (trm) {
      records.push({
        source: 'TRM',
        currency: 'COP',
        value: trm.current.value,
        effectiveDate: trm.current.validityDate,
        fetchedAt,
      });
    }
  } catch (err) {
    console.error('[cron] TRM failed:', err instanceof BcvExchangeError ? err.message : err);
  }

  if (records.length === 0) {
    throw new Error('No rates could be fetched from any source');
  }

  await persist(records);
  console.log(`[cron] Persisted ${records.length} rate records`);
}

async function persist(records: RateRecord[]): Promise<void> {
  // Tu implementación: INSERT INTO rates ...
}
```

**Ejecución con un planificador:**

```typescript
import cron from 'node-cron';

cron.schedule('0 9 * * *', dailyRateJob); // todos los días a las 9:00.
```

**Notas:**

- Los dos bloques `catch` son independientes: que la TRM falle no debe impedir persistir los datos del BCV.
- `retries: 5` con un _backoff_ amplio es razonable en una tarea programada: no hay riesgo de bloquear tráfico interactivo.
- Un `records.length === 0` es un fallo total que justifica notificar al equipo de operaciones.
