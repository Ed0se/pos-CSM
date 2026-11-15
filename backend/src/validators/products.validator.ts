import { z } from 'zod';

export const idParamSchema = z.coerce
  .number({ invalid_type_error: 'El identificador debe ser numérico' })
  .int('El identificador debe ser un entero')
  .positive('El identificador debe ser mayor a 0');

export const createProductSchema = z.object({
  name: z
    .string({ required_error: 'El nombre de la prenda es obligatorio' })
    .trim()
    .min(1, 'El nombre de la prenda es obligatorio')
    .max(120, 'El nombre no puede exceder 120 caracteres'),
  category: z
    .string({ required_error: 'La categoría es obligatoria' })
    .trim()
    .min(1, 'La categoría es obligatoria')
    .max(60, 'La categoría no puede exceder 60 caracteres'),
  description: z
    .string()
    .trim()
    .max(1000, 'La descripción no puede exceder 1000 caracteres')
    .nullish()
    .transform((val) => (val && val.length > 0 ? val : null)),
  active: z.boolean().optional().default(true)
});

export const updateProductSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'El nombre no puede quedar vacío')
      .max(120, 'El nombre no puede exceder 120 caracteres')
      .optional(),
    category: z
      .string()
      .trim()
      .min(1, 'La categoría no puede quedar vacía')
      .max(60, 'La categoría no puede exceder 60 caracteres')
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, 'La descripción no puede exceder 1000 caracteres')
      .nullish()
      .transform((val) => (val === undefined ? undefined : val && val.length > 0 ? val : null)),
    active: z.boolean().optional()
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.category !== undefined ||
      data.description !== undefined ||
      data.active !== undefined,
    {
      message: 'Debe proporcionar al menos un campo para actualizar'
    }
  );

export const createVariantSchema = z
  .object({
    size_label: z
      .string({ required_error: 'La talla es obligatoria' })
      .trim()
      .min(1, 'La talla es obligatoria')
      .max(30, 'La talla no puede exceder 30 caracteres'),
    color: z
      .string()
      .trim()
      .max(60, 'El color no puede exceder 60 caracteres')
      .optional()
      .transform((val) => (val && val.length > 0 ? val : 'Estándar')),
    sku: z
      .string({ required_error: 'El SKU es obligatorio' })
      .trim()
      .min(1, 'El SKU es obligatorio')
      .max(64, 'El SKU no puede exceder 64 caracteres')
      .transform((val) => val.toUpperCase()),
    unit_price_cents: z
      .number({ required_error: 'El precio es obligatorio', invalid_type_error: 'El precio debe ser numérico' })
      .int('El precio debe expresarse en centavos enteros')
      .positive('El precio debe ser mayor a 0'),
    minimum_stock: z
      .number({ invalid_type_error: 'El stock mínimo debe ser numérico' })
      .int('El stock mínimo debe ser entero')
      .min(0, 'El stock mínimo no puede ser negativo')
      .optional()
      .default(0),
    active: z.boolean().optional().default(true),
    stock: z.unknown().optional()
  })
  .superRefine((data, ctx) => {
    if (data.stock !== undefined && data.stock !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stock'],
        message: 'No se permite fijar existencias al crear variante; el stock inicial es 0 y se carga mediante una entrada de inventario'
      });
    }
  });

export const updateVariantSchema = z
  .object({
    size_label: z
      .string()
      .trim()
      .min(1, 'La talla no puede quedar vacía')
      .max(30, 'La talla no puede exceder 30 caracteres')
      .optional(),
    color: z
      .string()
      .trim()
      .max(60, 'El color no puede exceder 60 caracteres')
      .optional()
      .transform((val) => (val === undefined ? undefined : val.length > 0 ? val : 'Estándar')),
    sku: z
      .string()
      .trim()
      .min(1, 'El SKU no puede quedar vacío')
      .max(64, 'El SKU no puede exceder 64 caracteres')
      .transform((val) => val.toUpperCase())
      .optional(),
    unit_price_cents: z
      .number({ invalid_type_error: 'El precio debe ser numérico' })
      .int('El precio debe expresarse en centavos enteros')
      .positive('El precio debe ser mayor a 0')
      .optional(),
    minimum_stock: z
      .number({ invalid_type_error: 'El stock mínimo debe ser numérico' })
      .int('El stock mínimo debe ser entero')
      .min(0, 'El stock mínimo no puede ser negativo')
      .optional(),
    active: z.boolean().optional(),
    stock: z.unknown().optional()
  })
  .superRefine((data, ctx) => {
    if (data.stock !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stock'],
        message: 'El stock no puede editarse directamente desde variantes; utiliza un movimiento de inventario'
      });
    }
    if (
      data.size_label === undefined &&
      data.color === undefined &&
      data.sku === undefined &&
      data.unit_price_cents === undefined &&
      data.minimum_stock === undefined &&
      data.active === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body'],
        message: 'Debe proporcionar al menos un campo para actualizar'
      });
    }
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateVariantInput = Omit<z.infer<typeof createVariantSchema>, 'stock'>;
export type UpdateVariantInput = Omit<z.infer<typeof updateVariantSchema>, 'stock'>;
