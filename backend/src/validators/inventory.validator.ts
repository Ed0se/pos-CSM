import { z } from 'zod';

export const movementKindSchema = z.enum(['ENTRY', 'EXIT', 'ADJUSTMENT'], {
  errorMap: () => ({ message: 'El tipo de movimiento debe ser ENTRY, EXIT o ADJUSTMENT' })
});

export const createMovementSchema = z
  .object({
    variant_id: z
      .number({ required_error: 'La variante es obligatoria', invalid_type_error: 'variant_id debe ser numérico' })
      .int('variant_id debe ser entero')
      .positive('variant_id debe ser mayor a 0'),
    kind: movementKindSchema,
    quantity_delta: z
      .number({ required_error: 'La cantidad es obligatoria', invalid_type_error: 'quantity_delta debe ser numérico' })
      .int('La cantidad del movimiento debe ser un número entero')
      .refine((v) => v !== 0, 'La cantidad del movimiento no puede ser 0'),
    reason: z
      .string({ required_error: 'El motivo es obligatorio' })
      .trim()
      .min(3, 'El motivo debe tener al menos 3 caracteres')
      .max(255, 'El motivo no puede exceder 255 caracteres')
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'ENTRY' && data.quantity_delta <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantity_delta'],
        message: 'Una entrada (ENTRY) requiere una cantidad positiva mayor a 0'
      });
    }
    if (data.kind === 'EXIT' && data.quantity_delta >= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantity_delta'],
        message: 'Una salida (EXIT) requiere una cantidad negativa menor a 0'
      });
    }
  });

export type CreateMovementInput = z.infer<typeof createMovementSchema>;
