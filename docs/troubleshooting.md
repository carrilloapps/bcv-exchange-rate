# Solución de problemas

Problemas comunes y cómo diagnosticarlos.

## `NetworkError: ... certificate`

**Causa:** `strictSSL` está en `true` por defecto y la cadena de certificados del BCV no valida en tu entorno.

**Diagnóstico:**

```bash
curl -vI https://www.bcv.org.ve/
```

Si ves `certificate has expired` o `self signed certificate`, el BCV está sirviendo certificados inválidos (es común).

**Soluciones:**

1. Desactivar de forma consciente: `await getBcvRates({ strictSSL: false })`.
2. Añadir tu CA corporativa a Node: `NODE_EXTRA_CA_CERTS=/ruta/a/ca.pem`.
3. Verificar el reloj del sistema: un reloj desfasado invalida certificados válidos.

Consulta la [guía de seguridad](./guides/security.md).

## `result.current` está vacío sin error

**Causa:** el BCV sirvió una página sin los elementos esperados (mantenimiento, redirección, error disfrazado con un 200).

**Diagnóstico:**

```typescript
await getBcvRates({ logger: console });
// Busca advertencias: "Unparseable rate text" o respuestas 4xx.
```

**Soluciones:**

- Verificar manualmente `https://www.bcv.org.ve/`.
- Aumentar `retries` si el fallo es intermitente.
- Ajustar `cacheTtlMs` o `cacheStaleTtlMs` para amortiguar.

## `result.status.history === 'failed'` de forma recurrente

**Causa:** el endpoint de tasas informativas es más propenso a devolver 5xx que la portada principal.

**Soluciones:**

- Bajar `days` (los rangos grandes fallan con mayor frecuencia).
- Paginar con `page` si estás consultando muchos registros.
- Subir `retries` a entre 3 y 5, con `retryDelayMs: 1000`.

## El parseo devuelve `null` en todos los bancos

**Causa:** el BCV cambió el formato del número o el selector de la tabla.

**Diagnóstico:**

```typescript
const result = await getBcvHistory({ logger: console });
// Busca advertencias: "BCV history table selector did not match".
```

**Solución:** abre una incidencia en GitHub con la fecha aproximada. Es probable que el selector `table.views-table` necesite actualizarse.

## `TrmApiError` con 404

**Causa:** `datos.gov.co` cambió el identificador del dataset (no ha ocurrido desde 2019, pero es posible).

**Diagnóstico:**

```bash
curl 'https://www.datos.gov.co/resource/mcec-87by.json?$limit=1'
```

Si retorna 404, el dataset se renombró. Abre una incidencia en GitHub.

## `getTrmRates` retorna `null`

**Causa:** la API respondió con un HTTP 200 y `[]`. **No es un error.**

Casos esperados:

- Consulta con `offset` mayor al total de registros.
- Primer día hábil del año, antes de que se publique la TRM.

**Solución:** valida siempre `!== null` antes de usar el resultado:

```typescript
const trm = await getTrmRates();
if (!trm) {
  return fallbackValue;
}
```

## Los reintentos no tienen efecto

**Causa:** tu error es un `ValidationError`, que no se reintenta por diseño (no es transitorio).

**Diagnóstico:**

```typescript
try {
  await getBcvRates({ days: -1, retries: 10 });
} catch (err) {
  console.log(err.constructor.name); // "ValidationError"
}
```

**Solución:** valida las entradas antes de llamar a la función.

## La caché «no funciona»

**Causa 1:** `cacheTtlMs: 0` desactiva la caché para esa llamada.

```typescript
await getBcvRates(); // caché activa, default 60 segundos
await getBcvRates({ cacheTtlMs: 0 }); // sin caché para esta llamada
await getBcvRates({ cacheTtlMs: 5 * 60_000 }); // 5 minutos
```

**Causa 2:** las llamadas con URLs distintas (`days` o `page` diferentes) no comparten entradas de caché.

**Causa 3:** el proceso se reinició. La caché vive en memoria, por proceso; inyecta un `cacheStore` respaldado por Redis si necesitas persistencia.

## Las pruebas fallan en CI por la advertencia de `strictSSL: false`

**Causa:** tu spec no silencia el logger y el `warn` contamina la salida.

**Solución:** pasa un logger silencioso en las pruebas:

```typescript
const silent = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
await getBcvRates({ strictSSL: false, logger: silent });
```

## Activar logs detallados para depuración

```bash
BCV_DEBUG=1 node app.js
```

O inyecta `console` como logger:

```typescript
await getBcvRates({ logger: console });
```

## Cómo reportar un error

1. Confirma que el problema no está en la lista anterior.
2. Reúne: versión de la librería, versión de Node, código mínimo reproducible y _timestamp_.
3. Abre una [incidencia en GitHub](https://github.com/carrilloapps/bcv-exchange-rate/issues) usando la plantilla de bug.
