# Changelog

Todos los cambios notables en el proyecto **bcv-exchange-rate** serán documentados en este archivo.

## [1.0.0] - 2026-04-21

### Añadido
- Lanzamiento inicial de la librería profesional.
- Soporte para tasas oficiales del **Banco Central de Venezuela (BCV)**: USD, EUR, CNY, TRY, RUB.
- Soporte para **Tasa Representativa del Mercado (TRM)** de Colombia (COP).
- Funcionalidad de scraping directo para evadir dependencia de APIs de terceros.
- Histórico bancario detallado (Compra/Venta) para Venezuela.
- **Soporte de Seguridad:** Opción para omitir la validación SSL (`strictSSL: false`) para entornos con certificados inestables.
- **Parametrización Avanzada:** Control de días de histórico, límites de registros y paginación.
- **Paginación Nativa:** Capacidad de navegar por las páginas de resultados del BCV y la API de Colombia.
- Documentación completa en `README.md`.
- Licencia MIT.
