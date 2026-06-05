# Ejemplo: dólar PTAX de Brasil

Consulta la cotización oficial USD/BRL (compra y venta) publicada por el Banco Central do Brasil, con ventana de días y paginación.

```typescript
import { getBrlRates } from 'bcv-exchange-rate';

// Última cotización disponible de la semana
const brl = await getBrlRates({ days: 7 });

if (!brl) {
  // La ventana solo abarcó días sin PTAX (fines de semana o feriados)
  console.log('Sin cotizaciones en la ventana consultada');
} else {
  console.log(`PTAX compra: ${brl.current.buy} | venta: ${brl.current.sell}`);
  console.log(`Publicada: ${brl.current.dateTime}`);
  console.log(`Ventana: ${brl.range?.startDate} → ${brl.range?.endDate}`);
}
```

## Paginar una ventana amplia

```typescript
// Las 5 cotizaciones más recientes del último mes, luego las 5 siguientes
const firstPage = await getBrlRates({ days: 30, limit: 5 });
const secondPage = await getBrlRates({ days: 30, limit: 5, offset: 5 });

console.log(firstPage?.pagination); // { limit: 5, offset: 0, page: null, count: 5, hasMore: null }
```

**Notas:**

- `getBrlRates` devuelve `null` cuando la ventana no contiene cotizaciones: trátalo como «sin datos», no como error.
- Sin `limit`, se devuelve la ventana completa (`pagination.limit: null`).
- PTAX publica una cotización de cierre por día hábil, alrededor de las 13:00 (hora de Brasilia).
