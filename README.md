# bcv-exchange-rate

[![npm version](https://img.shields.io/npm/v/bcv-exchange-rate.svg?logo=npm)](https://www.npmjs.com/package/bcv-exchange-rate)
[![npm downloads](https://img.shields.io/npm/dm/bcv-exchange-rate.svg?logo=npm)](https://www.npmjs.com/package/bcv-exchange-rate)
[![CI](https://github.com/carrilloapps/bcv-exchange-rate/actions/workflows/ci.yml/badge.svg)](https://github.com/carrilloapps/bcv-exchange-rate/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/carrilloapps/bcv-exchange-rate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/node/v/bcv-exchange-rate.svg?logo=node.js&logoColor=white)](https://nodejs.org)

Librería profesional de Node.js y **servidor MCP** para consultar indicadores económicos oficiales de **Venezuela (BCV)**, **Colombia (TRM)** y **Brasil (PTAX)**. Extrae los datos directamente del Banco Central de Venezuela, del portal de datos abiertos del Gobierno de Colombia y del Banco Central do Brasil, con tipado estricto, reintentos con backoff, caché en memoria activa por defecto, jerarquía de errores tipada y logger basado en interfaz, sin dependencias forzadas.

---

## Características

- **Multi-indicador.** Tasas oficiales del BCV (`USD`, `EUR`, `CNY`, `TRY`, `RUB`), TRM de Colombia (`COP`) y dólar PTAX de Brasil (`BRL`).
- **Servidor MCP integrado.** `npx bcv-exchange-rate` expone las cuatro fuentes como _tools_ del [Model Context Protocol](https://modelcontextprotocol.io) para Claude, Cursor y cualquier cliente MCP.
- **Historial bancario paginado.** Tasas de compra y venta por institución financiera venezolana.
- **Reintentos automáticos** con backoff exponencial configurable.
- **Caché en memoria** con TTL por llamada y _stale-while-error_ opcional.
- **Jerarquía de errores tipada** (`NetworkError`, `TrmApiError`, `BrlApiError`, `ValidationError`).
- **Logger basado en interfaz.** Compatible con winston, pino, bunyan o `console`, sin dependencias forzadas.
- **TLS seguro por defecto** (`strictSSL: true`), con desactivación explícita cuando sea necesario.
- **Dual CJS/ESM** con declaraciones `.d.ts`.
- **Estado por sección** (`status.current`, `status.history`) para detectar fallos parciales.
- **Cobertura del 100 %** forzada en CI.

## Instalación

```bash
npm install bcv-exchange-rate
```

Requiere **Node.js 20 LTS o superior**. Si usas winston como logger (opcional):

```bash
npm install winston
```

## Inicio rápido

```typescript
import { getBcvRates, getTrmRates, getBrlRates } from 'bcv-exchange-rate';

const bcv = await getBcvRates({ currencies: 'USD', includeHistory: false });
console.log(`USD/VES: ${bcv.current.USD} (vigencia ${bcv.effectiveDate})`);

const trm = await getTrmRates({ limit: 1 });
console.log(`TRM: ${trm?.current.value} COP`);

const brl = await getBrlRates({ days: 7 });
console.log(`PTAX venta: ${brl?.current.sell} BRL por USD (${brl?.current.dateTime})`);
```

Versión CommonJS:

```javascript
const { getBcvRates } = require('bcv-exchange-rate');
```

## Ejemplo con caché y reintentos

```typescript
const bcv = await getBcvRates({
  currencies: ['USD', 'EUR'],
  retries: 3,
  retryDelayMs: 500,
  cacheTtlMs: 60_000,
  cacheStaleTtlMs: 10 * 60_000,
});

if (bcv.status.current === 'failed') {
  console.warn('Tasa actual no disponible; se usa el historial como alternativa');
}
```

## Servidor MCP

El paquete incluye un servidor [Model Context Protocol](https://modelcontextprotocol.io) por **stdio**, listo para usarse con `npx` sin instalación previa:

```bash
npx bcv-exchange-rate
```

### Configuración en clientes MCP

**Claude Code:**

```bash
claude mcp add bcv-exchange-rate -- npx bcv-exchange-rate
```

**Claude Desktop / Cursor / cualquier cliente con `mcpServers`** (`claude_desktop_config.json`, `.mcp.json`, etc.):

```json
{
  "mcpServers": {
    "bcv-exchange-rate": {
      "command": "npx",
      "args": ["bcv-exchange-rate"]
    }
  }
}
```

### Tools disponibles

#### `get_bcv_rates` — Tasas oficiales BCV (Venezuela)

Tasas de cambio oficiales del Banco Central de Venezuela (VES por unidad de divisa) y, opcionalmente, el histórico informativo del sistema bancario.

| Atributo         | Tipo                                            | Default | Descripción                                                                                                                                                       |
| ---------------- | ----------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `currencies`     | `("USD" \| "EUR" \| "CNY" \| "TRY" \| "RUB")[]` | todas   | Códigos de moneda a incluir.                                                                                                                                      |
| `includeCurrent` | `boolean`                                       | `true`  | Incluir las tasas actuales de la portada del BCV.                                                                                                                 |
| `includeHistory` | `boolean`                                       | `true`  | Incluir el histórico bancario.                                                                                                                                    |
| `days`           | `integer ≥ 1`                                   | `7`     | Ventana de días del histórico.                                                                                                                                    |
| `page`           | `integer ≥ 0`                                   | `0`     | Página del histórico.                                                                                                                                             |
| `strictSSL`      | `boolean`                                       | `false` | Validación TLS. El portal del BCV sirve una cadena de certificados incompleta, por lo que el servidor MCP la desactiva por defecto (la librería mantiene `true`). |
| `timeout`        | `integer ≥ 1`                                   | `25000` | Timeout de la petición en ms.                                                                                                                                     |
| `retries`        | `integer ≥ 0`                                   | `2`     | Reintentos ante fallos transitorios.                                                                                                                              |
| `cacheTtlMs`     | `integer ≥ 0`                                   | `60000` | TTL de caché fresca en ms; `0` desactiva la caché.                                                                                                                |

#### `get_bcv_history` — Histórico bancario BCV (Venezuela)

Solo las tasas informativas históricas del sistema bancario venezolano (compra/venta por banco y fecha).

| Atributo     | Tipo          | Default | Descripción                                        |
| ------------ | ------------- | ------- | -------------------------------------------------- |
| `days`       | `integer ≥ 1` | `7`     | Ventana de días hacia atrás.                       |
| `page`       | `integer ≥ 0` | `0`     | Página del listado.                                |
| `strictSSL`  | `boolean`     | `false` | Validación TLS (ver nota en `get_bcv_rates`).      |
| `timeout`    | `integer ≥ 1` | `25000` | Timeout de la petición en ms.                      |
| `retries`    | `integer ≥ 0` | `2`     | Reintentos ante fallos transitorios.               |
| `cacheTtlMs` | `integer ≥ 0` | `60000` | TTL de caché fresca en ms; `0` desactiva la caché. |

#### `get_trm_rates` — TRM oficial (Colombia)

Tasa Representativa del Mercado (COP por USD) desde el portal de datos abiertos del Gobierno de Colombia (datos.gov.co).

| Atributo     | Tipo             | Default | Descripción                                        |
| ------------ | ---------------- | ------- | -------------------------------------------------- |
| `limit`      | `integer 1-1000` | `10`    | Máximo de registros a devolver.                    |
| `offset`     | `integer ≥ 0`    | `0`     | Desplazamiento de paginación.                      |
| `timeout`    | `integer ≥ 1`    | `25000` | Timeout de la petición en ms.                      |
| `retries`    | `integer ≥ 0`    | `2`     | Reintentos ante fallos transitorios.               |
| `cacheTtlMs` | `integer ≥ 0`    | `60000` | TTL de caché fresca en ms; `0` desactiva la caché. |

#### `get_brl_rates` — Dólar PTAX oficial (Brasil)

Cotización oficial USD/BRL (dólar PTAX, compra y venta) desde la API de datos abiertos del Banco Central do Brasil. Devuelve `null` cuando la ventana no contiene cotizaciones (fines de semana o feriados).

| Atributo     | Tipo          | Default | Descripción                                        |
| ------------ | ------------- | ------- | -------------------------------------------------- |
| `days`       | `integer ≥ 1` | `7`     | Ventana de días hacia atrás.                       |
| `timeout`    | `integer ≥ 1` | `25000` | Timeout de la petición en ms.                      |
| `retries`    | `integer ≥ 0` | `2`     | Reintentos ante fallos transitorios.               |
| `cacheTtlMs` | `integer ≥ 0` | `60000` | TTL de caché fresca en ms; `0` desactiva la caché. |

Todas las tools devuelven el resultado como JSON en el contenido de texto de la respuesta. Los errores de la librería (red, validación, parseo) se reportan como respuestas MCP con `isError: true` sin tumbar el servidor.

## Documentación

La documentación extendida vive en [`docs/`](./docs/README.md):

### Primeros pasos

- [Guía de inicio](./docs/getting-started.md)
- [Ejemplos ejecutables](./docs/examples/README.md)

### Referencia

- [Referencia completa de la API](./docs/api-reference.md)
- [Arquitectura interna](./docs/architecture.md)

### Guías temáticas

- [Logging y observabilidad](./docs/guides/logging.md)
- [Manejo de errores](./docs/guides/errors.md)
- [Caché y resiliencia](./docs/guides/caching.md)
- [Reintentos y resiliencia](./docs/guides/retries.md)
- [Seguridad y TLS](./docs/guides/security.md)
- [Uso con TypeScript](./docs/guides/typescript.md)

### Operaciones

- [Solución de problemas](./docs/troubleshooting.md)

## Desarrollo

```bash
npm install
npm test             # Jest con cobertura del 100 % forzada.
npm run lint         # ESLint.
npm run format       # Prettier.
npm run build        # Dual CJS/ESM más declaraciones.
```

Más detalles en [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Seguridad

Reporta vulnerabilidades según lo descrito en [`SECURITY.md`](./SECURITY.md). **No abras incidencias públicas** para problemas de seguridad.

## Autor

**José Carrillo** — Senior Fullstack Developer y Tech Lead con más de diez años de experiencia construyendo software escalable, eficiente y seguro.

Stack habitual: **NestJS**, **Go**, **React**, **React Native**, **Kotlin**, **Swift** y **Python** sobre **PostgreSQL** y **MongoDB**.

[![Website](https://img.shields.io/badge/Website-carrillo.app-1f6feb?style=flat&logo=googlechrome&logoColor=white)](https://carrillo.app)
[![Email](https://img.shields.io/badge/Email-m@carrillo.app-D14836?style=flat&logo=gmail&logoColor=white)](mailto:m@carrillo.app)
[![Blog](https://img.shields.io/badge/Blog-carrillo.app%2Fblog-ff5722?style=flat&logo=rss&logoColor=white)](https://carrillo.app/blog)
[![GitHub](https://img.shields.io/badge/GitHub-@carrilloapps-181717?style=flat&logo=github&logoColor=white)](https://github.com/carrilloapps)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-carrilloapps-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://linkedin.com/in/carrilloapps)
[![X](https://img.shields.io/badge/X-@carrilloapps-000000?style=flat&logo=x&logoColor=white)](https://x.com/carrilloapps)
[![Dev.to](https://img.shields.io/badge/Dev.to-carrilloapps-0A0A0A?style=flat&logo=devdotto&logoColor=white)](https://dev.to/carrilloapps)
[![Medium](https://img.shields.io/badge/Medium-@carrilloapps-12100E?style=flat&logo=medium&logoColor=white)](https://medium.com/@carrilloapps)
[![Stack Overflow](https://img.shields.io/badge/StackOverflow-14580648-F48024?style=flat&logo=stackoverflow&logoColor=white)](https://stackoverflow.com/users/14580648)
[![Telegram](https://img.shields.io/badge/Telegram-@carrilloapps-2CA5E0?style=flat&logo=telegram&logoColor=white)](https://t.me/carrilloapps)
[![YouTube](https://img.shields.io/badge/YouTube-carrilloapps-FF0000?style=flat&logo=youtube&logoColor=white)](https://www.youtube.com/@carrilloapps)

Proyectos adicionales: [carrillo.app/proyectos](https://carrillo.app/proyectos). Publicaciones técnicas: [github.com/carrilloapps/papers](https://github.com/carrilloapps/papers). CV: [carrillo.app/cv.pdf](https://carrillo.app/cv.pdf).

## Apoyar el proyecto

Si esta librería te resulta útil, puedes invitarme un café o patrocinar el desarrollo continuo:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/carrilloapps)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/carrilloapps)

## Licencia

Distribuida bajo la [licencia MIT](./LICENSE). © José Carrillo.
