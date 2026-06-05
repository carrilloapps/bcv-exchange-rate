# Documentación de bcv-exchange-rate

Bienvenido. Esta carpeta contiene la documentación extendida del paquete. El `README.md` raíz es la entrada rápida; aquí encontrarás referencias y guías detalladas.

## Índice

### Primeros pasos

- [Guía de inicio](./getting-started.md): instalación, primer llamado y ejemplos mínimos.
- [Ejemplos ejecutables](./examples/README.md): fragmentos copiables por caso de uso.
- [CLI y servidor MCP](../README.md#cli): consulta desde la terminal con `npx`/`xrate` o desde clientes MCP (Claude, Cursor).

### Referencia

- [Referencia de la API](./api-reference.md): todas las funciones, interfaces, el contrato de respuesta unificado y los tipos exportados.
- [Servidor MCP — especificación de integración](./mcp.md): protocolo, esquemas de entrada/salida, intercambios reales y recetas para agentes de IA.
- [Arquitectura interna](./architecture.md): estructura de módulos, scraping, reintentos y caché por dentro.

### Guías temáticas

- [Logging y observabilidad](./guides/logging.md): integración con winston, pino o loggers personalizados.
- [Manejo de errores](./guides/errors.md): jerarquía de errores y patrones de recuperación.
- [Caché y resiliencia](./guides/caching.md): TTL, _stale-while-error_, LRU y backends pluggables.
- [Reintentos y resiliencia](./guides/retries.md): backoff exponencial y tolerancia a fallos.
- [Seguridad y TLS](./guides/security.md): por qué y cuándo desactivar `strictSSL`.
- [Uso con TypeScript](./guides/typescript.md): tipos, uniones de monedas y _narrowing_.

### Operaciones

- [Solución de problemas](./troubleshooting.md): problemas comunes y cómo resolverlos.
