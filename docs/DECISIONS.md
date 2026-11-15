# Registro de decisiones

| ID | Decisión | Motivo | Estado |
|---|---|---|---|
| D-01 | Angular 22 y TypeScript | Framework pedido; versión soportada | Fijada |
| D-02 | Express como API intermedia | Evitar credenciales MySQL en cliente, centralizar reglas | Propuesta |
| D-03 | MySQL 8.4 InnoDB local | Persistencia SQL y transacciones | Fijada |
| D-04 | Stock por producto+talla+color | Evita confundir existencias de tallas | Fijada |
| D-05 | Precios en centavos enteros | Precisión de importes | Fijada |
| D-06 | Una caja localhost en MVP | Evita diseñar infraestructura multiusuario prematuramente | Provisional |
| D-07 | Ticket de 80 mm no fiscal | Caso típico POS, se confirmará impresora | Provisional |
| D-08 | Sin información de alumnos | No se necesita para venta de mostrador | Fijada |
| D-09 | Entradas y ventas siempre auditadas | Diagnóstico de diferencias de stock | Fijada |
| D-10 | Autenticación antes de abrir a LAN | Protección de inventario y reportes | Fijada |

**Pendientes para aprobar con la tienda:** número de cajas, impresora, datos reales de uniformes, descuentos/devoluciones, emisión CFDI.
