# Astil · Cotizador

Interfaz oficial del cotizador seleccionada por el propietario el **5 de noviembre de 2026**. La propuesta antes denominada «B» pasa a ser la base de trabajo del cotizador y sustituye la portada de este repositorio. Las menciones a B en nombres internos o pruebas identifican su origen histórico; no son otra versión vigente.

- [Abrir cotizador](https://gusvann.github.io/duco-cotizaciones-demo/)
- [Ver la galería de productos](https://gusvann.github.io/duco-cotizaciones-demo/catalogo.html)
- [Repositorio](https://github.com/Gusvann/duco-cotizaciones-demo)

## Alcance

Mesa y Flujo comparten expedientes con Solicitud, Cotizador, Revisión, Envío, Respuesta y Proyecto. Portafolio incorpora KPIs. El seguimiento de proyectos, planificación, abastecimiento, producción y entrega conserva los ejemplos y contratos locales existentes; esta elección del cotizador no oficializa políticas operativas del ERP.

Por corrección directa del propietario del 5 de noviembre, «Mapa del proceso» ya no se ofrece en el menú de escritorio ni en el menú móvil. Se conserva el resto de la navegación y del recorrido.

### Probar una cotización en GitHub Pages

1. Abre **Nueva solicitud**, completa los datos de ejemplo y entra a **Artículos → Agregar producto → Producto de línea**. El catálogo permite elegir entre 135 variantes de 12 productos. La geometría, el material y el canto ayudan a identificar la ilustración.
2. Edita cantidades o despieces y pulsa **Guardar borrador**. Una vez confirmado el guardado, puedes cerrar la pestaña y abrir el expediente desde Mesa en el mismo perfil del navegador.
3. Completa los datos comerciales y las dos revisiones, registra el envío de prueba y la aceptación de esa misma versión. **Convertir en proyecto** crea la ficha en **Portafolio → Proyectos**. La ficha conserva la versión aceptada y su importe.
4. Los cambios de la prueba se guardan en IndexedDB en el navegador que los creó. Un segundo perfil comienza con los expedientes ficticios de muestra. Borrar los datos del sitio también borra las pruebas de ese perfil.

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

La pantalla usa «Formulario continuo». Los datos de cliente y responsables se consultan en el formulario, y el encabezado conserva el folio, la versión, el título y el estado. **Continuar sin guardar** abre Artículos. En la vista privada, **Guardar borrador** confirma el borrador en la base local y **Nuevo cliente** registra un cliente para reutilizarlo en otras solicitudes. Las pestañas Cliente, Artículos, Costos generales, Precio y Revisión comparten la misma posición. Al cambiar de pestaña, el foco acompaña la selección sin desplazar la página. En móvil, las pestañas se distribuyen en dos filas. Las etapas comerciales aparecen en las pantallas de revisión, envío, respuesta y proyecto.

### Prueba privada del cotizador

La vista privada guarda borradores, versiones y proyectos en **DucoCotizador** dentro de AppData. El archivo HTML que se puede publicar conserva las pruebas de demostración y las recetas documentadas. La vista privada arranca con los datos importados y los expedientes que se hayan guardado en el equipo.

El catálogo de trabajo se importa con `node tools/private-server.mjs import --recipes RUTA_JSON`. El archivo contiene las colecciones `products` y `rows`. Cada fila identifica la variante y su producto, el despiece, los consumos, las operaciones y las referencias históricas. Una revisión reutiliza el identificador de la variante. El importador comprueba el conjunto antes de sustituirlo en la base local. La página carga estas recetas al abrirse con una sesión autorizada. El HTML distribuible contiene únicamente el catálogo de demostración.

En los insumos que se compran en una unidad distinta de la de consumo, la ficha conserva ambas unidades. Si la superficie de compra depende del lote, la cantidad de lienzos se captura cuando se conoce su medida. Los consumos por pieza siguen disponibles durante la cotización.

El arranque requiere Node 24 y una cuenta local. El servidor escucha en 127.0.0.1.

```powershell
node tools/build.mjs
node tools/private-server.mjs serve --port 61048
```

En Windows, la cuenta de cotización se puede vincular una sola vez al perfil del operador con `node tools/private-server.mjs link-windows --user NOMBRE`, pasando la contraseña de esa cuenta por entrada estándar. Desde ese perfil, abrir `http://127.0.0.1:61048/` inicia la sesión de cotización automáticamente. El servidor comprueba el propietario y la sesión de Windows de la conexión entrante. **Cerrar sesión** lleva al acceso manual, disponible también en `/acceso` para Dirección.

Para aprovisionar una cuenta, ejecutar `node tools/private-server.mjs provision --user NOMBRE --role account` y suministrar una contraseña por entrada estándar. Para una cuenta de Dirección, el propietario autorizado ejecuta el mismo comando con `--role direction`. El servidor guarda verificadores derivados mediante scrypt y la cuenta de Dirección confirma desde su propia sesión. La solicitud de alta y la aprobación se vinculan a la revisión guardada de una receta. Los cambios posteriores requieren otra aprobación.

**Es un prototipo** está disponible al agregar un producto nuevo. Cada prototipo tiene su propio margen inicial editable del 40 %. Precio utiliza el costo estimado aplicado del artículo y calcula el menor precio unitario en centavos que alcanza el margen después del descuento y antes de IVA. **Usar precio sugerido** aplica ese precio. Si el costo está incompleto, la sugerencia queda pendiente.

### Carga puntual de datos

Pasar las exportaciones de tareas de Asana al comando `node tools/private-server.mjs import --projects RUTA --quotes RUTA --through AAAA-MM-DD`. En la primera carga indicar los identificadores de lista con `--project-list-id ID` y `--quote-list-id ID`. Los identificadores se guardan en la base privada. Se puede cargar cada lista por separado. La importación selecciona las tareas principales por fecha de creación en Ciudad de México y agrega sus subtareas pertinentes. El ID original identifica cada registro. La ficha de proyecto usa el folio compacto cuando aplica y conserva el folio de Asana. La búsqueda acepta ambos formatos. Volver a importar actualiza la copia de la lista elegida.

Para proveedores, usar `node tools/private-server.mjs import --suppliers RUTA` con los encabezados `Proveedor_ID`, `Proveedor`, `Alias` y `Estado_Proveedor`. El buscador consulta nombres y alias y conserva el identificador al guardar. La consulta histórica, la vigencia y el IVA están en el detalle de compra. Para fechas de primera venta acreditadas, usar `--clients RUTA` con `Cliente_ID`, `Cliente` y `Fecha primera venta`. La cobertura de KPIs depende de los hitos y precios verificables en las fuentes importadas.

### Avisos durante la cotización

Los avisos siguen el mismo recorrido para productos de línea y artículos nuevos. En **Cliente y solicitud**, los datos pendientes se revisan al continuar. En **Artículos**, cada partida presenta su importe conocido y sus campos pendientes. Una tarifa de mano de obra en cero cuenta como trabajo sin cargo. Borrar la tarifa deja pendiente esa operación.

Una receta aporta precios editables como estimación para la cotización. La procedencia se conserva al cambiar la cantidad de productos. La interfaz pide directamente la unidad, el precio o el IVA de compra que falte para calcular una partida. El IVA de **venta** se captura en **Precio**, junto con los términos comerciales. Un reparto de pagos de 70/30 ya distribuye el 100 % aun cuando siga pendiente el precio de venta.

En **Costos generales**, una decisión de alcance se comparte entre las partidas que dependen de ella. Empaque e indirectos porcentuales indican cuándo esperan el costo base. Un conflicto entre la instalación acordada y la declarada en fabricación requiere resolver esa diferencia. **Revisión** agrupa los pendientes por paso y permite abrir el campo correspondiente. Los cambios de alcance que afecten una versión previa se vuelven a revisar.

**Guardar y continuar** conserva un borrador con datos comerciales pendientes. Si el guardado se bloquea, el aviso identifica la causa. En la vista privada se guardan los despieces aplicados al artículo junto con la cotización.

### Menú lateral

Operación y Portafolio forman un acordeón en escritorio y móvil. Portafolio inicia abierto. Al abrir un grupo se cierra el otro y el grupo abierto puede plegarse. El filtro de Cotizador y la reapertura del menú móvil conservan el último despliegue de la sesión. Al cambiar de pantalla, se abre el grupo del destino. En móvil, el foco queda dentro del menú mientras está abierto. Escape lo cierra y devuelve el foco al botón **Abrir menú**.

En GitHub Pages, los borradores confirmados y los proyectos convertidos persisten en ese navegador. La apertura directa del archivo HTML conserva el modo de demostración en memoria. La vista privada usa la base local y protege su acceso con la cuenta local. La publicación del frontend no acredita integración productiva.

## Captura y recetas

La [guía de recetas de fabricación](docs/recetas-de-fabricacion.md) documenta los cortes de fabricación anteriores. En la demo pública, los despieces y las tarifas son ficticios. En el cotizador privado se usan los componentes y estimaciones de la receta importada.

- Madera maciza presenta seis subtotales para la cantidad solicitada. Suma los importes conocidos antes del redondeo. Si faltan tarifas aplicables, el costo se identifica como parcial. Los herrajes se agregan una vez al costo del artículo.
- En mano de obra, una tarifa vacía queda pendiente y una tarifa de cero representa un trabajo sin cargo. Al completar los seis rubros aplicables desaparece «parcial» del costo de madera. Cada tabla admite desplazamiento horizontal dentro de la vista móvil.
- Las solicitudes nuevas empiezan sin artículos. **Agregar producto** ofrece 135 variantes de 12 productos de línea, además de la captura de un producto nuevo. El recorrido se describe en [Catálogo de productos con ficha lateral](#catálogo-de-productos-con-ficha-lateral).
- Las fichas de Bent Legs distinguen el material de la cubierta. La demostración incluye operaciones de ejemplo que permiten ensayar el flujo de fabricación.
- El editor utiliza tablas continuas, controles compactos, cantidad comercial en el encabezado y unidades visibles. Pieza y Juego admiten enteros positivos; los consumos conservan sus unidades y decimales.
- Madera maciza muestra la **cantidad total de piezas** al cambiar la cantidad comercial. «Por artículo» conserva el despiece de una unidad. El costo usa el mismo multiplicador una sola vez.
- La captura de mano de obra por días en Madera maciza ofrece Carpintería, CNC / Láser y Acabados. Por decisión posterior del propietario se retiran Instalación, Tejido e Integración de esta sección, conservando los datos históricos y las reglas de alcance de la solicitud. Las tarifas restantes mantienen su correspondencia original; esta retirada no modifica costos guardados ni declara servicios gratuitos.
- En madera, **Confirmar cambios** valida y aplica la pieza; **Descartar** recupera la captura anterior. Cambiar de pieza o expediente exige resolver cambios pendientes. No hay autoguardado de las piezas de madera. Los demás renglones conservan su captura automática en sesión.
- Confirmar una pieza no reemplaza el snapshot de **Guardar borrador**. El guardado debe tener resultado confirmado; errores y resultados desconocidos conservan sus protecciones.
- Cada pieza de madera tiene su decisión de CNC y su recorrido. Tableros incluye composición, cantidad, medidas, superficie, cantos, caras y costo base.
- Tableros y Herrería presentan los rubros como el despiece de Madera maciza. En P8 y P9, las filas 58–95 corresponden al tablero y sus operaciones. Las filas 98–126 separan las láminas por superficie, los perfiles por longitud y los trabajos posteriores. Cada importe se asigna una vez a su rubro. Las tarifas capturadas en piezas sin fórmula de receta se identifican como tarifas y conservan su tratamiento económico original.
- La ficha de Bolonia identifica la madera de la cubierta y muestra su estructura metálica en la ilustración de la variante.
- El costo base de tablero deriva de área × precio por hoja ÷ área de hoja × (1 + desperdicio). La cantidad comercial escala una sola vez antes del redondeo. Base calculada y compra confirmada siguen siendo conceptos distintos.
- La demo pública presenta importes de prueba. En la instalación privada, los precios históricos de las recetas importadas se pueden usar como estimaciones editables. Su procedencia se conserva por separado de la vigencia comercial y de los datos fiscales de compra. Las recetas usan identificadores internos mientras se verifica el SKU. Los libros originales y las extracciones privadas se conservan fuera del repositorio.
- Los campos ausentes o inválidos siguen siendo distintos de cero. Las referencias de procesos y CNC no activan tarifas financieras ni completan un costo pendiente por mostrarse en pantalla. Primer y acabado final productivos conservan su alcance diferido.
- Las imágenes del catálogo son ilustraciones; no fotografías verificadas del producto.

## KPIs, versiones y proyectos

Mesa y Flujo combinan búsqueda, estado y responsable. Las cotizaciones abiertas señalan la antigüedad desde el séptimo día natural en el estado actual. Si falta la fecha de entrada al estado, se indica que la antigüedad no pudo verificarse.

El tablero combina período, categoría, cliente, tipo comercial y tipo de cliente. La primera venta anterior al período clasifica al cliente como recurrente. Si ocurrió durante el período se clasifica como nuevo. Sin evidencia, se muestra **Sin historial**. Los cierres de Producto de línea y Proyecto miden del primer envío a la aceptación. En el detalle y en las barras de ventas se usa el importe neto aceptado de esa versión. Las aceptaciones con importe desconocido quedan pendientes de cuantificar.

Cada envío conserva su versión. La aceptación y la conversión se vinculan con ella; un reintento devuelve el mismo proyecto. Planeación y seguimiento no reescriben el presupuesto aceptado ni representan compras, cobros, inventario o entrega física.

## Construir y comprobar

La construcción usa Node.js. Las pruebas del servicio local usan el módulo integrado node:sqlite.

```text
node tools/build.mjs
node tools/build.mjs --check
node tools/verify.mjs
```

En PowerShell, la suite de Node se ejecuta con todas las pruebas de primer nivel salvo el recorrido de Edge.

```powershell
$pruebas = (Get-ChildItem tests -Filter *.mjs -File | Where-Object Name -ne acceptance.mjs).FullName
node --test --test-concurrency=1 --test-reporter=spec $pruebas
```

El build genera `index.html` con fuentes, estilos y scripts de la aplicación. Las fotos y miniaturas se cargan desde las carpetas de imágenes del mismo sitio cuando se consulta el catálogo. `--check` no escribe y rechaza una salida distinta. La fuente histórica D85 permanece congelada; las adaptaciones viven en módulos de extensión. La política de contenido bloquea conexiones externas, frames y envíos de formularios. Las pruebas de VM no prueban autorización, persistencia real ni presentación visual.

La corrida de la publicación inicial (`0027b3a5`) aprobó **209/209 pruebas Node**, sin fallos ni omisiones, y los verificadores de construcción reproducible y seguridad estática. HTML de ese checkpoint SHA-256: `9e66748008689c16ae92ce752886a1ac50f792d9e44e8e68c7955c4e2b013365`. Los resultados de cada ejecución se conservan localmente en `artifacts/`, excluido de Git. La aceptación visual de una corrección posterior no se atribuye a pruebas de checkpoints anteriores.

`tests/acceptance.mjs` contiene la aceptación de navegador y necesita un entorno autorizado con Playwright y Chromium ya disponibles. El 21 de noviembre se ejecutó en Edge la prueba «Florencia móvil» a 360, 390 y 468 px sobre el HTML local. Comprueba el ancho del documento, el acceso a la última columna y el foco al editar tarifas. Se puede repetir con `DEMO_TEST_FILTER=Florencia m` y `DEMO_BROWSER_CHANNEL=msedge`.

Para ejecutar la aceptación completa en Edge, quita el filtro de la sesión de PowerShell.

```powershell
$env:DEMO_BROWSER_CHANNEL = 'msedge'
Remove-Item Env:DEMO_TEST_FILTER -ErrorAction SilentlyContinue
node tests/acceptance.mjs
node tests/browser/public-pages.mjs
```

Con `PAGES_TEST_URL=https://gusvann.github.io/duco-cotizaciones-demo/`, la segunda prueba usa Pages y comprueba que el navegador recibió el HTML de esta versión. Utiliza un perfil temporal y datos ficticios.

Los recorridos de edición usan la cantidad en la cabecera, el desplegable **Datos del artículo** y los controles **Confirmar cambios** y **Descartar** de la pieza. La aceptación por HTTP comprueba el guardado y la reapertura en el mismo perfil de Edge, la conversión y las imágenes del catálogo.

## Publicación y recuperación

El 24 de noviembre de 2026 se verificó el catálogo de 135 variantes y el recorrido de cotización a proyecto. El SHA-256 del HTML es `550bbdf9215c8772425ae7eadc1676c9d42345eb33ff74c920e77abc911b9d0b`. Pasaron 274 pruebas de Node, 34 recorridos de Edge al abrir el archivo local y 7 recorridos de Edge sobre HTTP en localhost. Estos últimos incluyen cerrar y reabrir una cotización con madera, recuperar una escritura fallida, resolver ediciones de dos pestañas y convertir la versión aceptada en un único proyecto. El selector y la galería se probaron con las 135 imágenes en el navegador.

El destino es `Gusvann/duco-cotizaciones-demo`, rama `main`, con la configuración existente de GitHub Pages. La entrega del 23 de noviembre parte de [063d346](https://github.com/Gusvann/duco-cotizaciones-demo/commit/063d346f610b5b5895f3b6d635fd209998637673) e incorpora el diseño «Líneas limpias», el formulario continuo y el catálogo con ficha lateral. El SHA-256 de su `index.html` es `a4abc6971673da346546e191cb86650733568b88b26980d524ce46fc8bfb59ab`. Compararlo con el de la portada servida permite comprobar qué versión recibió el navegador. El corte de fabricación del 22 de noviembre conserva su [propia verificación](docs/recetas-de-fabricacion.md#verificación-del-corte).

La publicación de esta interfaz no modifica el cotizador operativo, Astil, sus documentos canónicos ni servicios conectados. Ante una regresión crítica de publicación, la recuperación consiste en un nuevo commit que restaure el árbol anterior; no se reescribe el historial.

Las rutas [Cotizador clásico](cotizador-clasico/) y [Fabricación](fabricacion/) permanecen como referencias anteriores.

## Catálogo telefónico y atribuciones

245 regiones geográficas offline: territorio, nombre en español y lada; México (+52) por defecto. La lada sola no se guarda como teléfono. Los códigos compartidos no identifican automáticamente un país.

- [libphonenumber v9.0.42, corte 8593ab70](https://github.com/google/libphonenumber/blob/8593ab70fa4fadffc042b2714034f4c52bef7daf/resources/PhoneNumberMetadata.xml), © 2009 The Libphonenumber Authors, [Apache 2.0](licenses/libphonenumber-Apache-2.0.txt).
- [Unicode CLDR, corte d2f155b4](https://github.com/unicode-org/cldr-json/blob/d2f155b4b2fd98b0b2453e2e09ce76794b5749c2/cldr-json/cldr-localenames-full/main/es/territories.json), © 2015–2024 Unicode, Inc., [licencia Unicode](licenses/unicode-cldr.txt).

Este README describe el uso, construcción y límites del frontend. No reemplaza las especificaciones del cotizador ni de Astil. No se ha definido una licencia de reutilización para el código propio.
