# Astil · Cotizador

Interfaz oficial del cotizador seleccionada por el propietario el **5 de noviembre de 2026**. La propuesta antes denominada «B» pasa a ser la base de trabajo del cotizador y sustituye la portada de este repositorio. Las menciones a B en nombres internos o pruebas identifican su origen histórico; no son otra versión vigente.

- [Abrir cotizador](https://gusvann.github.io/duco-cotizaciones-demo/)
- [Repositorio](https://github.com/Gusvann/duco-cotizaciones-demo)

## Alcance

Mesa y Flujo comparten expedientes con Solicitud, Cotizador, Revisión, Envío, Respuesta y Proyecto. Portafolio incorpora KPIs. El seguimiento de proyectos, planificación, abastecimiento, producción y entrega conserva los ejemplos y contratos locales existentes; esta elección del cotizador no oficializa políticas operativas del ERP.

La aplicación funciona **sólo en memoria durante la sesión**. Recargar o usar Reiniciar sesión descarta la captura. No hay backend, autenticación real, almacenamiento persistente, telemetría ni conexiones con Google, Asana, Astil o bases de datos. No captures información empresarial o personal adicional. La publicación del frontend no acredita integración productiva.

## Captura y recetas

- Las solicitudes nuevas empiezan sin artículos. Producto de línea permite elegir explícitamente entre Mesa Florencia, Cubierta de madera y Bolonia, con seis variantes de referencia.
- El editor utiliza tablas continuas, controles compactos, cantidad comercial en el encabezado y unidades visibles. Pieza y Juego admiten enteros positivos; los consumos conservan sus unidades y decimales.
- En madera, **Confirmar cambios** valida y aplica la pieza; **Descartar** recupera la captura anterior. Cambiar de pieza o expediente exige resolver cambios pendientes. No hay autoguardado de las piezas de madera. Los demás renglones conservan su captura automática en sesión.
- Confirmar una pieza no reemplaza el snapshot de **Guardar borrador**. El guardado debe tener resultado confirmado; errores y resultados desconocidos conservan sus protecciones.
- La cubierta de Florencia conserva CNC de 244 cm × 1. Sus patas y travesaños no llevan entablerado ni CNC. Tableros incluye composición, cantidad, medidas/superficie, cantos, caras, recorrido CNC y costo base.
- Bolonia · Encino rojo incluye sus herrajes, madera, bajo cubierta Lisapol de 12 mm y componentes metálicos. Tuerca inserto utiliza PZA por corrección directa del propietario. El selector contiene los 13 materiales incorporados a esta versión.
- El costo base de tablero deriva de área × precio por hoja ÷ área de hoja × (1 + desperdicio). La cantidad comercial escala una sola vez antes del redondeo. Base calculada y compra confirmada siguen siendo conceptos distintos.
- Las seis recetas e importes históricos normalizados están incluidos en la publicación autorizada. No se incluyen libros originales, extracciones privadas, contactos, identificadores operativos ni otros registros empresariales. Los precios históricos no acreditan moneda, impuestos o vigencia actuales.
- Los campos ausentes o inválidos siguen siendo distintos de cero. Las referencias de procesos y CNC no activan tarifas financieras ni completan un costo pendiente por mostrarse en pantalla. Primer y acabado final productivos conservan su alcance diferido.
- Las imágenes del catálogo son ilustraciones; no fotografías verificadas del producto.

## KPIs, versiones y proyectos

Los expedientes y los KPIs usan datos ficticios compartidos. Ventas toma el precio neto de la versión aceptada correspondiente; un borrador posterior no cambia esa base. Preparación y cierre utilizan hitos estructurados y fechas de calendario. Filtros, denominadores y exclusiones permanecen visibles.

Cada envío conserva su versión. La aceptación y la conversión se vinculan con ella; un reintento devuelve el mismo proyecto. Planeación y seguimiento no reescriben el presupuesto aceptado ni representan compras, cobros, inventario o entrega física.

## Construir y comprobar

Requiere Node.js; el build y las pruebas de dominio no instalan dependencias.

```text
node tools/build.mjs
node tools/build.mjs --check
node tools/verify.mjs
node --test --test-concurrency=1 --test-reporter=spec tests/domain.mjs tests/kpis.mjs tests/kpis-handlers.mjs tests/recipes.mjs tests/recipe-reference.mjs tests/recipe-workshop.mjs tests/wood-pieces.mjs tests/wood-presentation.mjs tests/row-layout.mjs tests/boards.mjs tests/project-operations.mjs tests/project-handlers.mjs
```

El build genera un único `index.html` con fuentes, imágenes, estilos y scripts incrustados. `--check` no escribe y rechaza una salida distinta. La fuente histórica D85 permanece congelada; las adaptaciones viven en módulos de extensión. La política de contenido bloquea conexiones externas, frames y envíos de formularios. Las pruebas de VM no prueban autorización, persistencia real ni presentación visual.

La corrida de esta publicación aprobó **209/209 pruebas Node**, sin fallos ni omisiones, y los verificadores de construcción reproducible y seguridad estática. HTML SHA-256: `9e66748008689c16ae92ce752886a1ac50f792d9e44e8e68c7955c4e2b013365`. Los resultados de cada ejecución se conservan localmente en `artifacts/`, excluido de Git. La aceptación visual de la nueva versión no se atribuye a pruebas de checkpoints anteriores.

`tests/acceptance.mjs` contiene la aceptación de navegador y necesita un entorno autorizado con Playwright y Chromium ya disponibles. No forma parte del build ni de los comandos anteriores. La inspección automática del archivo local está pendiente por una restricción del navegador; no se ha eludido esa restricción.

## Publicación y recuperación

Destino autorizado: `Gusvann/duco-cotizaciones-demo`, rama `main`, con la configuración existente de GitHub Pages. Se conserva el historial mediante un commit descendiente y comprobación del SHA esperado, sin force push. El checkpoint público anterior es `4990b1cc6d7218f93425269d5eb70497310c2558`.

La publicación de esta interfaz no modifica el cotizador operativo, Astil, sus documentos canónicos ni servicios conectados. Ante una regresión crítica de publicación, la recuperación consiste en un nuevo commit que restaure el árbol anterior; no se reescribe el historial.

Las rutas [Cotizador clásico](cotizador-clasico/) y [Fabricación](fabricacion/) permanecen como referencias anteriores.

## Catálogo telefónico y atribuciones

245 regiones geográficas offline: territorio, nombre en español y lada; México (+52) por defecto. La lada sola no se guarda como teléfono. Los códigos compartidos no identifican automáticamente un país.

- [libphonenumber v9.0.42, corte 8593ab70](https://github.com/google/libphonenumber/blob/8593ab70fa4fadffc042b2714034f4c52bef7daf/resources/PhoneNumberMetadata.xml), © 2009 The Libphonenumber Authors, [Apache 2.0](licenses/libphonenumber-Apache-2.0.txt).
- [Unicode CLDR, corte d2f155b4](https://github.com/unicode-org/cldr-json/blob/d2f155b4b2fd98b0b2453e2e09ce76794b5749c2/cldr-json/cldr-localenames-full/main/es/territories.json), © 2015–2024 Unicode, Inc., [licencia Unicode](licenses/unicode-cldr.txt).

Este README describe el uso, construcción y límites del frontend. No reemplaza las especificaciones del cotizador ni de Astil. No se ha definido una licencia de reutilización para el código propio.
