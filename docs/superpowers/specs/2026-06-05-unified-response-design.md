# Diseño: contrato de respuesta unificado (v2.0.0)

**Fecha:** 2026-06-05
**Estado:** aprobado por el usuario (breaking limpio; BCV conserva `page` nativa)

## Objetivo

Que `getBcvRates`, `getBcvHistory`, `getTrmRates` y `getBrlRates` compartan la misma
estructura de salida — especialmente la paginación — y la misma capacidad de
parametrización, admitiendo variaciones solo en lo inherente a cada fuente.

## Contrato unificado

### Bloque `pagination` (idéntico en las tres fuentes)

```ts
export interface Pagination {
  /** Tamaño de página solicitado. `null` si no se solicitó o no aplica (BCV). */
  limit: number | null;
  /** Desplazamiento solicitado. `null` cuando la fuente pagina por página (BCV). */
  offset: number | null;
  /** Número de página solicitado. `null` cuando la fuente pagina por limit/offset (TRM/BRL). */
  page: number | null;
  /** Registros devueltos por la fuente en esta respuesta. */
  count: number;
  /** Si existen más registros aguas arriba. `null` cuando la fuente no puede saberlo. */
  hasMore: boolean | null;
}
```

| Fuente | `limit`/`offset`                      | `page` | `hasMore`               |
| ------ | ------------------------------------- | ------ | ----------------------- |
| BCV    | `null` (pagina por página del portal) | real   | real (pager del portal) |
| TRM    | reales                                | `null` | `null`                  |
| BRL    | reales (`limit: null` si no se pidió) | `null` | `null`                  |

### Bloque `range` (idéntico en las tres fuentes)

`{ startDate, endDate } | null` en ISO 8601 — la ventana de días aplicada.
`null` cuando no se aplicó ventana (TRM sin `days`, BCV con `includeHistory: false`).

### Parámetros

| Parámetro                                                     | BCV            | TRM                                                            | BRL            |
| ------------------------------------------------------------- | -------------- | -------------------------------------------------------------- | -------------- |
| `days`                                                        | ✅ (default 7) | ✅ nuevo, opcional sin default (vía `$where vigenciahasta >=`) | ✅ (default 7) |
| `limit` / `offset`                                            | — (usa `page`) | ✅                                                             | ✅             |
| `page`                                                        | ✅             | —                                                              | —              |
| `currencies`, `includeCurrent`, `includeHistory`, `strictSSL` | ✅             | —                                                              | —              |
| `RequestOptions` (timeout, retries, caché, logger)            | ✅             | ✅                                                             | ✅             |

## Cambios breaking (migración 1.x → 2.0)

- `BcvResponse.pagination`: `{ currentPage, hasNextPage }` → `Pagination`
  (`currentPage` → `page`, `hasNextPage` → `hasMore`).
- `BcvResponse.range`: nuevo (`null` si el histórico se omitió o falló).
- `TrmResponse.pagination`: gana `page: null` y `hasMore: null`.
- `TrmResponse.range`: nuevo (`null` sin `days`).
- `BrlResponse.range`: pierde `count` (vive solo en `pagination`) y puede tiparse
  igual que el resto.
- `BrlResponse.pagination`: gana `page: null` y `hasMore: null`.

Lo que NO cambia: nombres de funciones, parámetros existentes, formas de `current`
e ítems de `history` de cada fuente, jerarquía de errores, caché y reintentos.

## Superficies derivadas

- CLI: `trm` gana `--days`. Versión 2.0.0.
- MCP: `get_trm_rates` gana atributo `days`. Versión 2.0.0.
- README: tablas de atributos + sección "Estructura de respuesta" comparando las tres fuentes.
- CHANGELOG: sección de migración.

## Fuera de alcance

- Emular `limit`/`offset` en BCV agregando páginas del portal (decisión explícita:
  `page` nativa es más fiel y evita requests extra).
- Unificar la forma de `current` (multi-moneda BCV vs valor TRM vs compra/venta BRL
  son inherentemente distintas).
