# Requisitos y criterios de aceptación

## Usuarios
**Cajero:** busca, vende, cobra, imprime y consulta ventas. **Administrador:** gestiona catálogo, stock, reportes y configuración (roles en fase 4).

| ID | Prioridad | Función | Criterio de aceptación |
|---|---|---|---|
| R-01 | P0 | Alta de artículos | Crear prenda con nombre, categoría y estado |
| R-02 | P0 | Alta de tallas | Una prenda tiene múltiples tallas y colores; cada combinación un SKU único |
| R-03 | P0 | Inventario | Muestra cantidades de cada combinación talla/color, no solo total por prenda |
| R-04 | P0 | Entradas | Registrar entrada de 5 suma 5 y genera movimiento auditable |
| R-05 | P0 | Punto de venta | Seleccionar varias prendas, tallas y cantidades, agregar al carrito y cobrar |
| R-06 | P0 | Control de stock | Venta descuenta cada variante correcta o falla completa |
| R-07 | P0 | Ticket | Folio, hora, artículos, tallas, precios, total, pago/cambio e impresión 80 mm |
| R-08 | P0 | Historial | Ver ventas anteriores, fecha, total, medio de pago y detalles |
| R-09 | P0 | Sobreventa | Stock insuficiente impide cobrar y deja stock intacto |
| R-10 | P1 | Reportes | Filtro fechas y resumen de ingresos, número de ventas y unidades |
| R-11 | P1 | Stock mínimo | Señalar existencias agotadas o por debajo de mínimo |
| R-12 | P1 | Reimpresión | Imprimir ticket antiguo con precios originales |
| R-13 | P1 | Respaldo | Generar backup y confirmar restauración segura |
| R-14 | P1 | Acceso por roles | Cajero/admin autenticados antes de uso por red |

## Reglas de operación
- Tallas libres en catálogo: por ejemplo 4, 6, 8, 10, 12, CH, M, G.
- Variante = `producto + talla + color`; color `Estándar` si no aplica.
- SKU único, nombre/talla/SKU obligatorios; precio mayor a 0, existencia y cantidades enteras.
- Alta de variante = stock inicial 0; inventario se carga mediante **entrada registrada**.
- Producto y variante pueden inactivarse; no borrar si aparecen en ventas.
- Efectivo: importe recibido >= total y calcular cambio; tarjeta/transferencia: registrar pago exacto sin datos bancarios.
- Precio definitivo se calcula desde servidor; snapshot histórico de líneas.
- Ticket comercial no equivale a CFDI ni acredita facturación fiscal SAT.
- La app se ejecuta en red local o máquina local sin dependencia de Internet, **pero requiere backend y MySQL activos**.
- Confirmaciones, errores y estados vacíos en español de México; navegación por teclado.
