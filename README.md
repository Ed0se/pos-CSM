# Colegio San Miguel — Punto de Venta e Inventario

**Estado:** MVP funcional implementado (Fases 0 a 3 completas + suite de pruebas unitarias y de integración MySQL). Listo para uso en caja local; antes de exponer en red LAN multiusuario requiere activar autenticación/roles (Fase 4).

## Propósito
Punto de venta local para uniformes escolares: artículos, tallas, stock por variante, cobros, tickets comerciales e historial/reportes de ventas.

## Arquitectura
`Angular 22 + TypeScript → API REST Express + TypeScript → MySQL 8.4 local`.

## Archivos incluidos
- `AGENTS.md`: reglas técnicas y de negocio para agentes IA.
- `frontend/`: aplicación Angular 22 standalone (`pos`, `articulos`, `inventario`, `ventas` y ticket 80 mm).
- `backend/`: API REST Express + TypeScript con transacciones InnoDB, `SELECT ... FOR UPDATE`, idempotencia y reportes.
- `docs/`: plan, requisitos, arquitectura, contrato API, experiencia de usuario y pruebas.
- `database/001_schema.sql`: tablas MySQL.
- `database/002_demo_data.sql`: ejemplos de productos **ficticios** opcionales.
- `.env.example`: configuración sin secretos reales.
- `scripts/backup.ps1`: ejemplo de respaldo MySQL en Windows.

## Cómo ejecutar el proyecto
1. Asegúrate de tener MySQL local ejecutándose en `127.0.0.1:3306` y cargada la base con `database/001_schema.sql` (y opcionalmente `database/002_demo_data.sql` para pruebas).
2. Configura `.env` en la raíz del proyecto a partir de `.env.example` con tus credenciales locales.
3. Inicia el backend en una terminal:
   ```powershell
   npm --prefix backend run dev
   ```
   Disponible en `http://127.0.0.1:3000` (salud en `/api/v1/health`).
4. Inicia el frontend en otra terminal:
   ```powershell
   npm --prefix frontend start
   ```
   Disponible en `http://localhost:4200`.

## Verificación y pruebas
- **Backend (unitarias + integración MySQL):** `npm --prefix backend test`
- **Compilación backend:** `npm --prefix backend run build`
- **Frontend (unitarias):** `npm --prefix frontend test -- --watch=false`
- **Compilación frontend:** `npm --prefix frontend run build`

## Fuera de alcance de la primera versión
Facturación fiscal SAT/CFDI, comercio online, devoluciones complejas, pasarela de tarjeta, app móvil nativa, sincronización cloud, sucursales, escáner de código de barras.
