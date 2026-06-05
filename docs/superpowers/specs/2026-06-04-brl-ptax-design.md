# Diseño: integración del real brasileño (BRL) vía PTAX

**Fecha:** 2026-06-04
**Estado:** aprobado por el usuario (con restricción: cambio 100% aditivo, sin romper nada existente)

## Objetivo

Agregar a `bcv-exchange-rate` la tasa oficial del real brasileño (dólar PTAX del
Banco Central do Brasil), análoga a `getTrmRates` (Colombia), reutilizando la
infraestructura existente de la librería.

## Fuente oficial (verificada en vivo el 2026-06-04)

- API de datos abiertos del Banco Central do Brasil (Olinda/OData), sin autenticación:
  `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)`
- Parámetros de fecha en formato `MM-DD-YYYY` entre comillas simples.
- Respuesta JSON: `{ value: [{ cotacaoCompra, cotacaoVenda, dataHoraCotacao }] }`.
- `cotacaoCompra`/`cotacaoVenda` son BRL por USD; `dataHoraCotacao` con formato
  `YYYY-MM-DD HH:mm:ss.SSS`.
- Días sin cotización (fines de semana/feriados) simplemente no aparecen en el período.

## Restricción de compatibilidad (requisito del usuario)

El cambio es exclusivamente aditivo:

- No se modifica ninguna función, tipo, clase de error ni export existente.
- No se cambian valores por defecto ni comportamiento de `getBcvRates`,
  `getBcvHistory`, `getTrmRates` ni del subsistema de caché.
- Los tests existentes deben pasar sin modificación alguna.

## API pública nueva

```ts
/** Parámetros para la tasa PTAX de Brasil. */
export interface BrlParams extends RequestOptions {
  /** Ventana de días hacia atrás desde hoy. Debe ser >= 1. Default: 7. */
  days?: number;
}

/** Una cotización PTAX (BRL por USD). */
export interface BrlRate {
  /** cotacaoCompra. */
  buy: number;
  /** cotacaoVenda. */
  sell: number;
  /** dataHoraCotacao tal como la entrega la API (`YYYY-MM-DD HH:mm:ss.SSS`). */
  dateTime: string;
}

/** Respuesta estructurada para Brasil (PTAX). */
export interface BrlResponse {
  /** Cotización más reciente del período. */
  current: BrlRate;
  /** Resto del período, orden descendente por fecha/hora. */
  history: BrlRate[];
  /** Rango consultado en ISO 8601 (YYYY-MM-DD) y total de registros. */
  range: { startDate: string; endDate: string; count: number };
}

/** Lanzada exclusivamente por `getBrlRates` cuando la API del BCB falla. */
export class BrlApiError extends BcvExchangeError {}

export async function getBrlRates(params: BrlParams = {}): Promise<BrlResponse | null>;
```

## Comportamiento

1. `days` se valida con `assertPositiveInt(days, 'days', 1)` (lanza `ValidationError`).
2. Rango: `hoy - days` → `hoy`, formateado `MM-DD-YYYY` para la query y expuesto
   en `range` como ISO.
3. Query OData: `$orderby=dataHoraCotacao desc&$format=json` (la API ordena; la
   librería no reordena).
4. Reutiliza `resolveLogger`, `buildAxiosConfig`, `requestWithRetry` y `withCache`
   con clave `brl:<url>` — hereda timeout, retries, User-Agent, caché y
   stale-while-error sin código nuevo.
5. Respuesta OK con `value` vacío o ausente → `null` (mismo contrato que
   `getTrmRates` sin registros).
6. Cualquier fallo de red/transporte → `BrlApiError` envolviendo la causa
   (espejo de `TrmApiError`).
7. `current` = primer elemento (más reciente); `history` = resto.

## Errores

| Condición                               | Resultado                                             |
| --------------------------------------- | ----------------------------------------------------- |
| `days` inválido                         | `ValidationError`                                     |
| Red/timeout/5xx tras reintentos         | `BrlApiError` (causa adjunta)                         |
| API OK sin registros                    | `null` + `logger.warn`                                |
| Caché con stale válido y upstream caído | valor stale + `logger.warn` (heredado de `withCache`) |

## Tests (index.spec.ts, axios-mock-adapter, mismo estilo)

- Parseo de respuesta bien formada: `current`, `history`, `range.count`.
- Respuesta vacía (`{ value: [] }`) → `null`.
- Fallo de transporte → `BrlApiError` con `retries: 0`.
- `days` inválido → `ValidationError` (sin tocar la red).
- Caché: segunda llamada dentro del TTL no golpea la red.
- Cobertura de ramas al 100 % (umbral del proyecto).
- Verificación manual final contra la API real.

## Documentación

- README: sección "Brasil (PTAX)" junto a la de TRM, con ejemplo de uso.
- CHANGELOG: entrada de feature (minor: 1.1.0 — solo agrega API).

## Fuera de alcance (YAGNI)

- Otras monedas contra BRL (`CotacaoMoedaPeriodo`), boletines intradía, paridades.
- Rango explícito `startDate`/`endDate`.
- Abstracción genérica multi-país.
