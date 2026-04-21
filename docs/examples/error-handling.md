# Ejemplo: manejo de errores robusto

Patrón completo para un caso de uso crítico (pagos, contabilidad).

```typescript
import {
  getBcvRates,
  NetworkError,
  ValidationError,
  BcvExchangeError,
  type BcvResponse,
} from 'bcv-exchange-rate';

interface RateResult {
  rates: Partial<BcvResponse['current']>;
  source: 'live' | 'partial' | 'cache' | 'unavailable';
  errors?: string[];
}

export async function fetchRatesSafe(): Promise<RateResult> {
  try {
    const result = await getBcvRates({
      retries: 3,
      retryDelayMs: 1000,
      cacheTtlMs: 60_000,
    });

    const bothFailed = result.status.current === 'failed' && result.status.history === 'failed';
    if (bothFailed) {
      return { rates: {}, source: 'unavailable', errors: ['Both sections failed'] };
    }

    if (result.status.current === 'failed') {
      return { rates: {}, source: 'partial', errors: ['Current rates unavailable'] };
    }

    return { rates: result.current, source: 'live' };
  } catch (err) {
    if (err instanceof ValidationError) {
      throw err; // error del código llamador, no se oculta
    }
    if (err instanceof NetworkError) {
      return { rates: {}, source: 'unavailable', errors: [err.message] };
    }
    if (err instanceof BcvExchangeError) {
      return { rates: {}, source: 'unavailable', errors: [err.message] };
    }
    throw err; // desconocido, se propaga
  }
}
```

**Decisiones:**

- `ValidationError` se propaga: es un error del código llamador, no un fallo operacional.
- `NetworkError` se degrada: el servicio se reporta como no disponible.
- Los estados parciales (`status.current === 'failed'`) se exponen al consumidor para que decida si usar el historial como alternativa.
