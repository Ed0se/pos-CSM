# Pruebas requeridas

## Integración y negocio (prioridad máxima)
1. Crear una prenda y dos variantes con distinto SKU/talla; consulta stock independiente.
2. SKU repetido es rechazado (incluidos equivalentes por mayúsculas/collation).
3. Entrada de 10 unidades incrementa stock 10 y genera movimiento válido.
4. Salida de 3 deja 7; intentar sacar 8 falla sin cambios.
5. Venta de A x2 y B x1 crea 1 venta, 2 líneas, 2 movimientos y descuenta ambas existencias.
6. Cuando B no tiene stock, falla **toda** la venta y A no se descuenta.
7. Dos ventas simultáneas por la última unidad: una gana y la otra falla.
8. Reintento con misma idempotency key y mismo request: devuelve venta original, sin descuento adicional.
9. Reintento con misma clave y request diferente: `409`.
10. Cambio de precio tras venta no modifica ticket histórico.
11. Pago en efectivo menor al total falla; recibido mayor calcula bien el cambio.
12. Reporte usa intervalo correcto y coincide con sumatoria de ventas guardadas.
13. Rechazar cantidades cero/negativas/decimales, precio inválido y stock negativo.
14. Ventas y stock permanecen correctos tras reiniciar API.

## Manual UX e impresión
- [ ] Cajero puede completar venta usando solo teclado.
- [ ] Buscar por nombre y SKU; seleccionar talla es inequívoco.
- [ ] Bajo inventario y agotado se distinguen con texto, no solo colores.
- [ ] Si falla el servidor, mostrar error sin borrar carrito.
- [ ] Imprimir en impresora 80 mm sin menús, bordes ni cortes problemáticos.
- [ ] Reimprimir venta histórica sin cambiar montos.

## Operación
- [ ] Backend solo localhost mientras no haya autenticación.
- [ ] `.env` y contraseñas no aparecen en Git.
- [ ] Cuenta de DB no usa root.
- [ ] Ejecutar backup y probar restauración en base de prueba separada.
- [ ] Confirmar que ticket no se presenta como CFDI.
