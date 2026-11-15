# AGENTS.md — Punto de Venta Colegio San Miguel

## Objetivo
Construir un punto de venta **sencillo, seguro y confiable** para uniformes escolares. Fuente de verdad: `docs/` y `database/`. Seguir el plan por fases; no agregar funciones ajenas al MVP.

## Stack obligatorio
- Angular 22 + TypeScript estricto, componentes standalone, Angular Router, Reactive Forms.
- Backend Node.js + Express + TypeScript estricto, API REST JSON.
- MySQL 8.4 LTS local, motor InnoDB, consultas parametrizadas mediante `mysql2/promise`.
- Node compatible con Angular 22, consultar https://angular.dev/reference/versions.
- Moneda MXN en **centavos enteros**, sin coma flotante para importes. Fechas UTC en base de datos; mostrar America/Hermosillo.
- El frontend **jamás** se conecta directamente a MySQL.

## Organización
```
frontend/        UI: features/pos, features/products, features/inventory, features/sales, core/api, shared
backend/         API: routes, controllers, services, repositories, validators, tests
database/        SQL versionado
docs/            plan, requisitos, arquitectura, contrato API, experiencia, pruebas
scripts/         operaciones y respaldo
```

## Reglas de negocio obligatorias
1. Producto = modelo de prenda. Variante = producto + talla + color. **El inventario pertenece a la variante**, no al producto genérico.
2. Cada variante tendrá SKU único, precio, existencia y mínimo; no permitir duplicados, precios negativos ni stock negativo.
3. El inventario se modifica solo desde servicios backend y se registra un movimiento de auditoría con delta, motivo y fecha.
4. Una venta debe validarse y persistirse en **una única transacción InnoDB**: bloquear variantes ordenadas por ID (`SELECT ... FOR UPDATE`), verificar existencias, calcular precio en servidor, insertar venta y líneas, descontar stock y guardar movimientos. Si falla, `ROLLBACK`.
5. Usar clave de idempotencia en el alta de ventas para no cobrar dos veces por doble clic o reintento.
6. Copiar nombre, SKU, talla, color, cantidad y precio a las líneas vendidas: editar productos no modifica tickets históricos.
7. No eliminar físicamente prendas con ventas; usar bandera `active`.
8. El ticket **solo** se genera desde la venta confirmada. Ticket comercial no es CFDI.
9. No recopilar nombres, matrículas ni información de alumnos para vender prendas.
10. Antes de abrir la API a la red local o uso real multiusuario, implementar autenticación, permisos y configuración segura.

## Interfaz mínima
Cuatro pestañas: **Punto de venta**, **Artículos**, **Inventario**, **Ventas**. Pantallas legibles y navegación por teclado; búsqueda por nombre/SKU, selección fácil de talla, carrito visible, cobro con mínimo de pasos y ticket de 80 mm.

## Prácticas de implementación
- Leer `README.md`, `docs/PLAN.md`, `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/UX.md`, `docs/TESTING.md` antes de codificar.
- Cumplir una fase cada vez; escribir pruebas para transacciones, compras simultáneas y reintentos.
- Validar entrada en backend; SQL siempre parametrizado; mensajes al usuario en español.
- Claves y secretos solo en `.env`, nunca subirlo al repositorio.
- Mantener API ligada a `127.0.0.1` inicialmente y CORS limitado al frontend local.
- Ejecutar lint, build y pruebas. Si no se pudieron ejecutar, informar sin afirmar que están aprobadas.
- Actualizar documentación cuando cambie una regla o endpoint.

## Criterio de MVP terminado
Un encargado puede crear una playera con tres tallas, cargar existencias de cada talla, vender dos prendas de tallas diferentes, registrar pago y ticket, revisar historial y comprobar que cada variante descontó exactamente lo vendido, incluso tras reiniciar el sistema.
