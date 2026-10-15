# Astil · Cotizaciones · demo estática

Abre `index.html` directamente en Chrome o Edge. No necesita servidor, instalación ni cuenta. Mesa de cotizaciones y Flujo de oportunidades muestran los mismos expedientes ficticios.

## Recorrer la demo

- **Recorrido completo:** abre la solicitud, trabaja en el cotizador, aplica los cambios, guarda en la simulación, registra revisión y envío, acepta la versión enviada y conviértela en un proyecto simulado.
- **Madera y CNC pendientes:** explora Panel de trabajo y el editor de madera. Aplicar CNC confirma sus condiciones en el subeditor; Aplicar pieza conserva el conjunto local. No hay tarifa CNC activa y su costo permanece pendiente. Los faltantes conservan sus bloqueos.
- **Productos con receta:** en Artículos, abre **Agregar producto → Producto de línea**, elige una variante y pulsa **Usar este producto**. Consultar el catálogo no añade artículos; cada producto requiere esa selección explícita. La petición posterior del 15-oct-2026 amplía la precarga a las cinco recetas de la vista D91 `duco-editor-costos-subtotales-20261015.html`: Mesa Florencia en Tzalam/Encino rojo y Cubierta de madera en Tzalam/Encino blanco/Encino rojo. Se conservan sus medidas, componentes, cantidades y herrajes de referencia. Las tablas de costos documentados y sus subtotales corresponden a UNA unidad; no se escalan ni se añaden como cargos. Cambiar la variante cambia su imagen ilustrativa generada con IA; no es una fotografía de fabricación ni valida la ingeniería de la receta. Los precios de esas cinco recetas son referencias históricas con moneda, impuestos y vigencia sin acreditar; la precarga no confirma costos, tarifas CNC ni persistencia de madera F. Primer y acabado final permanecen diferidos.
- **Portafolio → KPIs:** explora Resumen, Ventas y clientes y Tiempos. Las donas desglosan ventas, cotizaciones recibidas y aceptadas, y clientes nuevos/recurrentes; las barras mensuales se apilan por cliente. Las tarjetas muestran tickets por categoría y cierre de línea/proyecto. Los filtros de período, categoría y fecha de ventas comparten una sola proyección de los mismos expedientes. Cada indicador abre su detalle y las fichas permiten regresar conservando filtros y pestaña.
- **Reiniciar demo** restaura los ejemplos. Recargar o cerrar pierde todos los cambios, incluidos los guardados y proyectos simulados.

Los dos escenarios originales se conservan y se añaden diez expedientes sintéticos de referencia. Sus importes completos se calculan con el mismo motor; `DEMO-201` conserva una aceptación V1 aunque tenga un borrador V2. `DEMO-209` es una referencia histórica parcial explícita, con importe ausente: no representa un guardado confirmado ni permite revisar, enviar o convertir. Se puede consultar para comprender la cobertura de los indicadores.

Los KPIs muestran las siete familias de referencia: ventas, tickets, preparación, cierre, cotizaciones por cliente, cotizaciones por mes y nuevos/recurrentes. Se conservan seis categorías históricas y se añade **Logística y envíos**. Ventas y tickets usan el precio de la versión aceptada en centavos MXN sin IVA; las ausencias no se convierten en cero. Actividad usa la fecha de solicitud y los tiempos usan la cohorte aceptada, con denominadores propios de intervalos válidos.

El corte y el reloj son deterministas: **15 de octubre de 2026**. La fecha de aceptación es la base de ventas inicial; el selector anticipo/PO compara un hito ficticio y no registra cobros. La primera venta del cliente es un historial sintético declarado; sin historial, el cliente queda sin clasificar. Las definiciones, exclusiones y decisiones productivas pendientes se consultan dentro de la vista. La equivalencia con los relojes históricos de Asana no está acreditada.

La oferta, las bandejas y el proyecto usan el resultado del mismo cotizador, no importes comerciales independientes. Los perfiles de ejemplo sólo permiten explorar la interfaz: no prueban autenticación ni permisos reales. Revisión, envío, evidencia y conversión son ilustrativos; no definen políticas productivas.

**Expedientes de prueba y cinco recetas de referencia local. No captures información empresarial o personal adicional.** La demo no tiene base de datos, almacenamiento persistente, telemetría ni conexiones a Google, Asana o Astil. No envía mensajes, consulta catálogos empresariales, guarda archivos en servicios externos ni genera PDF operativo. La oferta se consulta dentro de la página.

## Referencias anteriores

- [Cotizador clásico · 29-sep-2026](cotizador-clasico/index.html).
- [Fabricación · 08-oct-2026](fabricacion/index.html).

Ambas conservan su comportamiento anterior y tienen una indicación visible de referencia histórica. El historial Git permanece disponible. La portada conserva intacta la fuente del cotizador D85 del 14-oct-2026 y aplica al construir una extensión local del catálogo y la presentación de D91 del 15-oct (referencia SHA-256 `eba78928ecd8d19f0b4836ac7e7a7306aa7772eef837c2da10ea80a69f337ba5`), con las ilustraciones IA de D89. Las cinco recetas se normalizan en `src/recipe-reference.js`, sin archivos originales, celdas, SKU reales, contactos o identificadores privados. Se mantienen identificadores internos de demo para no cambiar contratos. El build usa sólo las fuentes locales revisadas; no lee libros, catálogos cloud ni los proyectos operativos. La decisión posterior del 15-oct-2026 autoriza publicar esta versión completa en Gusvann/duco-cotizaciones-demo, incluidas las cinco recetas y sus importes históricos. Los expedientes y KPIs son sintéticos; las recetas de referencia no acreditan moneda, impuestos, vigencia o costos confirmados. Esto no acredita promoción a fuentes canónicas, integración de servidor o despliegue productivo.

## Construir y comprobar

Con Node.js, sin instalar dependencias para generar el HTML:

```text
node tools/build.mjs
node tools/build.mjs --check
node tools/verify.mjs
node --test tests/domain.mjs
node --test tests/kpis.mjs tests/kpis-handlers.mjs
node --test tests/recipes.mjs tests/recipe-reference.mjs
```

El HTML autónomo se genera desde `src/`, con fuentes, estilos y scripts incrustados. `--check` no escribe y rechaza un HTML desactualizado. La política de contenido bloquea conexiones externas, frames y formularios. Esta copia local contiene el recorrido de prueba y las cinco recetas de referencia solicitadas. No incluye módulos de servidor privilegiados, archivos empresariales originales, credenciales, contactos ni historial del producto privado.

Las pruebas de navegador abren el archivo local, con solicitudes externas bloqueadas y auditoría de almacenamiento:

```text
node tests/acceptance.mjs
```

Requieren un entorno que ya tenga Playwright y Chromium. `DEMO_NODE_MODULES` permite señalar su directorio de módulos sin añadir dependencias al producto. Los artefactos de prueba quedan en `artifacts/`, ignorado por Git. Las comprobaciones estáticas y la simulación no validan backend, aislamiento empresarial, Google real o producción.

Las pruebas nuevas de KPIs y handlers usan Node VM con DOM mínimo, sin navegador ni servidor. Comprueban el dominio y los controladores reales de esta demo; no acreditan su presentación visual. La aceptación de navegador descrita abajo corresponde a la entrega anterior y debe repetirse para acreditar un nuevo checkpoint visual.

También pueden usar Chrome ya instalado. La aceptación local de la entrega anterior se ejecutó así, desde PowerShell:

```powershell
$env:DEMO_BROWSER_CHANNEL='chrome'
node tests/acceptance.mjs
```

Este README explica únicamente el uso de la demo. Las especificaciones del cotizador y de Astil permanecen en sus proyectos; no se sustituyen aquí. No se ha definido una licencia de reutilización del código. Preparar una rama no publica la demo: incorporar cambios a la rama configurada en Pages puede actualizar su URL pública.
