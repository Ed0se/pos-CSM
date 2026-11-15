import { z } from 'zod';

export const idempotencyKeySchema = z
  .string({ required_error: 'El encabezado Idempotency-Key es obligatorio' })
  .trim()
  .uuid('El encabezado Idempotency-Key debe ser un UUID válido');

export const paymentMethodSchema = z.enum(['CASH', 'CARD', 'TRANSFER'], {
  errorMap: () => ({ message: 'El método de pago debe ser CASH, CARD o TRANSFER' })
});

export const saleItemInputSchema = z.object({
  variant_id: z
    .number({ required_error: 'variant_id es obligatorio', invalid_type_error: 'variant_id debe ser numérico' })
    .int('variant_id debe ser un entero')
    .positive('variant_id debe ser mayor a 0'),
  quantity: z
    .number({ required_error: 'La cantidad es obligatoria', invalid_type_error: 'La cantidad debe ser numérica' })
    .int('La cantidad debe ser un número entero')
    .positive('La cantidad debe ser mayor a 0')
});

export const createSaleSchema = z.object({
  items: z
    .array(saleItemInputSchema, { required_error: 'Debe incluir al menos un artículo en la venta' })
    .min(1, 'La venta debe contener al menos un artículo'),
  payment_method: paymentMethodSchema,
  amount_received_cents: z
    .number({ invalid_type_error: 'El importe recibido debe ser numérico' })
    .int('El importe recibido debe expresarse en centavos enteros')
    .min(0, 'El importe recibido no puede ser negativo')
    .optional(),
  expected_total_cents: z
    .number({ invalid_type_error: 'El total esperado debe ser numérico' })
    .int('El total esperado debe expresarse en centavos enteros')
    .positive('El total esperado debe ser mayor a 0')
    .optional()
});

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'El formato de fecha debe ser YYYY-MM-DD');

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
