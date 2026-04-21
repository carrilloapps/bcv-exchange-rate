# Guía: seguridad y TLS

Esta librería consume fuentes públicas oficiales. La principal superficie de riesgo es la configuración TLS y las implicaciones del scraping.

## `strictSSL`: por qué `true` por defecto

El portal `bcv.org.ve` sirve con frecuencia certificados expirados o con cadena incompleta. Pese a ello, el valor por defecto es `true`: un default permisivo dejaría que cualquier consumidor instalara la librería y, sin saberlo, quedara expuesto a un MITM silencioso.

Si necesitas relajar la validación, hazlo de forma explícita. Cada llamada con `strictSSL: false` emite un `warn` para que la decisión sea consciente.

### Qué hacer si te encuentras con `NetworkError: ... certificate`

1. **Decisión consciente.** Desactiva con `strictSSL: false`. Sabrás que está ocurriendo porque la librería emite un `warn` en cada llamada.
2. **Opción preferida.** Utiliza un agente corporativo o un proxy que intercepte con una CA propia, y carga tu CA bundle en Node mediante `NODE_EXTRA_CA_CERTS`.

```typescript
await getBcvRates({ strictSSL: false });
// logger.warn: "TLS certificate validation is disabled (strictSSL: false)."
```

### Nunca desactives TLS por error

Si desactivas `strictSSL` porque «falla en staging», primero verifica:

- ¿Tu red tiene un proxy corporativo? Añade la CA del proxy.
- ¿El reloj del contenedor está correcto? Los certificados pueden reportarse como expirados cuando la fecha está mal.
- ¿Estás detrás de un _captive portal_? No es el BCV, es tu red.

Desactivar TLS «hasta que funcione» acostumbra al equipo a ignorar alertas legítimas.

## Modelo de amenazas

### Dentro del alcance

- **MITM en TLS** si `strictSSL: false`. Mitigación: default `true` más `warn` al desactivar.
- **Credenciales en URL o logs.** La librería no acepta credenciales (los portales son públicos). No hay secretos que filtrar.
- **Cabeceras personalizadas.** `userAgent` es configurable; no se sanitizan las cabeceras inyectadas por el usuario.

### Fuera del alcance

- **Compromiso del portal oficial.** Si `bcv.org.ve` sirve HTML malicioso, sólo se parsea como texto (no se ejecuta). Los valores numéricos pasan por `parseVenezuelanNumber`.
- **Denegación de servicio contra el BCV.** La librería no garantiza que los consumidores respeten los límites de tasa. Usa la caché y mantén los reintentos moderados.

## Recomendaciones operativas

1. **Mantén `strictSSL: true`.** Si no puedes, documenta el motivo en tu repositorio.
2. **Alerta ante el `warn` de SSL relajado.** Tu logger debe dispararse si aparece `"TLS certificate validation is disabled"`.
3. **Fija versiones de dependencias.** `axios` y `cheerio` reciben parches de seguridad; Dependabot ya está configurado.
4. **No persistas respuestas sin validarlas.** Si cacheas en Redis, trata los valores como «datos externos» al deserializar.
5. **Limita tu propio consumo.** `cacheTtlMs >= 60_000` para las consultas de tasas oficiales es razonable; no hace falta consultar con mayor frecuencia que la de actualización del BCV.

## Reporte de vulnerabilidades

Consulta [`SECURITY.md`](../../SECURITY.md) en la raíz del repositorio. **No abras incidencias públicas para vulnerabilidades.**
