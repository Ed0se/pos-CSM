# Contrato API REST v1 (propuesto)

**Base:** `http://127.0.0.1:3000/api/v1` · JSON · MXN en centavos enteros.  
Errores: `{ "error": { "code": "STOCK_INSUFFICIENT", "message": "Existencias insuficientes", "details": {} } }`.  
Paginación: `page=1&limit=20`, máximo 100; `{ "data": [], "pagination": { "page": 1, "limit": 20, "total": 0 } }`.

| Método | Ruta | Uso |
|---|---|---|
| GET | `/health` | Estado API y MySQL |
| GET | `/products?q=&page=&limit=` | Buscar prendas |
| POST | `/products` | Alta de prenda |
| GET | `/products/:id` | Prenda y variantes |
| PATCH | `/products/:id` | Editar/inactivar |
| POST | `/products/:id/variants` | Añadir talla/color y SKU |
| PATCH | `/variants/:id` | Editar datos/precio/mínimo, NUNCA stock |
| GET | `/inventory?q=&lowStock=&page=&limit=` | Stock por variante |
| POST | `/inventory/movements` | Entrada/salida/ajuste manual |
| GET | `/inventory/movements?variantId=&page=&limit=` | Auditoría |
| POST | `/sales` | Venta atómica |
| GET | `/sales?from=&to=&folio=&page=&limit=` | Historial |
| GET | `/sales/:id` | Detalle completo para ticket |
| GET | `/reports/sales?from=&to=` | Resumen y productos más vendidos |
| GET | `/reports/sales/pdf?from=&to=&folio=` | Descargar reporte de ventas en PDF |

## Crear producto
`POST /products`
```json
{
  "name": "Playera polo escolar",
  "category": "Uniforme diario",
  "description": "Ejemplo de prenda"
}
```

## Crear variante
`POST /products/1/variants`
```json
{
  "size_label": "10",
  "color": "Blanco",
  "sku": "CSM-POLO-BLA-10",
  "unit_price_cents": 28000,
  "minimum_stock": 3
}
```
Empieza con stock 0. Agregar existencias mediante movimiento, NO con PATCH variante.

## Entrada de inventario
`POST /inventory/movements`
```json
{
  "variant_id": 1,
  "kind": "ENTRY",
  "quantity_delta": 10,
  "reason": "Inventario inicial"
}
```
Tipos: ENTRY (positivo), EXIT (negativo), ADJUSTMENT (positivo o negativo, distinto de 0). SALE solo interno en servicio de ventas.

## Venta
`POST /sales`, header obligatorio `Idempotency-Key: 6f28f57d-04c7-4d2c-9c52-d654f98c662b` (UUID único por venta).
```json
{
  "items": [
    { "variant_id": 1, "quantity": 2 },
    { "variant_id": 2, "quantity": 1 }
  ],
  "payment_method": "CASH",
  "amount_received_cents": 100000
}
```
Respuesta `201` (ejemplo si ambos artículos cuestan $280 y $250):
```json
{
  "id": 17,
  "folio": "CSM-00000017",
  "created_at": "2026-11-09T18:30:00.000Z",
  "items": [
    { "sku": "CSM-POLO-BLA-10", "name": "Playera polo escolar", "size_label": "10", "color": "Blanco", "quantity": 2, "unit_price_cents": 28000, "line_total_cents": 56000 },
    { "sku": "CSM-POLO-BLA-8", "name": "Playera polo escolar", "size_label": "8", "color": "Blanco", "quantity": 1, "unit_price_cents": 25000, "line_total_cents": 25000 }
  ],
  "subtotal_cents": 81000,
  "discount_cents": 0,
  "total_cents": 81000,
  "payment_method": "CASH",
  "amount_received_cents": 100000,
  "change_cents": 19000
}
```
- La API calcula precios y total **desde la base**, no desde el request.
- Para CARD/TRANSFER el recibido debe igualar al total (sin capturar información bancaria).
- Si la clave de idempotencia se repite con mismo request: retornar la venta existente; con request diferente: `409`.
- Si una sola variante no tiene suficiente stock, devolver error y **no guardar nada**.
- En UI, confirmar importe actualizado antes de hacer POST si el precio pudo cambiar desde que se agregó al carrito.

## Reporte por fechas
`GET /reports/sales?from=2026-11-09&to=2026-11-10`  
Rango semiabierto de fechas locales: desde inclusive, hasta exclusivo (`America/Hermosillo`).
```json
{
  "sales_count": 12,
  "units_sold": 26,
  "revenue_cents": 825000,
  "by_payment_method": [{ "method": "CASH", "revenue_cents": 550000 }],
  "top_items": [{ "sku": "CSM-POLO-BLA-10", "units": 9 }]
}
```

### Exportación en PDF
`GET /reports/sales/pdf?from=2026-11-09&to=2026-11-10&folio=`  
Parámetros de consulta opcionales:
- `from` (`YYYY-MM-DD`, hora local `America/Hermosillo`; por defecto hoy).
- `to` (`YYYY-MM-DD`, exclusivo en `America/Hermosillo`; por defecto `from + 1 día`).
- `folio` (filtro opcional aplicado al listado detallado incluido en el documento).

Responde con `200 OK`, `Content-Type: application/pdf` y `Content-Disposition: attachment; filename="reporte-ventas-csm-<from>_a_<to>.pdf"` conteniendo el encabezado institucional, indicadores KPI, desglose por medio de pago, top 10 prendas vendidas y tabla detallada paginada de ventas.

## Errores
`400 VALIDATION_ERROR`, `404 NOT_FOUND`, `409 DUPLICATE_SKU | STOCK_INSUFFICIENT | IDEMPOTENCY_CONFLICT`, `422 PAYMENT_INSUFFICIENT`, `500 INTERNAL_ERROR`. No revelar stacktraces ni SQL al navegador.

## Seguridad/estado del contrato
Este es un contrato inicial para desarrollo, no endpoints ya ejecutables. La impresión es HTML/CSS Angular consultando `GET /sales/:id` de una venta guardada. Las rutas protegidas por roles se introducirán antes del acceso por LAN.
