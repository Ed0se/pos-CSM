import * as productsRepo from '../repositories/products.repository.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import {
  CreateProductInput,
  CreateVariantInput,
  UpdateProductInput,
  UpdateVariantInput
} from '../validators/products.validator.js';

interface MysqlErrorLike {
  code?: string;
  errno?: number;
  sqlMessage?: string;
}

function isDuplicateEntryError(err: unknown): err is MysqlErrorLike {
  if (!err || typeof err !== 'object') return false;
  const e = err as MysqlErrorLike;
  return e.code === 'ER_DUP_ENTRY' || e.errno === 1062;
}

function mapVariantDuplicateError(err: MysqlErrorLike): ConflictError {
  const msg = err.sqlMessage ?? '';
  if (msg.includes('uq_variant_sku')) {
    return new ConflictError('DUPLICATE_SKU', 'Ya existe una variante con ese código SKU');
  }
  if (msg.includes('uq_product_size_color')) {
    return new ConflictError(
      'DUPLICATE_VARIANT',
      'Ya existe esa combinación de talla y color para esta prenda'
    );
  }
  return new ConflictError('DUPLICATE_ENTRY', 'El registro ya existe en el catálogo');
}

export async function listProducts(params: {
  q?: string;
  active?: boolean;
  page: number;
  limit: number;
  offset: number;
}) {
  const { data, total } = await productsRepo.findProducts({
    q: params.q,
    active: params.active,
    limit: params.limit,
    offset: params.offset
  });

  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total
    }
  };
}

export async function getProductById(id: number) {
  const product = await productsRepo.findProductById(id);
  if (!product) {
    throw new NotFoundError('Prenda no encontrada');
  }
  return product;
}

export async function createProduct(input: CreateProductInput) {
  return productsRepo.insertProduct(input);
}

export async function updateProduct(id: number, input: UpdateProductInput) {
  const existing = await productsRepo.findProductById(id);
  if (!existing) {
    throw new NotFoundError('Prenda no encontrada');
  }
  const updated = await productsRepo.updateProduct(id, input);
  if (!updated) {
    throw new NotFoundError('Prenda no encontrada');
  }
  return updated;
}

export async function addVariantToProduct(productId: number, input: CreateVariantInput) {
  const product = await productsRepo.findProductById(productId);
  if (!product) {
    throw new NotFoundError('Prenda no encontrada');
  }

  try {
    return await productsRepo.insertVariant(productId, input);
  } catch (err) {
    if (isDuplicateEntryError(err)) {
      throw mapVariantDuplicateError(err);
    }
    throw err;
  }
}

export async function updateVariant(variantId: number, input: UpdateVariantInput) {
  const existing = await productsRepo.findVariantById(variantId);
  if (!existing) {
    throw new NotFoundError('Variante no encontrada');
  }

  try {
    const updated = await productsRepo.updateVariant(variantId, input);
    if (!updated) {
      throw new NotFoundError('Variante no encontrada');
    }
    return updated;
  } catch (err) {
    if (isDuplicateEntryError(err)) {
      throw mapVariantDuplicateError(err);
    }
    throw err;
  }
}
