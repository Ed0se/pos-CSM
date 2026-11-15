# Diseño técnico y modelo de datos

## Diagrama
```
Angular 22 SPA (localhost:4200)
       |
       | HTTP REST JSON (sin acceso directo a DB)
       v
Express + TypeScript (127.0.0.1:3000)
       |
       | mysql2/promise, SQL parametrizado y transacciones
       v
MySQL 8.4 LTS local — InnoDB
```

## Entidades
- `products` — prenda o modelo y categoría.
- `product_variants` — combinación de producto/talla/color con SKU único, precio, stock y stock mínimo.
- `stock_movements` — delta firmado, motivo, stock final, tipo (entrada, salida, ajuste, venta), fecha y referencia de venta cuando corresponda.
- `sales` — folio, idempotency key, fingerprint de petición, método de pago y cantidades monetarias en centavos.
- `sale_items` — líneas vendidas con SKU, nombre, talla, color y precio **congelados**.

Relaciones: products 1:N variants; variants 1:N stock_movements; sales 1:N sale_items; variants 1:N sale_items; sales 1:N stock_movements.

## Transacción de venta
1. Validar entrada, combinar filas repetidas por variante y verificar clave UUID de idempotencia.
2. Comenzar transacción; manejar clave repetida usando índice único y fingerprint para devolver venta previa o conflicto.
3. Consultar y bloquear variantes **en orden ascendente** por ID usando `SELECT ... FOR UPDATE`.
4. Validar estado activo, existencia suficiente y precio desde DB.
5. Calcular todos los montos en **centavos enteros**; validar pago/recibido.
6. Insertar cabecera, generar folio `CSM-00000001` mediante ID sin colisiones, insertar líneas snapshots.
7. Descontar existencias, insertar un movimiento `SALE` por variante y confirmar `COMMIT`.
8. Si ocurre algún error: `ROLLBACK`. Reintentos deben ser idempotentes, sin venta doble.

**Nota:** el cliente no envía precios definitivos ni puede editar `stock` directamente. Para manejar cambios de precio entre mostrar carrito y confirmar se debe mostrar al cajero el importe vigente antes de confirmar o detectar diferencias y solicitar reconfirmación.

## Movimiento manual de inventario
Transacción independiente: validar motivo, bloquear variante, calcular saldo nuevo, impedir saldo negativo, actualizar y registrar movimiento con `stock_after`.

## Reportes y tiempo
- Base MySQL en UTC (configurar zona UTC para conexiones); fechas en UI para `America/Hermosillo`.
- Reportes por intervalo `[desde, hasta)` convertido correctamente desde fecha local a UTC.
- Dinero almacenado como `INT UNSIGNED` en centavos de MXN; jamás tipo flotante para sumas.

## Seguridad
SQL parametrizado, validación de entrada, límites de paginación, `.env` ignorado, cuenta MySQL con permisos mínimos, CORS estricto y backend solo en loopback al inicio. Antes de exponer en LAN, agregar autenticación, roles, sesiones seguras y HTTPS cuando aplique.
