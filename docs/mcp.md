# Servidor MCP — especificación de integración

Documentación a nivel de protocolo del servidor [Model Context Protocol](https://modelcontextprotocol.io) incluido en `bcv-exchange-rate`, pensada para que **cualquier agente de IA o desarrollador pueda integrarlo sin leer el código fuente**.

> El servidor es autodescriptivo: `tools/list` devuelve, para cada tool, su `description`, su `inputSchema` **y su `outputSchema`** (JSON Schema completos, con descripciones campo a campo). Un cliente puede integrarse correctamente usando solo esa respuesta. Esta página documenta lo mismo en formato legible, con intercambios reales capturados del servidor.

## Arranque y transporte

- **Transporte:** stdio (JSON-RPC 2.0, una línea por mensaje).
- **Comando:** `npx bcv-exchange-rate` (sin argumentos y con stdin por pipe → modo servidor; en una terminal interactiva el binario actúa como CLI).
- **Sin autenticación ni variables de entorno requeridas.** Necesita salida de red a `bcv.org.ve`, `datos.gov.co` y `olinda.bcb.gov.br`.

### Registro en clientes

```bash
# Claude Code
claude mcp add bcv-exchange-rate -- npx bcv-exchange-rate
```

```json
// Claude Desktop, Cursor o cualquier cliente con mcpServers
{
  "mcpServers": {
    "bcv-exchange-rate": {
      "command": "npx",
      "args": ["bcv-exchange-rate"]
    }
  }
}
```

## Handshake

Intercambio real (servidor 2.0.0):

```json
// → solicitud
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"mi-cliente","version":"1.0.0"}}}

// ← respuesta
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"bcv-exchange-rate","version":"2.0.0"}}}

// → notificación obligatoria tras el handshake
{"jsonrpc":"2.0","method":"notifications/initialized"}
```

## Tools

Cuatro tools, todas con el mismo contrato de resultado:

| Tool              | Fuente oficial                        | `data` puede ser `null`       |
| ----------------- | ------------------------------------- | ----------------------------- |
| `get_bcv_rates`   | Banco Central de Venezuela (scraping) | No (usa `status` por sección) |
| `get_bcv_history` | BCV — histórico bancario              | No                            |
| `get_trm_rates`   | datos.gov.co (Socrata)                | Sí — API sin registros        |
| `get_brl_rates`   | Banco Central do Brasil (PTAX/OData)  | Sí — ventana sin cotizaciones |

### Contrato de resultado (idéntico en las cuatro)

Toda llamada exitosa devuelve **dos representaciones del mismo payload**:

```jsonc
{
  "content": [{ "type": "text", "text": "{ ...payload serializado... }" }], // compatibilidad
  "structuredContent": { "data": { ...payload... } } // máquina-legible, validado contra outputSchema
}
```

- `structuredContent.data` cumple **exactamente** el `outputSchema` que la tool declara en `tools/list` (el servidor lo valida en cada llamada; la suite de tests lo fuerza).
- En `get_trm_rates` y `get_brl_rates`, `data: null` significa «sin datos» y **no es un error** (fines de semana/feriados sin PTAX, API TRM sin registros).
- El payload sigue el [contrato unificado v2](./api-reference.md#contrato-de-respuesta-unificado): `current` + `history` + `pagination { limit, offset, page, count, hasMore }` + `range` + `strictSSL` (eco de la política TLS usada: `false` = data obtenida sin validación de certificados).

### Errores

Los fallos se reportan como resultado con `isError: true` (nunca tumban el proceso del servidor):

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "TlsError: TLS certificate validation failed for https://www.bcv.org.ve/: ... If you accept the man-in-the-middle risk, retry with { strictSSL: false } (library/MCP tools) or without --strict-ssl (CLI) to inspect the data anyway."
    }
  ]
}
```

Prefijos posibles en el texto: `ValidationError` (argumentos inválidos), `TlsError` (certificado inválido — el mensaje indica reintentar con `strictSSL: false`), `NetworkError`, `TrmApiError`, `BrlApiError`. Los argumentos que violan el `inputSchema` se rechazan antes de ejecutar la tool.

### Atributos de entrada

Las tablas completas de atributos (tipo, default y descripción de cada uno) están en el [README](../README.md#tools-disponibles) y son **idénticas** a los `inputSchema` publicados por `tools/list` (verificado por auditoría automática). Comunes a todas: `timeout` (ms, default 25000), `retries` (default 2), `cacheTtlMs` (ms, default 60000, `0` desactiva). Las tools BCV añaden `strictSSL` con **default `false`** (el portal sirve una cadena de certificados incompleta; la librería subyacente mantiene `true`).

## Ejemplo completo: definición y llamada de `get_brl_rates`

Definición tal como la devuelve `tools/list` (extracto real):

```json
{
  "name": "get_brl_rates",
  "title": "Dólar PTAX oficial (Brasil)",
  "description": "Obtiene la cotización oficial USD/BRL (dólar PTAX, compra y venta) desde la API de datos abiertos del Banco Central do Brasil. La respuesta llega en structuredContent.data; data es null cuando la ventana no contiene cotizaciones — fines de semana o feriados — (no es un error).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "days": { "type": "integer", "minimum": 1, "description": "Ventana de días hacia atrás. Default: 7." },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 1000,
        "description": "Máximo de registros (1-1000). Default: toda la ventana."
      },
      "offset": {
        "type": "integer",
        "minimum": 0,
        "description": "Registros a saltar para paginar. Default: 0."
      },
      "timeout": {
        "type": "integer",
        "minimum": 1,
        "description": "Request timeout in milliseconds. Default: 25000."
      },
      "retries": {
        "type": "integer",
        "minimum": 0,
        "description": "Retry attempts on transient failures. Default: 2."
      },
      "cacheTtlMs": {
        "type": "integer",
        "minimum": 0,
        "description": "Fresh-cache TTL in milliseconds. 0 disables caching. Default: 60000."
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "data": {
        "anyOf": [
          {
            "type": "object",
            "properties": {
              "current": {
                "type": "object",
                "properties": {
                  "buy": { "type": "number", "description": "cotacaoCompra: BRL por USD." },
                  "sell": { "type": "number", "description": "cotacaoVenda: BRL por USD." },
                  "dateTime": {
                    "type": "string",
                    "description": "dataHoraCotacao (YYYY-MM-DD HH:mm:ss.SSS)."
                  }
                },
                "required": ["buy", "sell", "dateTime"]
              },
              "history": { "type": "array", "items": { "...": "mismo shape que current" } },
              "pagination": {
                "type": "object",
                "properties": {
                  "limit": { "type": ["integer", "null"] },
                  "offset": { "type": ["integer", "null"] },
                  "page": { "type": ["integer", "null"] },
                  "count": { "type": "integer" },
                  "hasMore": { "type": ["boolean", "null"] }
                }
              },
              "range": { "type": ["object", "null"], "properties": { "startDate": {}, "endDate": {} } },
              "strictSSL": {
                "type": "boolean",
                "description": "false = la data se obtuvo SIN validación de certificados."
              }
            }
          },
          { "type": "null" }
        ]
      }
    },
    "required": ["data"]
  }
}
```

Llamada e intercambio real:

```json
// → solicitud
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_brl_rates","arguments":{"days":7,"limit":2}}}

// ← respuesta (resumida)
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{ "type": "text", "text": "{\n  \"current\": { \"buy\": 5.0409, ... }\n}" }],
    "structuredContent": {
      "data": {
        "current": { "buy": 5.0409, "sell": 5.0415, "dateTime": "2026-06-03 13:06:26.54" },
        "history": [{ "buy": 5.0154, "sell": 5.016, "dateTime": "2026-06-02 13:10:30.711" }],
        "pagination": { "limit": 2, "offset": 0, "page": null, "count": 2, "hasMore": null },
        "range": { "startDate": "2026-05-29", "endDate": "2026-06-05" },
        "strictSSL": true
      }
    }
  }
}
```

## Recetas para agentes

- **«Dame la tasa del dólar en Venezuela»** → `get_bcv_rates` con `{ "currencies": ["USD"], "includeHistory": false }` → `data.current.USD`.
- **«Compara las tasas bancarias venezolanas de esta semana»** → `get_bcv_history` con `{ "days": 7 }`; si `data.pagination.hasMore`, repetir con `page: page + 1`.
- **«TRM de Colombia del último mes»** → `get_trm_rates` con `{ "days": 30, "limit": 31 }`.
- **«PTAX de Brasil, las 5 últimas»** → `get_brl_rates` con `{ "limit": 5, "days": 14 }`; si `data` es `null`, ampliar `days`.
- **Ante `TlsError`** → reintentar la misma llamada añadiendo `"strictSSL": false` (solo tools BCV; ya es el default ahí) e informar al usuario que la data se obtuvo sin validación TLS (visible en `data.strictSSL`).

## Garantías de exactitud

- Los `outputSchema` se generan desde los mismos esquemas zod del servidor y **se validan en cada respuesta**; la suite de tests (con `InMemoryTransport`, cliente+servidor reales en memoria) fuerza que `structuredContent.data` sea idéntico al JSON del texto y conforme al esquema.
- Una auditoría automática compara los `inputSchema` publicados contra las tablas del README atributo por atributo.
- Versionado: `serverInfo.version` sigue el semver del paquete npm.
