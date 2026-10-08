# Duco Cotizaciones · demo pública local

Abre `index.html` directamente en Chrome. Esta copia independiente muestra la interfaz interactiva con datos ficticios y no necesita servidor ni cuenta Google.

Puedes recorrer Cliente, Partidas, Ficha Técnica, Costos adicionales, Precio y Revisión; cambiar entre los perfiles de muestra añadiendo `?role=account` o `?role=designer` al archivo. La búsqueda de clientes, usuarios y productos responde únicamente con fixtures incluidos en el HTML. Las ilustraciones y fuentes están incrustadas.

Esta es una demostración de interfaz, no el cotizador operativo. Guardar, enviar a revisión, aprobar, autenticar, consultar catálogos reales y obtener PDF requieren el backend autorizado de Apps Script y responden como operaciones no disponibles aquí. Los cambios de la vista se pierden al cerrar o recargar el archivo. No introduzcas datos reales.

La copia se derivó del HTML UAT local y sustituyó el identificador de catálogo operativo y la referencia nominal del cliente de prueba. Retiró el acceso a almacenamiento de sesión. Una política de contenido bloquea conexiones externas y limita fuentes e imágenes a datos incrustados. El código de Google Apps Script de producción y su historial no forman parte de este paquete.

Esta publicación estática no despliega el backend ni una aplicación operativa. No se ha definido una licencia de reutilización del código.

## Variante de fabricación UAT · actualización 08-oct-2026

La [vista vigente](fabricacion/index.html) reemplaza la variante anterior de esa carpeta, conservando el historial Git y la demo original en la raíz. Incluye Artículos, el despiece dentro de cada artículo y la estructura aprobada de Insumos / herrajes, Maquilas, Madera maciza, Tableros y Herrería. También abre directamente como HTML autónomo; `?role=account` y `?role=designer` seleccionan perfiles ficticios sólo para esta demo.

La captura de madera nueva calcula área, pies cúbicos reales, volumen con el desperdicio declarado, superficie de pintura y entablerado según los datos ingresados. No utiliza pies tablares ni las cifras del ejemplo de Excel. El espesor de esa captura está expresado en pulgadas. Un registro anterior exige confirmación explícita de esas unidades antes de usar la regla nueva.

El costo acumulado del artículo anticipa importes capturados sin duplicar compras compartidas o procesos ya incluidos. No equivale a un costo validado, margen completo ni guardado confirmado. Tarifas y fórmulas no validadas permanecen pendientes.

Esta variante sigue siendo pública, sintética y sin backend: guardar, enviar, aprobar, iniciar sesión real y descargar PDF operativo están deshabilitados. Los cambios viven sólo en memoria y se pierden al cerrar o recargar. La política de contenido bloquea conexiones externas y no se utiliza almacenamiento de sesión. No captures datos empresariales reales.

El HTML público es un derivado sanitizado de la vista UAT local, no una copia del repositorio de producto: excluye los identificadores operativos, archivos de servidor privilegiados, credenciales, evidencias privadas y datos empresariales. No publica Apps Script ni activa cambios en Google TEST o producción.
