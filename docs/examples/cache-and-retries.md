# Ejemplo: caché y reintentos

Configuración robusta para aplicaciones que sirven tráfico público.

```typescript
import { getBcvRates, BcvResponse } from 'bcv-exchange-rate';

const config = {
  retries: 3,
  retryDelayMs: 500,
  cacheTtlMs: 60_000, // Un minuto de fresh (valor por defecto).
  cacheStaleTtlMs: 30 * 60_000, // 30 minutos de stale-while-error.
  timeout: 15_000,
} as const;

export async function getCurrentRates(): Promise<BcvResponse> {
  return getBcvRates({
    ...config,
    currencies: ['USD', 'EUR'],
    includeHistory: false,
  });
}
```

**Comportamiento:**

- La primera llamada paga el coste completo (incluidos los reintentos si hay fallos transitorios).
- Las siguientes llamadas durante un minuto se sirven desde la caché en microsegundos.
- Cuando el _fresh_ expira, una nueva petición va al upstream. Si el BCV responde, se refresca la entrada.
- Si el BCV está caído, durante 30 minutos adicionales se sirve la última entrada buena acompañada de un `warn: "Serving stale cache after upstream failure"`.

**Métricas sugeridas (mediante `getCacheStats()`):**

- `hits / (hits + misses)`: tasa de aciertos.
- `staleServes`: tiempo acumulado en modo degradado; alerta si crece.
- Latencia p99: debe ser muy baja gracias a la caché.
- Ritmo de `warn: "Request failed, retrying"`.
