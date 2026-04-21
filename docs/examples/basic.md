# Ejemplo: consulta básica

El caso más simple: obtener las tasas actuales y el historial con los valores por defecto.

```javascript
const { getBcvRates, getTrmRates } = require('bcv-exchange-rate');

(async () => {
  const bcv = await getBcvRates();
  console.log('Tasas BCV:', bcv.current);
  console.log('Vigencia:', bcv.effectiveDate);
  console.log(`Historial bancario: ${bcv.history.length} registros`);

  const trm = await getTrmRates({ limit: 1 });
  if (trm) {
    console.log('TRM:', trm.current.value, 'COP');
  }
})();
```

Salida típica:

```text
Tasas BCV: { USD: 48.16, EUR: 51.20, CNY: 6.65, TRY: 1.38, RUB: 0.52 }
Vigencia: 2026-04-21T00:00:00
Historial bancario: 48 registros
TRM: 3573.3 COP
```
