# Experiencia de usuario y navegación

Cuatro pestañas siempre visibles: **Punto de venta | Artículos | Inventario | Ventas**. La app abre en Punto de venta.

## Punto de venta
```
┌────────────────── Colegio San Miguel ──────────────────────────┐
│ [Punto de venta] [Artículos] [Inventario] [Ventas]              │
├─────────────────────────────────┬───────────────────────────────┤
│ Buscar artículo / SKU           │ CARRITO                       │
│ [________________________]      │ Playera 10 Blanco   x2       │
│                                 │ Pantalón 8 Azul     x1       │
│ Playera · talla 10 · 5 en stock │                               │
│                    [Agregar]    │ TOTAL: $...                   │
│ Pantalón · talla 8 · 3 en stock │ [Efectivo ▾] Recibido $...    │
│                    [Agregar]    │ Cambio: $...                  │
│                                 │ [ COBRAR E IMPRIMIR ]         │
└─────────────────────────────────┴───────────────────────────────┘
```
- Buscar por SKU o nombre; mostrar variantes/tallas claramente.
- No permitir agregar más que stock disponible; volver a validar en servidor al cobrar.
- Cantidad editable desde carrito, botón quitar, total visible todo el tiempo.
- Al cobrar, deshabilitar el botón mientras procesa; no vaciar carrito hasta recibir éxito.

## Artículos
Tabla con nombre, categoría, número de tallas y estado. Formulario corto para nueva prenda; dentro del detalle gestionar tallas/colores/SKU/precio sin cambiar pantallas innecesariamente.

## Inventario
Buscar nombre/SKU/talla; columnas artículo, talla, color, SKU, precio, stock, mínimo. Filtros Todos/Bajo mínimo/Agotados. Botón "Registrar entrada/salida/ajuste" con motivo obligatorio. Texto visible junto al color de alerta.

## Ventas
Filtros Hoy/7 días/Mes/Rango. Indicadores: ventas, artículos vendidos, ingresos. Tabla: folio, fecha, medio de pago, total y acción "Detalle/Reimprimir". No recalcular tickets antiguos con precios del catálogo actual.

## Ticket comercial 80 mm
- Encabezado: nombre Colegio San Miguel, dirección/teléfono **configurables**.
- Folio, fecha/hora local, líneas de artículos (talla/color/cantidad/precio/importe).
- Subtotal, descuento si aplica, total MXN, forma de pago, recibido/cambio.
- Leyenda «Comprobante no fiscal». Sin datos de alumnos.
- CSS de impresión `@media print` y `@page` para ancho de 80 mm, con comprobación real de navegador/driver.

## Accesibilidad y sencillez
Texto en español de México, botones visibles, área táctil amplia, foco de teclado visible, etiquetas para inputs, mensajes comprensibles de error, vacío y éxito. No usar modales encadenados ni pantallas innecesarias.
