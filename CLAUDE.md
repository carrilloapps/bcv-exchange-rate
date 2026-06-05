# CLAUDE.md

Guía para Claude Code en este repositorio. La guía operativa completa (herramientas prioritarias, gotchas y flujo de trabajo) vive en AGENTS.md y aplica íntegra:

@AGENTS.md

## Comandos esenciales

```bash
npm test             # Jest: 3 suites, cobertura 100 % forzada sobre src/ (lib)
npm run lint         # ESLint (flat config)
npm run format       # Prettier
npm run build        # CJS + ESM + .d.ts + CLI/MCP → dist/
node bin/mcp.js bcv  # Probar la CLI local sin publicar
```

Para correr un solo archivo de tests: `npx jest src/cli.spec.ts`.

## Mapa rápido del código

| Quiero tocar...                  | Archivo                              |
| -------------------------------- | ------------------------------------ |
| Tipos públicos / contrato v2     | `src/types.ts`                       |
| Scraping del BCV                 | `src/sources/bcv.ts`                 |
| API TRM (Colombia)               | `src/sources/trm.ts`                 |
| API PTAX (Brasil)                | `src/sources/brl.ts`                 |
| Caché / stale-while-error        | `src/cache.ts`                       |
| Reintentos / TLS / headers       | `src/http.ts`                        |
| Formatos de fecha (gotcha Mayo)  | `src/format.ts`                      |
| CLI (comandos y flags)           | `src/cli.ts`                         |
| Tools MCP (esquemas zod)         | `src/mcp-server.ts`                  |
| Punto de entrada del binario     | `bin/mcp.js`                         |

## Reglas de publicación

- Sin atribuciones de IA en commits, PRs ni código (regla permanente del autor).
- Cambios en la API pública exigen: actualizar `docs/api-reference.md`, `README.md`, `CHANGELOG.md` (con guía de migración si es breaking) y bump semver coherente.
- `npm publish` requiere OTP del autor; el gate `prepublishOnly` corre clean + test + build.
- Cada release lleva tag `vX.Y.Z` y GitHub Release con las notas del CHANGELOG.
