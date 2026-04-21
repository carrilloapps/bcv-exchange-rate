# Ejemplo: historial paginado completo

Itera todas las páginas del historial bancario en un rango de días.

```typescript
import { getBcvHistory, BcvBankRate } from 'bcv-exchange-rate';

export async function collectAllHistory(days: number): Promise<BcvBankRate[]> {
  const all: BcvBankRate[] = [];
  let page = 0;

  while (true) {
    const { history, pagination } = await getBcvHistory({
      days,
      page,
      retries: 3,
      retryDelayMs: 1000,
    });

    all.push(...history);

    if (!pagination.hasNextPage) break;
    page += 1;
  }

  return all;
}

collectAllHistory(90).then((records) => {
  console.log(`Recuperados ${records.length} registros bancarios`);
});
```

**Recomendaciones:**

- Ajusta `cacheTtlMs` si vas a iterar varias veces seguidas.
- Considera introducir un retardo entre páginas para no presionar al BCV.
- El BCV pagina a través de la interfaz web; las ventanas amplias (`days > 60`) pueden requerir muchas páginas.
