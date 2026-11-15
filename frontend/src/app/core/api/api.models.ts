export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';
export type MovementKind = 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'SALE';
export type ManualMovementKind = 'ENTRY' | 'EXIT' | 'ADJUSTMENT';
export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OK';

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  timestamp: string;
  services: {
    api: string;
    database: string;
  };
  database_error?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ProductVariant {
  id: number;
  product_id: number;
  size_label: string;
  color: string;
  sku: string;
  unit_price_cents: number;
  stock: number;
  minimum_stock: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  variants: ProductVariant[];
}

export interface CreateProductPayload {
  name: string;
  category: string;
  description?: string | null;
  active?: boolean;
}

export interface UpdateProductPayload {
  name?: string;
  category?: string;
  description?: string | null;
  active?: boolean;
}

export interface CreateVariantPayload {
  size_label: string;
  color?: string;
  sku: string;
  unit_price_cents: number;
  minimum_stock?: number;
  active?: boolean;
}

export interface UpdateVariantPayload {
  size_label?: string;
  color?: string;
  sku?: string;
  unit_price_cents?: number;
  minimum_stock?: number;
  active?: boolean;
}

export interface InventoryItem {
  variant_id: number;
  product_id: number;
  product_name: string;
  category: string;
  product_active: boolean;
  size_label: string;
  color: string;
  sku: string;
  unit_price_cents: number;
  stock: number;
  minimum_stock: number;
  variant_active: boolean;
  stock_status: StockStatus;
}

export interface StockMovement {
  id: number;
  variant_id: number;
  sale_id: number | null;
  sale_folio: string | null;
  product_name: string;
  size_label: string;
  color: string;
  sku: string;
  kind: MovementKind;
  quantity_delta: number;
  stock_after: number;
  reason: string;
  created_at: string;
  stock_before?: number;
}

export interface CreateMovementPayload {
  variant_id: number;
  kind: ManualMovementKind;
  quantity_delta: number;
  reason: string;
}

export interface SaleItemSnapshot {
  variant_id: number;
  sku: string;
  name: string;
  size_label: string;
  color: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

export interface SchoolTicketInfo {
  name: string;
  address: string;
  phone: string;
  footer: string;
}

export interface SaleDetail {
  id: number;
  folio: string;
  created_at: string;
  items: SaleItemSnapshot[];
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  payment_method: PaymentMethod;
  amount_received_cents: number;
  change_cents: number;
  school: SchoolTicketInfo;
}

export interface SaleSummary {
  id: number;
  folio: string;
  created_at: string;
  items_count: number;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  payment_method: PaymentMethod;
  amount_received_cents: number;
  change_cents: number;
}

export interface CreateSalePayload {
  items: Array<{ variant_id: number; quantity: number }>;
  payment_method: PaymentMethod;
  amount_received_cents?: number;
  expected_total_cents?: number;
}

export interface SalesReport {
  from: string;
  to: string;
  sales_count: number;
  units_sold: number;
  revenue_cents: number;
  by_payment_method: Array<{
    method: PaymentMethod;
    sales_count: number;
    revenue_cents: number;
  }>;
  top_items: Array<{
    sku: string;
    name: string;
    size_label: string;
    color: string;
    units: number;
    revenue_cents: number;
  }>;
}
