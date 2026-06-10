# Registro de cambios

Todos los cambios notables de **bcv-exchange-rate** se documentan en este archivo.

El formato sigue [Keep a Changelog 1.1.0](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto se rige por [Versionado semántico](https://semver.org/lang/es/).

## [2.0.1] - 2026-06-10

### Corregido

- **`Cannot find module 'ajv'` al ejecutar el servidor MCP vía `npx`**: `@modelcontextprotocol/sdk` usa `ajv-formats`, que declara `ajv` como _peerDependency_ opcional y por tanto no se instala de forma transitiva. En instalaciones limpias (`npx -y`) `ajv-formats` quedaba hoisteado junto a un `ajv` incompatible (v6) o ausente, rompiendo el arranque del binario. Se declaran `ajv@^8.17.1` y `ajv-formats@^3.0.1` como dependencias directas para garantizar su presencia y resolución en la raíz de `node_modules`.

## [2.0.0] - 2026-06-05

### Cambiado (BREAKING)

Contrato de respuesta unificado: las tres fuentes comparten ahora el mismo esqueleto de salida con un bloque `pagination` idéntico (`{ limit, offset, page, count, hasMore }`, con `null` en los campos que no aplican a la fuente) y un bloque `range` (`{ startDate, endDate } | null`) con la ventana de días aplicada.

Guía de migración 1.x → 2.0:

- **`BcvResponse.pagination`**: `{ currentPage, hasNextPage }` → `{ limit: null, offset: null, page, count, hasMore }`. Renombra `currentPage` → `page` y `hasNextPage` → `hasMore`.
- **`TrmResponse.pagination`**: gana `page: null` y `hasMore: null` (los campos existentes `limit`/`offset`/`count` no cambian).
- **`BrlResponse.range`**: pierde `count` (vive únicamente en `pagination.count`).
- **`BrlResponse.pagination`**: gana `page: null` y `hasMore: null`.
- Nuevos tipos exportados `Pagination` y `DateRange`.
- Sin cambios en: nombres de funciones, parámetros existentes, formas de `current` e ítems de `history`, jerarquía de errores, caché y reintentos.

### Añadido

- **`TlsError`** (subclase de `NetworkError`): los fallos de certificado TLS (expirado, autofirmado, cadena incompleta) fallan rápido sin gastar reintentos y el mensaje recomienda la salida (`strictSSL: false` en librería/tools MCP, sin `--strict-ssl` en la CLI).
- **Eco `strictSSL` en las tres respuestas**: el campo indica la política TLS efectiva de la llamada; `false` marca la data como obtenida sin validación de certificados.
- **`days` en `getTrmRates`**: ventana de días hacia atrás vía `$where vigenciahasta >=` (sin default: el comportamiento previo se mantiene si no se pasa). Disponible también como `--days` en la CLI y atributo `days` en la tool MCP `get_trm_rates`.
- **`range` en las tres respuestas**: ventana de fechas aplicada en ISO 8601 (`null` cuando no aplica).
- **`pagination.count` y `pagination.hasMore` en BCV**: total de filas devueltas y si el portal reporta más páginas.

### Interno

- **Arquitectura modular**: el código fuente pasa de un único `index.ts` a módulos por responsabilidad bajo `src/` (`types`, `errors`, `validation`, `format`, `logger`, `cache`, `http` y `sources/{bcv,trm,brl}`), con la CLI y el servidor MCP como puntos de entrada separados. La API pública no cambia por esta reorganización (la describe la sección _breaking_ de arriba).
- Documentación extendida (`docs/`) actualizada por completo: referencia de API con el contrato unificado, arquitectura con la estructura de módulos y nuevos ejemplos de PTAX y CLI/MCP.

## [1.3.0] - 2026-06-05

### Añadido

- **Paginación en `getBrlRates`**: parámetros opcionales `limit` (1-1000, OData `$top`) y `offset` (`$skip`), homogéneos con `getTrmRates`. La respuesta incluye un bloque `pagination: { limit, offset, count }` donde `limit` es `null` cuando no se solicitó (se devolvió la ventana completa). El comportamiento por defecto no cambia: sin `limit`, la ventana se devuelve íntegra.
- Flags `--limit` y `--offset` en el comando `brl` de la CLI y atributos `limit`/`offset` en la tool MCP `get_brl_rates`.

## [1.2.0] - 2026-06-05

### Añadido

- **Modo CLI**: `npx bcv-exchange-rate [comando] [flags]` imprime el resultado como JSON y termina. Comandos: `bcv` (por defecto), `history`, `trm` y `brl`, con flags por comando (`--currencies`, `--days`, `--page`, `--limit`, `--offset`, `--no-current`, `--no-history`, `--strict-ssl`) y globales (`--timeout`, `--retries`, `--help`, `--version`).
- **Alias global `xrate`**: con `npm install -g bcv-exchange-rate`, `xrate` equivale al binario principal.
- **Detección de contexto en el binario**: en una terminal interactiva sin argumentos ejecuta la consulta BCV por defecto; cuando lo lanza un cliente MCP (stdin por pipe) inicia el servidor stdio como antes. Las configuraciones MCP existentes no requieren cambios.

### Cambiado

- En la CLI, las consultas al BCV usan `strictSSL: false` por defecto (igual que las tools MCP) por la cadena de certificados incompleta del portal; se activa con `--strict-ssl`. La librería mantiene su default estricto.

## [1.1.0] - 2026-06-04

### Añadido

- **`getBrlRates(params)`**: cotización oficial USD/BRL (dólar PTAX, compra y venta) desde la API de datos abiertos del Banco Central do Brasil, con ventana configurable en días (`days`), caché y reintentos heredados. Devuelve `null` cuando la ventana no contiene cotizaciones.
- **Nuevos tipos**: `BrlParams`, `BrlRate`, `BrlResponse` y la clase de error `BrlApiError`.
- **Servidor MCP integrado** ejecutable con `npx bcv-exchange-rate` (transporte stdio). Expone cuatro _tools_: `get_bcv_rates`, `get_bcv_history`, `get_trm_rates` y `get_brl_rates`, con esquemas tipados (zod) y manejo de errores que nunca tumba el proceso. En las tools del BCV, `strictSSL` es `false` por defecto debido a la cadena de certificados incompleta del portal (la librería mantiene su valor estricto).
- Campo `bin` en `package.json` y dependencias `@modelcontextprotocol/sdk` y `zod`.

### Arreglado

- **Extracción del histórico BCV**: el filtro de fechas enviaba `May` como mes, pero el portal (Drupal en español) espera `Mayo`, lo que producía una vista vacía de forma silenciosa.
- **Selector de tabla del histórico**: se prioriza la vista principal (`view-tasas-sistema-bancario-full`) para no confundirla con el bloque lateral de 3 columnas.
- **Detección de paginación**: soporte para el marcado Bootstrap actual (`ul.pagination li.next`) además del antiguo `.pager-next`.

## [1.0.1] - 2026-04-21

### Cambiado

- `package.json` ahora expone el autor en formato objeto (`name`, `email` y `url`) en lugar de cadena.
- Añadido el campo `funding` con enlaces a _Buy Me a Coffee_ y GitHub Sponsors, visibles tras `npm install`.
- `README.md` amplía la sección **Autor** con biografía breve, _stack_ habitual y _badges_ de contacto (web, correo, blog, GitHub, LinkedIn, X, Dev.to, Medium, Stack Overflow, Telegram y YouTube).
- Nueva sección **Apoyar el proyecto** con _badges_ de _Buy Me a Coffee_ y GitHub Sponsors.
- La sección de **Licencia** pasa a un pie breve que referencia el archivo `LICENSE`.

## [1.0.0] - 2026-04-21

### Añadido

- Lanzamiento inicial de la librería.
- **`getBcvRates(params)`**: tasas oficiales del Banco Central de Venezuela para `USD`, `EUR`, `CNY`, `TRY` y `RUB`, más el historial informativo del sistema bancario.
- **`getBcvHistory(params)`**: consulta independiente del historial bancario paginado, con rango en días configurable.
- **`getTrmRates(params)`**: Tasa Representativa del Mercado (TRM) de Colombia en `COP` desde el portal de datos abiertos.
- **Filtrado de monedas** con unión literal `Currency` tipada (`'USD' | 'EUR' | 'CNY' | 'TRY' | 'RUB'`).
- **Carga selectiva** mediante `includeCurrent` e `includeHistory` para optimizar el tiempo de respuesta.
- **Campo `status`** en `BcvResponse` (`'ok' | 'skipped' | 'failed'`) que expone el resultado de cada sección para distinguir fallos parciales.
- **Reintentos automáticos con backoff exponencial** (`retries`, `retryDelayMs`).
- **Caché en memoria activa por defecto** (60 s). Configurable mediante `cacheTtlMs`; se desactiva con `cacheTtlMs: 0`.
- **Modo `stale-while-error`** opcional (`cacheStaleTtlMs`): ventana extra durante la cual se sirve el último valor cacheado si el upstream falla; emite un `warn` en cada servicio degradado.
- **Evicción LRU configurable** en la caché por defecto (`createInMemoryCache({ maxEntries })`).
- **Backend pluggable** (`cacheStore`): acepta cualquier implementación de la interfaz `CacheStore`, apta para adaptadores con Redis u otros backends persistentes.
- **API de administración de caché**: `clearCache`, `createInMemoryCache`, `setDefaultCache`, `getDefaultCache`, `getCacheStats`, `resetCacheStats`.
- **Jerarquía de errores tipada**: `BcvExchangeError` (base), `NetworkError`, `ParseError`, `ValidationError` y `TrmApiError`. Cada clase conserva el error original en `cause`.
- **Validación estricta de entrada**: `days`, `page`, `limit` y `offset` se validan antes de emitir la petición.
- **Logger basado en interfaz**: compatible con `console`, `winston`, `pino`, `bunyan` y cualquier objeto con `{ info, debug, warn, error }`. `winston` queda como `peerDependency` opcional.
- **TLS seguro por defecto** (`strictSSL: true`), con desactivación explícita cuando sea necesaria; cada desactivación emite un `warn`.
- **Normalización de fechas** del historial bancario a ISO 8601 (`YYYY-MM-DD`).
- **Publicación dual CJS y ESM** mediante el campo `exports`, con declaraciones `.d.ts` compartidas.
- **Soporte para TypeScript** con declaraciones `.d.ts` distribuidas.
- **Suite de pruebas con Jest y `ts-jest`**. Umbrales de cobertura del 100 % en _statements_, _branches_, _functions_ y _lines_, forzados en CI.
- **CI multi-SO y multi-Node** (GitHub Actions) con lint, verificación de formato, pruebas y _build_ en Linux, macOS y Windows con Node 20 y 22.
- **Dependabot** semanal para dependencias y mensual para Actions.
- **Plantillas de incidencias y _pull requests_**, junto con `SECURITY.md` y `CODE_OF_CONDUCT.md`.
- **ESLint, Prettier y EditorConfig** configurados.
- **Documentación profesional** en `docs/` con guía de inicio, referencia de la API, arquitectura interna, guías temáticas (logging, errores, caché, reintentos, seguridad y TypeScript), ejemplos ejecutables y solución de problemas.
- Licencia MIT.

[1.0.1]: https://github.com/carrilloapps/bcv-exchange-rate/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/carrilloapps/bcv-exchange-rate/releases/tag/v1.0.0
