# Política de seguridad

## Versiones soportadas

| Versión | Soporte                                   |
| ------- | ----------------------------------------- |
| 2.x     | Activo                                    |
| 1.x     | Sólo parches críticos hasta el 2026-10-21 |
| < 1.0   | Sin soporte                               |

## Reporte de vulnerabilidades

**No abras una incidencia pública** para vulnerabilidades de seguridad.

Repórtalas a través de uno de estos canales:

1. GitHub Security Advisories: <https://github.com/carrilloapps/bcv-exchange-rate/security/advisories/new>.
2. Correo electrónico al mantenedor: [m@carrillo.app](mailto:m@carrillo.app) con el asunto `[SECURITY] bcv-exchange-rate`.

Incluye: versión afectada, pasos reproducibles, impacto y, si es posible, una prueba de concepto (PoC).

## Proceso

- Confirmación de recepción: **dentro de 72 horas**.
- Evaluación inicial: **hasta 7 días**.
- Parche coordinado en una versión acompañada del _advisory_ publicado tras la liberación.

## Consideraciones específicas

Esta librería consume fuentes públicas gubernamentales (`bcv.org.ve` y `datos.gov.co`). Los principales vectores de riesgo son:

- **TLS relajado.** `strictSSL: false` requiere desactivación explícita. Úsalo con conciencia.
- **Scraping.** Si los portales devuelven contenido malicioso, la librería sólo lo parsea como HTML; no ejecuta scripts.
- **Cadena de dependencias.** `axios` y `cheerio` se auditan con Dependabot de forma semanal.
