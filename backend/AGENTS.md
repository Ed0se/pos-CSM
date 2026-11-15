# Reglas para backend Express

Leer `../AGENTS.md`, `../docs/API.md`, `../docs/ARCHITECTURE.md`.
- Node + Express + TS estricto, `mysql2/promise`, SQL parametrizado, validación de entrada con Zod o equivalente.
- Capas `routes → controllers → services → repositories`; transacciones en capa service.
- `PoolConnection` único por transacción, `commit/rollback/release` en `try/catch/finally`.
- Venta idempotente con header `Idempotency-Key` (UUID) y hash del payload canónico; la unicidad se protege también en DB.
- Bloquear variantes en orden de ID con `SELECT ... FOR UPDATE`; validar stock y estado en esa transacción.
- Nunca confiar en precio enviado por navegador. Guardar snapshots de las líneas.
- Registrar `stock_movements` junto con cada modificación de existencias; la UI no dispone de PATCH stock directo.
- Fechas UTC (sesión MySQL UTC), dinero en centavos, límites y validaciones en todos los endpoints.
- Errores JSON sin volcar SQL/credenciales; CORS restringido y host localhost inicialmente.
- Tests de integración con MySQL para integridad, concurrencia, idempotencia y rollback; no bastan mocks para demostrar bloqueos.
