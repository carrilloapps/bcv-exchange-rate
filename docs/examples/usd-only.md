# Ejemplo: solo USD, sin historial

Optimizado para latencia mínima: una sola petición, una sola moneda.

```typescript
import { getBcvRates } from 'bcv-exchange-rate';

export async function fetchUsdRate(): Promise<number | undefined> {
  const bcv = await getBcvRates({
    currencies: 'USD',
    includeHistory: false,
  });
  return bcv.current.USD;
}
```

Perfecto para:

- Comprobaciones de latencia baja en APIs.
- _Widgets_ de dashboard que sólo muestran el dólar.
- Scripts que sólo necesitan la tasa oficial actual.
