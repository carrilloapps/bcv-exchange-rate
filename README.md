# BCV Exchange Rate (bcv-exchange-rate) 📊

[![npm version](https://img.shields.io/npm/v/bcv-exchange-rate.svg)](https://www.npmjs.com/package/bcv-exchange-rate)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**bcv-exchange-rate** es una solución robusta y profesional de Node.js diseñada para el monitoreo en tiempo real de indicadores económicos oficiales en el eje fronterizo venezolano-colombiano. 

Esta librería integra de forma nativa las tasas del **Banco Central de Venezuela (BCV)** y la **Tasa Representativa del Mercado (TRM) de Colombia**, permitiendo a desarrolladores y empresas venezolanas acceder a datos financieros críticos sin depender de APIs de terceros costosas o intermediarios inestables.

## 🌟 Características Principales

- **Integración Transfronteriza:** Mapeo simultáneo de indicadores en Bolívares (VES) y Pesos Colombianos (COP).
- **Extracción Directa (Scraping):** Conexión nativa con `bcv.org.ve` para obtener USD, EUR, CNY, TRY, RUB.
- **Histórico Bancario Avanzado:** Acceso a los registros de compra/venta de las instituciones bancarias de Venezuela de los últimos días.
- **API Oficial de Colombia:** Integración directa con `datos.gov.co` para obtener la TRM de la Superintendencia Financiera.
- **Observabilidad:** Logging estructurado con `winston` para entornos de producción.
- **Resiliencia SSL:** Soporte para omitir validación de certificados en sitios gubernamentales inestables.

## 📦 Instalación

```bash
npm install bcv-exchange-rate
```

## 🚀 Guía de Uso

### Inicialización

```javascript
const { getBcvRates, getTrmRates } = require('bcv-exchange-rate');
```

### Monitoreo de Tasas del BCV (Venezuela)

Obtenga la tasa oficial vigente y el historial de transacciones bancarias del mercado cambiario venezolano.

```javascript
async function fetchVenezuelaData() {
    try {
        // days: Define el rango de días para el histórico bancario (por defecto 7 días)
        const bcv = await getBcvRates({ days: 7 });

        console.log(`USD Oficial: ${bcv.current.USD} VES`);
        console.log(`Fecha de vigencia: ${bcv.effectiveDate}`);
        
        // Histórico por instituciones bancarias (Compra/Venta)
        bcv.history.forEach(record => {
            console.log(`[${record.date}] ${record.bank}: Compra:${record.buy} | Venta:${record.sell}`);
        });
    } catch (error) {
        console.error('Error al consultar el BCV:', error.message);
    }
}
```

### Monitoreo de TRM de Colombia (COP)

Acceda a la tasa oficial del peso colombiano respecto al dólar estadounidense, vital para operaciones fronterizas.

```javascript
async function fetchColombiaData() {
    try {
        const trm = await getTrmRates({ limit: 5 });
        console.log(`TRM Actual: $${trm.current.value} COP`);
        console.log(`Vigencia hasta: ${trm.current.validityDate}`);
    } catch (error) {
        console.error('Error al consultar la TRM:', error.message);
    }
}
```

## 📊 Estructura de Datos (Resultados)

### BCV
```json
{
  "current": { "USD": 481.6989, "EUR": 567.58, ... },
  "effectiveDate": "2026-04-21T00:00:00-04:00",
  "history": [
    { "date": "20-04-2026", "bank": "Banesco", "buy": 537.77, "sell": 481.95 }
  ]
}
```

### TRM
```json
{
  "current": { "value": 3573.30, "unit": "COP", "validityDate": "2026-04-21" },
  "history": [ ... ]
}
```

## ⚙️ Parametrización y Opciones

Ambas funciones principales aceptan un objeto de opciones para personalizar la consulta:

### Opciones Comunes
| Propiedad | Tipo | Descripción | Por Defecto |
|-----------|------|-------------|---------|
| `strictSSL` | `boolean` | Si es `false`, permite la conexión a sitios con certificados SSL vencidos o ausentes. | `false` |
| `timeout` | `number` | Tiempo máximo de espera en milisegundos. | `25000` |
| `userAgent` | `string` | User-agent personalizado para las peticiones HTTP. | (Chrome 125) |
| `logger` | `object` | Instancia personalizada de winston para logs de la librería. | (Silent Console) |

### Parámetros de `getBcvRates`
```javascript
const options = {
  days: 15,    // Días de histórico bancario a recuperar
  page: 1,      // Número de página para navegación (paginación)
  strictSSL: false
};
const bcv = await getBcvRates(options);
```

## 🛡️ Soporte SSL y Entornos Inestables

Debido a que los portales gubernamentales venezolanos suelen presentar intermitencias en sus certificados SSL, esta librería incluye por defecto `strictSSL: false`. Esto asegura que el scraping no se detenga por errores de certificado auto-firmado o vencido, garantizando la continuidad del servicio en aplicaciones críticas de Venezuela.

## 👤 Autor

**José Carrillo**
- Sitio Web: [carrillo.app](https://carrillo.app)
- Tech Lead & Desarrollador Fullstack.
- Contacto: [m@carrillo.app](mailto:m@carrillo.app)

## ⚖️ Licencia

Este proyecto está bajo la Licencia MIT. Consulte el archivo [LICENSE](LICENSE) para más información.

---
*Desarrollado para fortalecer la transparencia financiera y la integración en el eje fronterizo.*
