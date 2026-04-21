# BCV Exchange Rate (bcv-exchange-rate) 📊

[![npm version](https://img.shields.io/npm/v/bcv-exchange-rate.svg)](https://www.npmjs.com/package/bcv-exchange-rate)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**bcv-exchange-rate** es una solución profesional de Node.js para el monitoreo en tiempo real de indicadores económicos oficiales en Venezuela y Colombia. Esta librería extrae datos directamente del **Banco Central de Venezuela (BCV)** y de la **Tasa Representativa del Mercado (TRM)** de Colombia, facilitando la integración financiera en aplicaciones que requieren datos oficiales y actualizados.

## 🌟 Características Principales

- **Multi-indicador:** Obtiene tasas oficiales de USD, EUR, CNY, TRY y RUB.
- **Historial Bancario:** Acceso detallado a las tasas de compra y venta de las instituciones bancarias en Venezuela.
- **Filtrado de Monedas:** Capacidad de solicitar únicamente las monedas de interés (ej. solo USD).
- **Carga Selectiva:** Opciones para omitir la carga del historial o de las tasas actuales para optimizar el rendimiento.
- **Paginación Avanzada:** Función dedicada para la recuperación de historial bancario con soporte para paginación.
- **Observabilidad:** Soporte nativo para inyección de loggers (`winston`) y logs estructurados.
- **Resiliencia:** Manejo automático de certificados SSL inestables en portales gubernamentales.

## 📦 Instalación

```bash
npm install bcv-exchange-rate
```

## 🚀 Guía de Uso

### Configuración Básica

```javascript
const { getBcvRates, getTrmRates, getBcvHistory } = require('bcv-exchange-rate');
```

### Consultar Tasas del BCV (Venezuela)

Por defecto, retorna las tasas actuales y el historial de los últimos 7 días.

```javascript
async function ejemploBcv() {
    // Ejemplo: Solo traer USD y omitir historial para mayor rapidez
    const bcv = await getBcvRates({ 
        currencies: 'USD', 
        includeHistory: false 
    });

    console.log(`Tasa USD: ${bcv.current.USD} VES`);
    console.log(`Vigencia: ${bcv.effectiveDate}`);
}
```

### Consultar Historial Bancario Paginado

Ideal para auditorías o reportes que requieren datos históricos extensos.

```javascript
async function ejemploHistorial() {
    // Obtener la página 2 del historial de los últimos 15 días
    const data = await getBcvHistory({ 
        days: 15, 
        page: 2 
    });

    data.history.forEach(record => {
        console.log(`${record.date} | ${record.bank} | Compra: ${record.buy}`);
    });

    if (data.pagination.hasNextPage) {
        console.log("Hay más páginas disponibles...");
    }
}
```

### Consultar TRM (Colombia)

```javascript
async function ejemploTrm() {
    const trm = await getTrmRates({ limit: 1 });
    console.log(`TRM Actual: $${trm.current.value} COP`);
}
```

## ⚙️ Referencia de la API (BcvParams)

| Propiedad | Tipo | Descripción | Por Defecto |
|-----------|------|-------------|---------|
| `currencies` | `string \| string[]` | Filtra las monedas retornadas (ej: `'USD'` o `['USD', 'EUR']`). | Todas |
| `includeCurrent` | `boolean` | Indica si debe consultar la página principal del BCV. | `true` |
| `includeHistory` | `boolean` | Indica si debe consultar el historial bancario. | `true` |
| `days` | `number` | Rango de días para el historial bancario. | `7` |
| `page` | `number` | Número de página para el historial. | `0` |
| `strictSSL` | `boolean` | Si es `false`, ignora errores de certificados SSL. | `false` |
| `timeout` | `number` | Tiempo máximo de espera en ms. | `25000` |
| `logger` | `Logger` | Instancia de logger compatible con winston. | Console |

## 📊 Estructura de Respuesta (BcvResponse)

```typescript
{
  current: { [key: string]: number }, // Tasas actuales filtradas
  effectiveDate: string,              // Fecha de vigencia oficial
  history: [                          // Lista de tasas bancarias
    { date: string, bank: string, buy: number, sell: number }
  ],
  pagination: {
    currentPage: number,
    hasNextPage: boolean
  }
}
```

## 🛡️ Logging y Observabilidad

Puedes integrar tu propio logger para monitorear las peticiones en producción:

```javascript
const winston = require('winston');
const logger = winston.createLogger({ ... });

const rates = await getBcvRates({ logger });
```

## 👤 Autor

**José Carrillo**
- Sitio Web: [carrillo.app](https://carrillo.app)
- Tech Lead & Fullstack Developer.

## ⚖️ Licencia

Este proyecto está bajo la Licencia MIT.
