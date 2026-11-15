# Plan de desarrollo por etapas

## Fase 0 — Base técnica
- [x] Generar frontend Angular 22 + Router + navegación y estilos responsivos.
- [x] Generar backend Express TypeScript con MySQL Pool, validación, control de errores y endpoint `/api/v1/health`.
- [x] Crear base local desde `database/001_schema.sql`; configurar entorno, CORS localhost y pruebas.
**Entregable:** frontend y backend arrancan; API confirma conexión.

## Fase 1 — Artículos, tallas e inventario
- [x] Alta/edición de prendas: nombre, categoría, descripción y estado.
- [x] Alta/edición de variantes: talla, color, SKU, precio en centavos, mínimo y activo.
- [x] Consulta de stock por variante, búsquedas y alertas bajo mínimo.
- [x] Entradas, salidas y ajustes auditados, en transacciones.
**Entregable:** crear uniformes en distintas tallas y cargar existencias.

## Fase 2 — Ventas y ticket
- [x] Buscador de prendas, variantes, carrito, cálculo visual de totales.
- [x] Pagos efectivo/tarjeta/transferencia (sin pasarela bancaria).
- [x] Servicio transaccional de venta: bloqueo de stock, idempotencia y folio.
- [x] Ticket comercial de 80 mm y botón de impresión.
**Entregable:** vender varias tallas en una sola compra y descontar existencias correctamente.

## Fase 3 — Historial y reportes
- [x] Ventas filtradas por día/intervalo/folio, detalle y reimpresión.
- [x] Número de ventas, ingresos, prendas vendidas, ranking y medios de pago.
- [x] Exportación CSV y generación de reporte PDF.
**Entregable:** consultar ventas pasadas y revisar ingresos diarios.

## Fase 4 — Operación segura
- [x] Pruebas unitarias/integración y revisión de accesibilidad/errores.
- [ ] Autenticación y roles cajero/admin antes de conectar varios equipos.
- [ ] Respaldos automáticos periódicos y restauración probada.
- [ ] Piloto con catálogo real e impresora física, manual breve.
**Entregable:** producto listo para piloto controlado de una tienda.

## Prioridades posteriores (no MVP)
Devoluciones y cancelaciones auditadas, escáner USB/códigos de barras, cierre de caja, productos por temporada, pedidos/proveedores, facturación CFDI si se requiere, y acceso LAN multicaja.

## Decisiones provisionales para avanzar
- Una sola caja en la computadora local; API no expuesta a la red.
- Ticket no fiscal en papel térmico 80 mm.
- Formas de pago registradas manualmente, sin procesar tarjeta.
- No se solicitan datos de alumnos.
- Sin manejo de devoluciones en el MVP.

## Preguntas importantes para el piloto
1. ¿Una sola caja o varias computadoras?
2. ¿Qué impresora (marca/modelo y ancho 58/80 mm) utilizará la tienda?
3. ¿Cuáles son categorías, tallas, colores y precios reales?
4. ¿Se necesita devolución/descuento desde la primera entrega?
5. ¿Se requieren facturas fiscales (CFDI), aparte del ticket?
