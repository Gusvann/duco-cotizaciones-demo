# Recetas de fabricación en el cotizador

Corte del 22 de noviembre de 2026. En **Artículos → Producto de línea**, elige el producto, selecciona la variante y pulsa **Usar este producto**. Captura la cantidad comercial en el encabezado. Abre **Madera maciza**, **Tableros** o **Herrería** para ver el despiece y el subtotal de cada operación. Cada artículo recibe su propia copia de la receta.

## Del Excel a la captura

| Origen | Qué se captura | Cómo comprobar la lectura |
| --- | --- | --- |
| P1, Florencia de Tzalam | Pieza, cantidad por artículo, especie, dimensiones, caras, entablerado, desperdicio y CNC. Los rubros siguientes agrupan dóminos, mano de obra, jornadas, acabados y consumibles. | Una mesa requiere una cubierta, cuatro patas y dos travesaños. Dos mesas requieren 2, 8 y 4 piezas. Para una mesa, la madera en bruto vale $1,083.27 y el total de madera maciza de I55 es $2,025.35. Los herrajes suman $22.00 al artículo. |
| P8 y P9, filas 58–95 | Tablero, sustrato, espesor, cantidad, ancho, largo, cantos, caras, recorrido CNC y repeticiones. En la pieza se consultan también recubrimiento, proveedor, precio por hoja y desperdicio. | El selector de sustratos conserva las 13 opciones de P9!F59. El bajo cubierta de Bolonia mide 71 × 71 cm, ocupa 0.5041 m² y tiene un costo base de $174.84. |
| P8 y P9, filas 98–106 | La lámina registra cantidad, ancho, largo, calibre y kg/m². | En Bolonia, una lámina de 66 × 66 cm y calibre 16 ocupa 0.4356 m². A 12.5 kg/m², pesa 5.445 kg. El peso se puede comprobar aun cuando siga pendiente el importe. |
| P8 y P9, filas 107–126 | El perfil registra sección, cantidad, longitud desarrollada y kg/m. Las operaciones se consultan por mano de obra, pintura, corte y rolado según corresponda. | Para las cuatro patas de Bent Legs, 4 × 0.77 m dan 3.08 m. A 0.99 kg/m, pesan 3.0492 kg. El lado del perfil cuadrado de 3/8 de pulgada se conserva como 0.9525 cm. |

En escritorio, varias columnas de una pieza se leen juntas. En móvil, la fila de Tableros se reorganiza en grupos con sus unidades visibles. En Madera maciza, la tabla permite desplazarse hasta la última columna manteniendo el resto de la pantalla en su sitio. [Tableros en escritorio](imagenes/tableros-bent-legs.png) · [Tableros en móvil](imagenes/tableros-movil.png) · [Lámina y perfiles de Bolonia](imagenes/herreria-bolonia.png)

## Importes de control para Bent Legs · Encino rojo

La mesa de P8 tiene 45 cm de diámetro y 46 cm de altura. La receta usa Lisapol de 12 mm para el bajo cubierta y conserva en la nota de esa pieza la mención de 9 mm del plano. La ilustración del catálogo es una recreación generada con IA.

| Rubro por mesa | Desglose comprobable | Subtotal |
| --- | --- | ---: |
| Tableros | Tablero $70.24, armado $40.50, integración $251.25, CNC $135.00 y consumibles/adicionales $20.11 | **$517.10** |
| Herrería | Acero $178.02, mano de obra $231.43, pintura $501.60 y seis rolados a $90.00 | **$1,451.05** |
| Madera maciza | Cubierta y operaciones de la receta | **$1,163.51** |
| Herrajes | Cuatro niveladores a $5.00 y cuatro tuercas a $0.50 | **$22.00** |

El costo de tablero parte del área de piezas por artículo, multiplicada por el precio de la hoja, dividida entre el área de la hoja y ajustada por desperdicio. En P8, 0.2025 m² × $868.62 ÷ 2.88 m² × 1.15 dan **$70.24** al presentar centavos. La longitud CNC de 1.80 m, a 5 min/m y $15/min, da **$135.00**.

El cotizador suma los importes a su precisión de origen y redondea al presentarlos. Por eso los subtotales visibles de una mesa suman $3,153.66 al agregarlos manualmente, mientras el total de la receta es **$3,153.65**. Con dos mesas, el valor de control es **$6,307.31**. Estos dos casos detectan tanto el redondeo anticipado como una segunda multiplicación de la cantidad comercial.

## Qué significa cada estado

| Lectura | Interpretación |
| --- | --- |
| Sin captura | El rubro carece de renglones. |
| Pendiente | Falta un dato necesario para calcular el importe. Una tarifa vacía conserva este estado. |
| Parcial | Se muestra la suma conocida y hay importes aplicables pendientes. |
| Tarifa capturada | La pieza tiene una tarifa de referencia y su importe depende de la fórmula y la base aplicables. Es el caso de operaciones de Bolonia. |
| Tarifa pendiente | Falta la tarifa de al menos una de las piezas del rubro. |
| Incluido | La operación ya está cubierta por un material vinculado y revisado. |
| $0.00 | La base y la tarifa permiten calcular cero. En mano de obra, capturar una tarifa de cero expresa trabajo sin cargo. |

## Qué aprendimos para la siguiente receta

1. **Identificar primero la unidad de cada tarifa.** En la misma hoja conviven precio por hoja, kg, m², metro lineal, minuto y día. Una tarifa de pintura por metro de perfil requiere otra base que la de lámina por m².
2. **Asignar cada importe a un único rubro.** En Bent Legs la media jornada de integración corresponde a Tableros y el rolado corresponde a Herrería. Al revisar una pieza con compra compartida o trabajo incluido, comprobar que su costo se cuente una sola vez.
3. **Cotejar una unidad y luego dos.** Editar una copia de la receta, verificar cantidades físicas y totales del artículo, y abrir una segunda copia para comprobar que conserva los valores iniciales. Un cambio manual de costo en la ficha maestra para cuadrar un centavo rompería esa comprobación.
4. **Conservar las discrepancias de origen junto a la pieza.** En Bolonia, la unidad de la tuerca inserto se corrigió a PZA por confirmación del propietario. En Bent Legs, la nota de espesor permite revisar la diferencia con el plano.
5. **Identificar las pruebas por familia.** Madera, Tableros y Herrería ahora comparten estilos. La prueba móvil de Florencia localiza la familia de madera mediante `data-article-fold="wood"`; buscar el estilo compartido seleccionaba tres paneles. La prueba sigue comprobando el foco y la última columna a 360, 390 y 468 px.

## Catálogo de prueba del 24 de noviembre de 2026

La galería y el selector de artículos comparten 135 variantes del corte de fabricación del 24 de noviembre de 2026. En GitHub Pages se consultan despieces, consumos, operaciones, tarifas e importes históricos junto con la hoja y las referencias disponibles. Las cotizaciones nuevas reciben una copia del despiece publicado. Los borradores anteriores recuperan la receta de demostración con que se crearon.

La proyección de fabricación se genera con `node tools/publish-recipes.mjs RUTA_EXTRACCIÓN`. La salida `src/published-recipes.js` conserva las unidades, los decimales y los importes en cero. La procedencia identifica el libro por número e incluye los rangos y páginas de corrección disponibles. El respaldo de trabajo conserva la correspondencia con los libros originales.

Para el despliegue `86af449`, se cotejaron las 135 variantes y los 4,468 renglones de referencia económica con la extracción de trabajo. Pasaron las 274 pruebas de Node y los 34 recorridos de Edge sin conexión. En HTTP local se comprobó una actualización de la versión anterior con un borrador guardado en el mismo navegador. En GitHub Pages se verificaron una nueva cotización con despiece real y la consulta móvil de la receta.

Las 34 ilustraciones de la primera serie mantienen su identificador. Las siguientes tienen una foto WebP y una miniatura WebP; sus hashes se comprueban en el manifiesto de imágenes. Una variante conserva su fotografía al cambiar el precio o la cantidad cotizada. Los tonos de tapicería representativos se identifican en la ficha.

## Verificación histórica del rediseño de despieces

HTML de la vista revisada, SHA-256 `dce0c13ea1261c200b1cfe9024075d477caa6b601dd95e635b8fec7d50da460c`. La receta normalizada vive en [recipe-reference.js](../src/recipe-reference.js), la geometría y los costos en [fabrication-costs.mjs](../src/fabrication-costs.mjs) y [board-calculator.mjs](../src/board-calculator.mjs), y la edición por rubro en [row-variant.mjs](../src/row-variant.mjs).

La compilación reproducible y el verificador estático pasaron sobre el HTML identificado arriba. La suite de Node pasó **219 de 219 pruebas**. En Edge pasaron **cuatro recorridos** y **tres controles globales**. Se registraron cero solicitudes externas, cero escrituras persistentes y cero errores de consola o navegador durante esos recorridos.

Las [pruebas de recetas](../tests/recipes.mjs) comparan importes con los controles de P1, P8 y P9, comprueban el escalado y distinguen vacío de cero. La [aceptación de navegador](../tests/acceptance.mjs) cubre la edición de una lámina, la tarifa CNC, la imagen del catálogo y el acceso a las columnas en móvil. Estos comandos repiten la aceptación en PowerShell con Playwright y Edge instalados.

```powershell
$env:DEMO_BROWSER_CHANNEL = 'msedge'
$env:DEMO_TEST_FILTER = 'Bent Legs tiene imagen|Tableros y herrería muestran|Bolonia permite editar|Florencia móvil'
node tests/acceptance.mjs
```

Los comandos de compilación, verificación estática y pruebas Node están en el [README](../README.md#construir-y-comprobar). El informe de navegador se genera en `artifacts/acceptance-report.json` con la huella del HTML ejecutado. La aplicación publicada conserva datos de sesión en memoria.
