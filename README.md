# Duco Cotizaciones · demo pública local

Abre `index.html` directamente en Chrome. Esta copia independiente muestra la interfaz interactiva con datos ficticios y no necesita servidor ni cuenta Google.

Puedes recorrer Cliente, Partidas, Ficha Técnica, Costos adicionales, Precio y Revisión; cambiar entre los perfiles de muestra añadiendo `?role=account` o `?role=designer` al archivo. La búsqueda de clientes, usuarios y productos responde únicamente con fixtures incluidos en el HTML. Las ilustraciones y fuentes están incrustadas.

Esta es una demostración de interfaz, no el cotizador operativo. Guardar, enviar a revisión, aprobar, autenticar, consultar catálogos reales y obtener PDF requieren el backend autorizado de Apps Script y responden como operaciones no disponibles aquí. Los cambios de la vista se pierden al cerrar o recargar el archivo. No introduzcas datos reales.

La copia se derivó del HTML UAT local y sustituyó el identificador de catálogo operativo y la referencia nominal del cliente de prueba. Retiró el acceso a almacenamiento de sesión. Una política de contenido bloquea conexiones externas y limita fuentes e imágenes a datos incrustados. El código de Google Apps Script de producción y su historial no forman parte de este paquete.

Esta publicación estática no despliega el backend ni una aplicación operativa. No se ha definido una licencia de reutilización del código.

## Variante de fabricación UAT

La [variante interactiva](fabricacion/index.html) conserva el flujo anterior y agrega dentro de Partidas la guía Producto y medidas → Despiece → Compra y cortes → Procesos → Costo estimado. Sólo la consola DEMO compacta tiene una receta sintética y un patrón fijo ilustrativo; cambiar piezas o medidas lo invalida. El costo ilustrativo no se guarda ni sustituye el componente manual B‑02. También funciona sin servidor abriendo `fabricacion/index.html` en Chrome.

Esta variante sigue siendo una demostración pública sin conexión ni guardado. No calcula compras reales, no optimiza cortes, no usa catálogos empresariales y no debe recibir datos reales. La versión original en la raíz permanece intacta.
