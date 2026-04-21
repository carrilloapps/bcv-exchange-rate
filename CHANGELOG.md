# Registro de cambios

Todos los cambios notables de **bcv-exchange-rate** se documentan en este archivo.

El formato sigue [Keep a Changelog 1.1.0](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto se rige por [Versionado semántico](https://semver.org/lang/es/).

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
- **Modo `stale-while-error`** opcional (`cacheStaleTtlMs`): ventana extra durante la cual se sirve el último valor cacheado si el upstream falla, emitiendo un `warn` en cada servicio degradado.
- **Evicción LRU configurable** en la caché por defecto (`createInMemoryCache({ maxEntries })`).
- **Backend pluggable** (`cacheStore`): acepta cualquier implementación de la interfaz `CacheStore`, apta para adaptadores con Redis u otros backends persistentes.
- **API de administración de caché**: `clearCache`, `createInMemoryCache`, `setDefaultCache`, `getDefaultCache`, `getCacheStats`, `resetCacheStats`.
- **Jerarquía de errores tipada**: `BcvExchangeError` (base), `NetworkError`, `ParseError`, `ValidationError` y `TrmApiError`. Cada clase conserva el error original en `cause`.
- **Validación estricta de entrada**: `days`, `page`, `limit` y `offset` se validan antes de emitir la petición.
- **Logger basado en interfaz**: compatible con `console`, `winston`, `pino`, `bunyan` y cualquier objeto con `{info, debug, warn, error}`. `winston` queda como `peerDependency` opcional.
- **TLS seguro por defecto** (`strictSSL: true`), con desactivación explícita cuando sea necesaria. Cada desactivación emite un `warn`.
- **Normalización de fechas** del historial bancario a ISO 8601 (`YYYY-MM-DD`).
- **Publicación dual CJS y ESM** mediante el campo `exports`, con declaraciones `.d.ts` compartidas.
- **Soporte para TypeScript** con declaraciones `.d.ts` distribuidas.
- **Suite de pruebas con Jest y `ts-jest`**. Umbrales de cobertura al 100 % en statements, branches, functions y lines, forzados en CI.
- **CI multi-SO y multi-Node** (GitHub Actions) con lint, verificación de formato, pruebas y build en Linux, macOS y Windows con Node 20 y 22.
- **Dependabot** semanal para dependencias y mensual para Actions.
- **Plantillas de incidencias y PR**, `SECURITY.md` y `CODE_OF_CONDUCT.md`.
- **ESLint, Prettier y EditorConfig** configurados.
- **Documentación profesional** en `docs/` con guía de inicio, referencia de la API, arquitectura interna, guías temáticas (logging, errores, caché, reintentos, seguridad y TypeScript), ejemplos ejecutables y solución de problemas.
- Licencia MIT.

[1.0.0]: https://github.com/carrilloapps/bcv-exchange-rate/releases/tag/v1.0.0
