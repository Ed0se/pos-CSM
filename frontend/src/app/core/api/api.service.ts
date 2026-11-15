import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import {
  ApiErrorBody,
  CreateMovementPayload,
  CreateProductPayload,
  CreateSalePayload,
  CreateVariantPayload,
  HealthResponse,
  InventoryItem,
  MovementKind,
  PaginatedResponse,
  PaymentMethod,
  Product,
  ProductVariant,
  SaleDetail,
  SalesReport,
  SaleSummary,
  StockMovement,
  UpdateProductPayload,
  UpdateVariantPayload
} from './api.models';

export * from './api.models';

export function parseApiError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'No hay conexión con el servidor API (127.0.0.1:3000). Verifica que el backend esté activo.';
    }
    const body = err.error as ApiErrorBody | null;
    if (body && typeof body === 'object' && body.error?.message) {
      const details = body.error.details;
      if (details && typeof details === 'object') {
        const firstField = Object.values(details)[0];
        if (Array.isArray(firstField) && firstField.length > 0 && typeof firstField[0] === 'string') {
          return `${body.error.message}: ${firstField[0]}`;
        }
      }
      return body.error.message;
    }
    return `Error del servidor (${err.status})`;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Ocurrió un error inesperado al comunicarse con el servidor.';
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://127.0.0.1:3000/api/v1';

  getHealth(): Observable<HealthResponse | null> {
    return this.http.get<HealthResponse>(`${this.baseUrl}/health`).pipe(
      catchError((error) => {
        console.error('Error al conectar con la API:', error);
        return of({
          status: 'degraded' as const,
          timestamp: new Date().toISOString(),
          services: {
            api: 'down',
            database: 'unknown'
          },
          database_error: error?.message || 'No se pudo conectar con el servidor backend'
        });
      })
    );
  }

  // --- Artículos y Variantes ---

  getProducts(params?: {
    q?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  }): Observable<PaginatedResponse<Product>> {
    let httpParams = new HttpParams();
    if (params?.q?.trim()) httpParams = httpParams.set('q', params.q.trim());
    if (params?.active !== undefined) httpParams = httpParams.set('active', String(params.active));
    if (params?.page !== undefined) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));

    return this.http.get<PaginatedResponse<Product>>(`${this.baseUrl}/products`, { params: httpParams });
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/products/${id}`);
  }

  createProduct(payload: CreateProductPayload): Observable<Product> {
    return this.http.post<Product>(`${this.baseUrl}/products`, payload);
  }

  updateProduct(id: number, payload: UpdateProductPayload): Observable<Product> {
    return this.http.patch<Product>(`${this.baseUrl}/products/${id}`, payload);
  }

  createVariant(productId: number, payload: CreateVariantPayload): Observable<ProductVariant> {
    return this.http.post<ProductVariant>(`${this.baseUrl}/products/${productId}/variants`, payload);
  }

  updateVariant(variantId: number, payload: UpdateVariantPayload): Observable<ProductVariant> {
    return this.http.patch<ProductVariant>(`${this.baseUrl}/variants/${variantId}`, payload);
  }

  // --- Inventario y Movimientos ---

  getInventory(params?: {
    q?: string;
    lowStock?: boolean;
    stockStatus?: 'OUT' | 'LOW' | 'OK';
    active?: boolean;
    page?: number;
    limit?: number;
  }): Observable<PaginatedResponse<InventoryItem>> {
    let httpParams = new HttpParams();
    if (params?.q?.trim()) httpParams = httpParams.set('q', params.q.trim());
    if (params?.lowStock !== undefined) httpParams = httpParams.set('lowStock', String(params.lowStock));
    if (params?.stockStatus) httpParams = httpParams.set('stockStatus', params.stockStatus);
    if (params?.active !== undefined) httpParams = httpParams.set('active', String(params.active));
    if (params?.page !== undefined) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));

    return this.http.get<PaginatedResponse<InventoryItem>>(`${this.baseUrl}/inventory`, {
      params: httpParams
    });
  }

  createMovement(payload: CreateMovementPayload): Observable<StockMovement> {
    return this.http.post<StockMovement>(`${this.baseUrl}/inventory/movements`, payload);
  }

  getMovements(params?: {
    variantId?: number;
    kind?: MovementKind;
    page?: number;
    limit?: number;
  }): Observable<PaginatedResponse<StockMovement>> {
    let httpParams = new HttpParams();
    if (params?.variantId !== undefined) httpParams = httpParams.set('variantId', String(params.variantId));
    if (params?.kind) httpParams = httpParams.set('kind', params.kind);
    if (params?.page !== undefined) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));

    return this.http.get<PaginatedResponse<StockMovement>>(`${this.baseUrl}/inventory/movements`, {
      params: httpParams
    });
  }

  // --- Ventas y Reportes ---

  createSale(payload: CreateSalePayload, idempotencyKey: string): Observable<SaleDetail> {
    const headers = new HttpHeaders({
      'Idempotency-Key': idempotencyKey
    });
    return this.http.post<SaleDetail>(`${this.baseUrl}/sales`, payload, { headers });
  }

  getSales(params?: {
    from?: string;
    to?: string;
    folio?: string;
    paymentMethod?: PaymentMethod;
    page?: number;
    limit?: number;
  }): Observable<PaginatedResponse<SaleSummary>> {
    let httpParams = new HttpParams();
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);
    if (params?.folio?.trim()) httpParams = httpParams.set('folio', params.folio.trim());
    if (params?.paymentMethod) httpParams = httpParams.set('paymentMethod', params.paymentMethod);
    if (params?.page !== undefined) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));

    return this.http.get<PaginatedResponse<SaleSummary>>(`${this.baseUrl}/sales`, {
      params: httpParams
    });
  }

  getSaleById(id: number): Observable<SaleDetail> {
    return this.http.get<SaleDetail>(`${this.baseUrl}/sales/${id}`);
  }

  getSalesReport(params?: { from?: string; to?: string }): Observable<SalesReport> {
    let httpParams = new HttpParams();
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);

    return this.http.get<SalesReport>(`${this.baseUrl}/reports/sales`, { params: httpParams });
  }

  downloadSalesReportPdf(params?: {
    from?: string;
    to?: string;
    folio?: string;
  }): Observable<Blob> {
    let httpParams = new HttpParams();
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);
    if (params?.folio?.trim()) httpParams = httpParams.set('folio', params.folio.trim());

    return this.http.get(`${this.baseUrl}/reports/sales/pdf`, {
      params: httpParams,
      responseType: 'blob'
    });
  }
}
