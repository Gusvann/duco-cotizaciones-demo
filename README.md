# Astil · Cotizador

Interfaz oficial del cotizador seleccionada por el propietario el **5 de noviembre de 2026**. La propuesta antes denominada «B» pasa a ser la base de trabajo del cotizador y sustituye la portada de este repositorio. Las menciones a B en nombres internos o pruebas identifican su origen histórico; no son otra versión vigente.

- [Abrir cotizador](https://gusvann.github.io/duco-cotizaciones-demo/)
- [Repositorio](https://github.com/Gusvann/duco-cotizaciones-demo)

## Alcance

Mesa y Flujo comparten expedientes con Solicitud, Cotizador, Revisión, Envío, Respuesta y Proyecto. Portafolio incorpora KPIs. El seguimiento de proyectos, planificación, abastecimiento, producción y entrega conserva los ejemplos y contratos locales existentes; esta elección del cotizador no oficializa políticas operativas del ERP.

Por corrección directa del propietario del 5 de noviembre, «Mapa del proceso» ya no se ofrece en el menú de escritorio ni en el menú móvil. Se conserva el resto de la navegación y del recorrido.

### Listas de Cotizador y Proyectos

La Mesa de cotizaciones y la lista de Proyectos usan el diseño «Líneas limpias». Se identifican con `j-list-table` y comparten los estilos de `src/list-tables.css`. El encabezado azul claro, los divisores finos y las acciones discretas mantienen la lectura por columnas. En móvil, el desplazamiento horizontal se realiza dentro de la tabla.

El encabezado, las listas, el formulario y el pie se alinean con el margen lateral compartido de 16 a 26 px. El área de trabajo usa el ancho disponible a partir del menú lateral. Proyectos usa la misma jerarquía visual que Cotizador y KPIs, con «Del plan a la entrega» en una segunda línea azul y el total de proyectos junto a la lista.

### Catálogo de productos con ficha lateral

«Lista con ficha lateral» es el diseño aprobado el 23 de noviembre de 2026 para **Artículos → Agregar producto → Producto de línea**. El buscador y el filtro por familia actúan sobre la lista. La ficha del producto seleccionado contiene su imagen, descripción, selector de variante y datos técnicos. **Usar este producto** se habilita al elegir una variante y copia su receta al artículo.

- [`src/list-tables.css`](src/list-tables.css) define las variables `--j-list-*` de borde, divisor, fondo al pasar el puntero, color del nombre y radio. La Mesa y Proyectos las aplican a `j-list-table`. El [estilo del catálogo](src/recipe.css) usa esas mismas variables en los resultados y en la ficha, y toma del cotizador el fondo azul de selección y el botón principal. Para ajustar un rasgo común del diseño, actualiza la variable compartida y revisa las tres vistas.
- La Mesa y Proyectos conservan sus tablas con encabezados por columna. El [catálogo](src/recipe-client.mjs) presenta los productos como una lista de botones con miniatura, nombre, familia y chevrón. El botón de la fila activa usa `aria-pressed`. La ficha se actualiza al cambiar de producto o de variante y las filas conservan su posición.
- La ficha queda a la derecha cuando el área interior del catálogo supera 560 px y debajo en espacios más estrechos. En la vista estrecha, el foco pasa a la ficha al activar una fila y **Volver a resultados** lo devuelve a la fila activa. Escape cierra el catálogo y devuelve el foco a **Producto de línea**.

[Captura de escritorio (1440 px)](docs/imagenes/catalogo-lista-ficha-escritorio.png) · [Captura móvil (390 px)](docs/imagenes/catalogo-lista-ficha-movil.png)

La [prueba de aceptación](tests/acceptance.mjs) «Catálogo con lista y ficha lateral» verifica el diseño a 1440, 1000 y 390 px, la selección por teclado, los filtros, el estado sin coincidencias y la elección explícita de variante. Se puede repetir en PowerShell con Playwright y Edge instalados.

```powershell
$env:DEMO_BROWSER_CHANNEL = 'msedge'
$env:DEMO_TEST_FILTER = 'Cat.logo con lista'
node tests/acceptance.mjs
```

### Cliente y solicitud

La pantalla usa «Formulario continuo». Los datos de cliente y responsables se consultan en el formulario, y el encabezado conserva el folio, la versión, el título y el estado. **Continuar sin guardar** abre Artículos y **Guardar borrador** confirma el borrador en la sesión. Las pestañas Cliente, Artículos, Costos generales, Precio y Revisión comparten la misma posición. Al cambiar de pestaña, el foco acompaña la selección sin desplazar la página. En móvil, las pestañas se distribuyen en dos filas. Las etapas comerciales aparecen en las pantallas de revisión, envío, respuesta y proyecto.

### Menú lateral

Operación y Portafolio forman un acordeón en escritorio y móvil. Portafolio inicia abierto. Al abrir un grupo se cierra el otro y el grupo abierto puede plegarse. El filtro de Cotizador y la reapertura del menú móvil conservan el último despliegue de la sesión. Al cambiar de pantalla, se abre el grupo del destino. En móvil, el foco queda dentro del menú mientras está abierto. Escape lo cierra y devuelve el foco al botón **Abrir menú**.

La aplicación funciona **sólo en memoria durante la sesión**. Recargar o usar Reiniciar sesión descarta la captura. No hay backend, autenticación real, almacenamiento persistente, telemetría ni conexiones con Google, Asana, Astil o bases de datos. No captures información empresarial o personal adicional. La publicación del frontend no acredita integración productiva.

## Captura y recetas

La [guía de recetas de fabricación](docs/recetas-de-fabricacion.md) relaciona los campos del cotizador con las hojas P1, P8 y P9. Incluye los importes de control, las vistas de escritorio y móvil y las pruebas para revisar otra receta.

- Desde el 21 de noviembre, Madera maciza presenta seis subtotales para la cantidad solicitada. Para una Florencia de Tzalam, P1 del libro de mesas da $1,083.27 de materia prima y $2,025.35 de madera maciza en I55. La vista suma los importes conocidos antes del redondeo y conserva el estado parcial cuando faltan tarifas. Los $22.00 de herrajes se agregan una vez al costo actual del artículo.
- En mano de obra, una tarifa vacía queda pendiente y una tarifa de cero representa un trabajo sin cargo. Al completar los seis rubros aplicables desaparece «parcial» del costo de madera. Cada tabla admite desplazamiento horizontal dentro de la vista móvil.
- Las solicitudes nuevas empiezan sin artículos. **Agregar producto** ofrece cuatro productos de línea con siete variantes, además de la captura de un producto nuevo. El recorrido se describe en [Catálogo de productos con ficha lateral](#catálogo-de-productos-con-ficha-lateral).
- Bent Legs · Encino rojo usa la receta de P8 para una mesa de Ø45 × 46 cm, con tablero Lisapol de 12 mm. Las referencias por mesa son $22.00 de herrajes, $1,163.51 de madera, $517.10 de tablero y $1,451.05 de herrería. El total de referencia usa los valores originales antes del redondeo y da $3,153.65 para una mesa y $6,307.31 para dos. El rolado se captura en Herrería y la media jornada de integración en Tableros. La imagen de catálogo es una recreación generada con IA.
- El editor utiliza tablas continuas, controles compactos, cantidad comercial en el encabezado y unidades visibles. Pieza y Juego admiten enteros positivos; los consumos conservan sus unidades y decimales.
- Madera maciza muestra la **cantidad total de piezas** al cambiar la cantidad comercial: dos mesas Florencia requieren 2 cubiertas, 8 patas y 4 travesaños. El campo **Por artículo** conserva la receta de una mesa; el total deriva del mismo motor que calcula los costos, sin volver a multiplicar la receta. Una cantidad vacía o inválida no se presenta como un total confirmado. Corrección solicitada por el propietario el 5 de noviembre de 2026.
- La captura de mano de obra por días en Madera maciza ofrece Carpintería, CNC / Láser y Acabados. Por decisión posterior del propietario se retiran Instalación, Tejido e Integración de esta sección, conservando los datos históricos y las reglas de alcance de la solicitud. Las tarifas restantes mantienen su correspondencia original; esta retirada no modifica costos guardados ni declara servicios gratuitos.
- En madera, **Confirmar cambios** valida y aplica la pieza; **Descartar** recupera la captura anterior. Cambiar de pieza o expediente exige resolver cambios pendientes. No hay autoguardado de las piezas de madera. Los demás renglones conservan su captura automática en sesión.
- Confirmar una pieza no reemplaza el snapshot de **Guardar borrador**. El guardado debe tener resultado confirmado; errores y resultados desconocidos conservan sus protecciones.
- La cubierta de Florencia conserva CNC de 244 cm × 1. Sus patas y travesaños no llevan entablerado ni CNC. Tableros incluye composición, cantidad, medidas/superficie, cantos, caras, recorrido CNC y costo base.
- Tableros y Herrería presentan los rubros como el despiece de Madera maciza. En P8 y P9, las filas 58–95 corresponden al tablero y sus operaciones. Las filas 98–126 separan las láminas por superficie, los perfiles por longitud y los trabajos posteriores. Cada importe se asigna una vez a su rubro. Las tarifas capturadas en piezas sin fórmula de receta se identifican como tarifas y conservan su tratamiento económico original.
- Bolonia · Encino rojo incluye sus herrajes, madera, bajo cubierta Lisapol de 12 mm y componentes metálicos. Su imagen de catálogo se generó con ImageGen a partir de la cubierta redonda de encino rojo y los cuatro perfiles con cruceta en negro grafito. Tuerca inserto utiliza PZA por corrección directa del propietario. El selector contiene los 13 materiales incorporados a esta versión.
- El costo base de tablero deriva de área × precio por hoja ÷ área de hoja × (1 + desperdicio). La cantidad comercial escala una sola vez antes del redondeo. Base calculada y compra confirmada siguen siendo conceptos distintos.
- El catálogo publicado contiene siete variantes con referencias normalizadas. Los importes históricos sirven para cotejar la captura. La vigencia comercial, moneda e impuestos requieren verificación en cada cotización. Los libros originales y las extracciones privadas se conservan fuera del repositorio.
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

La corrida de la publicación inicial (`0027b3a5`) aprobó **209/209 pruebas Node**, sin fallos ni omisiones, y los verificadores de construcción reproducible y seguridad estática. HTML de ese checkpoint SHA-256: `9e66748008689c16ae92ce752886a1ac50f792d9e44e8e68c7955c4e2b013365`. Los resultados de cada ejecución se conservan localmente en `artifacts/`, excluido de Git. La aceptación visual de una corrección posterior no se atribuye a pruebas de checkpoints anteriores.

`tests/acceptance.mjs` contiene la aceptación de navegador y necesita un entorno autorizado con Playwright y Chromium ya disponibles. El 21 de noviembre se ejecutó en Edge la prueba «Florencia móvil» a 360, 390 y 468 px sobre el HTML local. Comprueba el ancho del documento, el acceso a la última columna y el foco al editar tarifas. Se puede repetir con `DEMO_TEST_FILTER=Florencia m` y `DEMO_BROWSER_CHANNEL=msedge`.

## Publicación y recuperación

El destino es `Gusvann/duco-cotizaciones-demo`, rama `main`, con la configuración existente de GitHub Pages. La entrega del 23 de noviembre parte de [063d346](https://github.com/Gusvann/duco-cotizaciones-demo/commit/063d346f610b5b5895f3b6d635fd209998637673) e incorpora el diseño «Líneas limpias», el formulario continuo y el catálogo con ficha lateral. El SHA-256 de su `index.html` es `a4abc6971673da346546e191cb86650733568b88b26980d524ce46fc8bfb59ab`. Compararlo con el de la portada servida permite comprobar qué versión recibió el navegador. El corte de fabricación del 22 de noviembre conserva su [propia verificación](docs/recetas-de-fabricacion.md#verificación-del-corte).

La publicación de esta interfaz no modifica el cotizador operativo, Astil, sus documentos canónicos ni servicios conectados. Ante una regresión crítica de publicación, la recuperación consiste en un nuevo commit que restaure el árbol anterior; no se reescribe el historial.

Las rutas [Cotizador clásico](cotizador-clasico/) y [Fabricación](fabricacion/) permanecen como referencias anteriores.

## Catálogo telefónico y atribuciones

245 regiones geográficas offline: territorio, nombre en español y lada; México (+52) por defecto. La lada sola no se guarda como teléfono. Los códigos compartidos no identifican automáticamente un país.

- [libphonenumber v9.0.42, corte 8593ab70](https://github.com/google/libphonenumber/blob/8593ab70fa4fadffc042b2714034f4c52bef7daf/resources/PhoneNumberMetadata.xml), © 2009 The Libphonenumber Authors, [Apache 2.0](licenses/libphonenumber-Apache-2.0.txt).
- [Unicode CLDR, corte d2f155b4](https://github.com/unicode-org/cldr-json/blob/d2f155b4b2fd98b0b2453e2e09ce76794b5749c2/cldr-json/cldr-localenames-full/main/es/territories.json), © 2015–2024 Unicode, Inc., [licencia Unicode](licenses/unicode-cldr.txt).

Este README describe el uso, construcción y límites del frontend. No reemplaza las especificaciones del cotizador ni de Astil. No se ha definido una licencia de reutilización para el código propio.
