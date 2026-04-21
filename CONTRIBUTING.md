# Guía de contribución

Gracias por tu interés en mejorar **bcv-exchange-rate**. Esta guía describe el flujo de trabajo esperado para reportes, parches y nuevas funcionalidades.

## Código de conducta

Al participar aceptas el [código de conducta](./CODE_OF_CONDUCT.md) del proyecto.

## Cómo reportar un error

Usa la plantilla **Bug report** en [Incidencias](https://github.com/carrilloapps/bcv-exchange-rate/issues). Incluye:

1. Versión de la librería y de Node.js.
2. Pasos reproducibles mínimos.
3. Resultado esperado y observado.
4. Si el error proviene del scraping: fecha y hora aproximadas (los portales oficiales cambian).

Para vulnerabilidades de seguridad, sigue [`SECURITY.md`](./SECURITY.md).

## Cómo proponer una funcionalidad

Abre una incidencia con la plantilla **Feature request** antes de escribir código. Así evitamos _pull requests_ grandes que no encajen con la dirección del proyecto.

## Flujo de trabajo para los _pull requests_

1. **Haz un _fork_** del repositorio y crea una rama desde `main`:
   ```bash
   git checkout -b feat/nombre-corto-descriptivo
   ```
2. **Instala las dependencias:**
   ```bash
   npm install
   ```
3. **Desarrolla.** Respeta las [convenciones de código](#convenciones-de-código).
4. **Añade o actualiza pruebas.** La suite exige **cobertura del 100 %**; el CI rechazará cualquier _pull request_ que la reduzca.
5. **Valida localmente:**
   ```bash
   npm run lint
   npm run format:check
   npm test
   npm run build
   ```
6. **Actualiza `CHANGELOG.md`** bajo la sección **Sin publicar**, usando las categorías de Keep a Changelog (`Añadido`, `Cambiado`, `Obsoleto`, `Eliminado`, `Arreglado` y `Seguridad`).
7. **Haz commits** siguiendo [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/):
   ```text
   feat(bcv): soporte para nueva moneda BRL
   fix(retry): evita backoff infinito en respuestas 4xx
   docs(api): aclara el contrato de status por sección
   ```
8. **Abre el _pull request_** contra `main` con una descripción completa; incluye enlaces a las incidencias relacionadas y utiliza la plantilla de _pull request_.

## Convenciones de código

- **Idioma.** Identificadores, comentarios y JSDoc en **inglés (en_US)**. Documentación (`README.md` y `docs/`) y mensajes de error visibles al consumidor en **español (es_VE)**.
- **TypeScript estricto.** `strict: true`, junto con `noImplicitOverride` y `noImplicitReturns`, están activos. Evita `any` sin justificación.
- **Estilo.** Prettier más ESLint: `npm run format` formatea en sitio y `npm run lint` valida.
- **Pruebas.** Usa `axios-mock-adapter` para simular la red. No añadas pruebas con dependencias externas reales.
- **Dependencias.** Evita añadir dependencias nuevas, salvo que resuelvan un problema concreto y no trivial. Las dependencias de _runtime_ requieren justificación explícita.
- **Documentación.** Cualquier cambio en la API pública debe reflejarse en `docs/api-reference.md` y en la guía temática correspondiente.

## Requisitos de pruebas

| Métrica    | Mínimo |
| ---------- | ------ |
| Branches   | 100 %  |
| Functions  | 100 %  |
| Lines      | 100 %  |
| Statements | 100 %  |

Ejecutar una prueba concreta:

```bash
npx jest -t "nombre del describe o it"
```

Ver únicamente las ramas no cubiertas:

```bash
npx jest --coverage
# Revisa coverage/lcov-report/index.html
```

## Publicación (sólo mantenedores)

La publicación en npm se realiza manualmente. Los pasos habituales son:

1. Comprueba que `main` esté en verde en CI.
2. Mueve las entradas de **Sin publicar** a una nueva versión fechada en `CHANGELOG.md`.
3. Ajusta la versión:
   ```bash
   npm version <patch|minor|major>
   ```
4. Ejecuta el _build_ y publica en npm:
   ```bash
   npm run build
   npm publish
   ```
5. Empuja el tag generado:
   ```bash
   git push --follow-tags
   ```
6. Crea el _release_ en GitHub referenciando el tag y copiando las notas de `CHANGELOG.md`.

## Licencia

Tu contribución se distribuye bajo la [licencia MIT](./LICENSE) del proyecto.
