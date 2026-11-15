# Reglas para frontend Angular

Leer `../AGENTS.md` y `../docs/UX.md`.
- Angular 22 + TypeScript estricto, Router, standalone components, Reactive Forms.
- Rutas `/pos`, `/articulos`, `/inventario`, `/ventas`; raíz redirige a `/pos`.
- Organizar en `features/{pos,products,inventory,sales}`, `core/api`, `shared`.
- Servicios HTTP tipados, manejo centralizado de errores y estados de carga.
- El frontend nunca conoce credenciales MySQL ni modifica stock por sí mismo.
- Importes internos en centavos enteros; usar `Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN'})` para presentar.
- Botón Cobrar deshabilitado mientras procesa y protegido contra doble clic; mostrar resultado solo al confirmar servidor.
- Los tickets se generan consultando venta persistida por ID, no el carrito.
- Preferir interfaz simple y accesible sobre librerías visuales pesadas.
- Crear tests de carrito, servicios HTTP, campos de tallas, pagos y ticket.
