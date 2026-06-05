# AGENTS.md

Guía operativa para agentes de IA que trabajen en este repositorio.

## Herramientas prioritarias (OBLIGATORIO)

### 1. Codegraph (MCP) — exploración de código

**SIEMPRE usa codegraph ANTES que grep/glob/read manual** para explorar o entender el código. El índice ya existe (`.codegraph/`) y responde en sub-milisegundos.

| Intención                                       | Herramienta                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| "¿Cómo funciona X?", arquitectura, bugs, flujos | `codegraph_explore` (PRIMARIA — casi siempre basta una sola llamada) |
| Ubicar un símbolo por nombre                    | `codegraph_search`                                                   |
| ¿Quién llama a X? / ¿Qué llama X?               | `codegraph_callers` / `codegraph_callees`                            |
| ¿Qué rompería un cambio en X?                   | `codegraph_impact`                                                   |
| Fuente completa de un símbolo                   | `codegraph_node`                                                     |

Reglas:

- Consulta codegraph ANTES de escribir o editar código, no después.
- No delegues exploración a subagentes ni hagas bucles de grep+read: codegraph YA es el índice pre-construido.
- Usa Read/Grep crudos solo para confirmar un detalle puntual que codegraph no cubrió.
- Antes de modificar una función pública, ejecuta `codegraph_impact` para conocer el alcance del cambio.

### 2. Caveman (skill) — comunicación eficiente

**Usa la skill `caveman` por defecto** en las respuestas para reducir ~75% el consumo de tokens manteniendo precisión técnica completa.

- Modo por defecto: `full`. Niveles disponibles: `lite`, `full`, `ultra` (y variantes `wenyan-*`).
- Aplica a explicaciones, resúmenes y reportes de progreso.
- NO aplica a: contenido de archivos de código, documentación del repo (README, CHANGELOG), mensajes de commit, ni texto destinado a usuarios finales — estos mantienen redacción normal y profesional.
- Si el usuario pide una explicación detallada explícitamente, suspende caveman para esa respuesta.

## Sobre el proyecto

- Librería Node.js (TypeScript), CLI y servidor MCP para tasas de cambio oficiales: BCV (Venezuela, scraping), TRM (Colombia, API Socrata) y PTAX/BRL (Brasil, API OData del BCB).
- **Arquitectura modular en `src/`**: `types`, `errors`, `validation`, `format`, `logger`, `cache`, `http`, `sources/{bcv,trm,brl}`, `cli`, `mcp-server`; `src/index.ts` es el barrel de la API pública. Detalle en `docs/architecture.md`.
- **Contrato de respuesta unificado (v2)**: las tres fuentes devuelven `current` + `history` + `pagination { limit, offset, page, count, hasMore }` + `range`; los campos que no aplican son `null`, nunca se omiten.
- Binario `bin/mcp.js` con detección de contexto: argumentos o TTY → CLI; stdin por pipe → servidor MCP (stdio). Alias global: `xrate`.
- Build dual CJS/ESM + tipos + CLI/MCP: `npm run build`. Node >= 20.
- Tests: `npm test` (Jest, 3 suites, cobertura 100 % forzada sobre los módulos de la librería). Lint: `npm run lint`. Formato: `npm run format`.
- Dependencias de runtime: `axios`, `cheerio`, `@modelcontextprotocol/sdk`, `zod`. `winston` es peer opcional.
- Documentación y mensajes orientados al usuario en español; identificadores de código en inglés (en_US).

## Gotchas operativos (no romper)

- El filtro de fechas del portal BCV (Drupal-ES) exige meses abreviados de 3 letras **excepto `Mayo`** (palabra completa). Ver `src/format.ts`.
- El portal BCV sirve una cadena TLS incompleta: la librería usa `strictSSL: true` por defecto, pero CLI y tools MCP lo relajan a `false` (documentado).
- La API PTAX exige fechas `MM-DD-YYYY`; `getTrmRates`/`getBrlRates` devuelven `null` ante ventana sin datos (no es error).
- Validar siempre contra los upstream reales antes de dar por cerrado un cambio de scraping/API.

## Flujo de trabajo recomendado

1. `codegraph_explore` para entender el área afectada.
2. `codegraph_impact` / `codegraph_callers` antes de cambiar APIs.
3. Editar código (y actualizar `docs/` + `CHANGELOG.md` si cambia la API pública).
4. `npm run lint && npm test && npm run build` antes de dar por terminado.
5. Verificar en vivo contra las fuentes reales cuando el cambio toque scraping o URLs.
6. Comunicar resultados en modo caveman.
