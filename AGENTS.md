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

- Librería Node.js (TypeScript) para rastrear tasas de cambio oficiales: BCV (Venezuela) y TRM (Colombia).
- Build dual CJS/ESM + tipos: `npm run build`. Node >= 20.
- Tests: `npm test` (Jest con cobertura). Lint: `npm run lint`. Formato: `npm run format`.
- Dependencias de runtime: `axios`, `cheerio`. `winston` es peer opcional.
- Documentación y mensajes orientados al usuario en español; identificadores de código en inglés (en_US).

## Flujo de trabajo recomendado

1. `codegraph_explore` para entender el área afectada.
2. `codegraph_impact` / `codegraph_callers` antes de cambiar APIs.
3. Editar código.
4. `npm run lint && npm test` antes de dar por terminado.
5. Comunicar resultados en modo caveman.
