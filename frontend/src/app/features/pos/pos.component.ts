import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  parseApiError,
  PaymentMethod,
  Product,
  ProductVariant,
  SaleDetail
} from '../../core/api/api.service';
import { CurrencyMxnPipe } from '../../shared/pipes/currency-mxn.pipe';
import { TicketReceiptComponent } from '../../shared/components/ticket-receipt/ticket-receipt.component';

export interface CartItem {
  variantId: number;
  productId: number;
  productName: string;
  sizeLabel: string;
  color: string;
  sku: string;
  unitPriceCents: number;
  maxStock: number;
  quantity: number;
}

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyMxnPipe, TicketReceiptComponent],
  template: `
    <div class="pos-workspace no-print">
      @if (errorMessage()) {
        <div class="alert-banner error" role="alert">
          <span>⚠️ {{ errorMessage() }}</span>
          <button type="button" class="alert-close" (click)="errorMessage.set(null)" aria-label="Cerrar alerta">✕</button>
        </div>
      }

      @if (infoMessage()) {
        <div class="alert-banner success" role="status">
          <span>✅ {{ infoMessage() }}</span>
          <button type="button" class="alert-close" (click)="infoMessage.set(null)" aria-label="Cerrar mensaje">✕</button>
        </div>
      }

      <div class="pos-grid">
        <!-- Columna Izquierda: Buscador y Catálogo -->
        <section class="catalog-panel" aria-label="Catálogo de prendas">
          <div class="search-bar-card">
            <label for="pos-search-input" class="sr-only">Buscar artículo por nombre, talla o SKU</label>
            <div class="search-input-row">
              <input
                id="pos-search-input"
                type="text"
                class="search-input"
                placeholder="Buscar por nombre, talla o SKU (Enter para agregar SKU exacto)..."
                [ngModel]="searchTerm()"
                (ngModelChange)="searchTerm.set($event)"
                (keydown.enter)="handleSearchEnter()"
                autofocus
              />
              @if (searchTerm()) {
                <button type="button" class="btn-clear-search" (click)="searchTerm.set('')" aria-label="Limpiar búsqueda">
                  Limpiar
                </button>
              }
              <button type="button" class="btn-refresh" (click)="loadProducts()" [disabled]="isLoading()">
                ↻ Actualizar
              </button>
            </div>

            <div class="category-chips" role="group" aria-label="Filtrar por categoría">
              <button
                type="button"
                class="chip"
                [class.active]="selectedCategory() === ''"
                (click)="selectedCategory.set('')"
              >
                Todas
              </button>
              @for (cat of categories(); track cat) {
                <button
                  type="button"
                  class="chip"
                  [class.active]="selectedCategory() === cat"
                  (click)="selectedCategory.set(cat)"
                >
                  {{ cat }}
                </button>
              }
            </div>
          </div>

          @if (isLoading()) {
            <div class="empty-state">Cargando catálogo de uniformes...</div>
          } @else if (filteredProducts().length === 0) {
            <div class="empty-state">
              <p>No se encontraron prendas activas con ese criterio.</p>
              @if (searchTerm() || selectedCategory()) {
                <button type="button" class="btn-secondary" (click)="resetFilters()">Ver todas las prendas</button>
              }
            </div>
          } @else {
            <div class="products-list">
              @for (product of filteredProducts(); track product.id) {
                <article class="product-card">
                  <div class="product-card-header">
                    <div>
                      <h3 class="product-title">{{ product.name }}</h3>
                      <span class="product-category">{{ product.category }}</span>
                    </div>
                  </div>

                  @if (activeVariants(product).length === 0) {
                    <p class="no-variants">Sin tallas activas disponibles.</p>
                  } @else {
                    <div class="variants-grid">
                      @for (variant of activeVariants(product); track variant.id) {
                        @let inCartQty = getCartQty(variant.id);
                        @let remaining = variant.stock - inCartQty;
                        <div
                          class="variant-row"
                          [class.out-of-stock]="variant.stock === 0"
                          [class.low-stock]="variant.stock > 0 && variant.stock <= variant.minimum_stock"
                        >
                          <div class="variant-info">
                            <div class="variant-main">
                              <span class="size-pill">Talla {{ variant.size_label }}</span>
                              <span class="color-label">{{ variant.color }}</span>
                              <span class="sku-label">{{ variant.sku }}</span>
                            </div>
                            <div class="variant-meta">
                              <span class="variant-price">{{ variant.unit_price_cents | currencyMxn }}</span>
                              @if (variant.stock === 0) {
                                <span class="stock-tag out">Agotado (0)</span>
                              } @else if (variant.stock <= variant.minimum_stock) {
                                <span class="stock-tag low">Bajo stock ({{ variant.stock }} disp.)</span>
                              } @else {
                                <span class="stock-tag ok">{{ variant.stock }} en stock</span>
                              }
                              @if (inCartQty > 0) {
                                <span class="in-cart-tag">{{ inCartQty }} en carrito</span>
                              }
                            </div>
                          </div>

                          <button
                            type="button"
                            class="btn-add-variant"
                            [disabled]="remaining <= 0 || isSubmitting()"
                            (click)="addToCart(product, variant)"
                          >
                            @if (variant.stock === 0) {
                              Agotado
                            } @else if (remaining <= 0) {
                              Tope stock
                            } @else {
                              + Agregar
                            }
                          </button>
                        </div>
                      }
                    </div>
                  }
                </article>
              }
            </div>
          }
        </section>

        <!-- Columna Derecha: Carrito y Cobro -->
        <aside class="cart-panel" aria-label="Carrito de compra y cobro">
          <div class="cart-header">
            <h2>Carrito ({{ totalUnits() }} pzas)</h2>
            @if (cart().length > 0) {
              <button
                type="button"
                class="btn-clear-cart"
                [disabled]="isSubmitting()"
                (click)="clearCart()"
              >
                Vaciar
              </button>
            }
          </div>

          <div class="cart-items-container">
            @if (cart().length === 0) {
              <div class="cart-empty">
                <span class="cart-empty-icon">🛒</span>
                <p>El carrito está vacío.</p>
                <small>Selecciona tallas del catálogo para comenzar la venta.</small>
              </div>
            } @else {
              @for (item of cart(); track item.variantId) {
                <div class="cart-line">
                  <div class="cart-line-top">
                    <div>
                      <div class="cart-line-name">{{ item.productName }}</div>
                      <div class="cart-line-meta">
                        Talla {{ item.sizeLabel }} · {{ item.color }} · {{ item.sku }}
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn-remove-line"
                      [disabled]="isSubmitting()"
                      (click)="removeFromCart(item.variantId)"
                      aria-label="Quitar artículo"
                    >
                      ✕
                    </button>
                  </div>

                  <div class="cart-line-bottom">
                    <div class="qty-controls">
                      <button
                        type="button"
                        class="qty-btn"
                        [disabled]="isSubmitting() || item.quantity <= 1"
                        (click)="decrementQty(item.variantId)"
                        aria-label="Disminuir cantidad"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        class="qty-input"
                        min="1"
                        [max]="item.maxStock"
                        step="1"
                        [ngModel]="item.quantity"
                        (ngModelChange)="setItemQuantity(item.variantId, $event)"
                        [disabled]="isSubmitting()"
                        [attr.aria-label]="'Cantidad para ' + item.productName + ' talla ' + item.sizeLabel"
                      />
                      <button
                        type="button"
                        class="qty-btn"
                        [disabled]="isSubmitting() || item.quantity >= item.maxStock"
                        (click)="incrementQty(item.variantId)"
                        aria-label="Aumentar cantidad"
                      >
                        +
                      </button>
                    </div>

                    <div class="line-prices">
                      <span class="unit-hint">{{ item.unitPriceCents | currencyMxn }} c/u</span>
                      <strong class="line-subtotal">{{ item.unitPriceCents * item.quantity | currencyMxn }}</strong>
                    </div>
                  </div>
                </div>
              }
            }
          </div>

          <div class="checkout-box">
            <div class="total-display">
              <span>TOTAL A PAGAR</span>
              <strong>{{ totalCents() | currencyMxn }}</strong>
            </div>

            <div class="payment-section">
              <span class="section-label">Método de pago</span>
              <div class="payment-methods" role="radiogroup" aria-label="Método de pago">
                <button
                  type="button"
                  class="method-btn"
                  [class.active]="paymentMethod() === 'CASH'"
                  [disabled]="isSubmitting()"
                  (click)="selectPaymentMethod('CASH')"
                >
                  💵 Efectivo
                </button>
                <button
                  type="button"
                  class="method-btn"
                  [class.active]="paymentMethod() === 'CARD'"
                  [disabled]="isSubmitting()"
                  (click)="selectPaymentMethod('CARD')"
                >
                  💳 Tarjeta
                </button>
                <button
                  type="button"
                  class="method-btn"
                  [class.active]="paymentMethod() === 'TRANSFER'"
                  [disabled]="isSubmitting()"
                  (click)="selectPaymentMethod('TRANSFER')"
                >
                  🏦 Transferencia
                </button>
              </div>
            </div>

            @if (paymentMethod() === 'CASH') {
              <div class="cash-section">
                <label for="cash-received-input" class="section-label">Importe recibido ($ MXN)</label>
                <input
                  id="cash-received-input"
                  type="number"
                  min="0"
                  step="0.01"
                  class="cash-input"
                  placeholder="0.00"
                  [ngModel]="cashReceivedPesos()"
                  (ngModelChange)="onCashInputChange($event)"
                  [disabled]="isSubmitting() || cart().length === 0"
                />

                <div class="quick-cash-buttons">
                  <button
                    type="button"
                    class="quick-cash-btn"
                    [disabled]="cart().length === 0 || isSubmitting()"
                    (click)="setExactCash()"
                  >
                    Exacto
                  </button>
                  @for (amount of [100, 200, 500, 1000]; track amount) {
                    <button
                      type="button"
                      class="quick-cash-btn"
                      [disabled]="cart().length === 0 || isSubmitting()"
                      (click)="setCashAmount(amount)"
                    >
                      {{ '$' + amount }}
                    </button>
                  }
                </div>

                @if (cart().length > 0) {
                  <div class="change-display" [class.insufficient]="cashReceivedCents() < totalCents()">
                    @if (cashReceivedCents() >= totalCents()) {
                      <span>Cambio a entregar:</span>
                      <strong>{{ changeCents() | currencyMxn }}</strong>
                    } @else {
                      <span>Falta por cubrir:</span>
                      <strong>{{ totalCents() - cashReceivedCents() | currencyMxn }}</strong>
                    }
                  </div>
                }
              </div>
            } @else {
              <div class="exact-payment-note">
                Se registrará el pago exacto de <strong>{{ totalCents() | currencyMxn }}</strong> por
                {{ paymentMethod() === 'CARD' ? 'tarjeta' : 'transferencia' }} (sin datos bancarios).
              </div>
            }

            <button
              type="button"
              class="btn-checkout"
              [disabled]="!canCheckout()"
              (click)="submitSale()"
            >
              @if (isSubmitting()) {
                Procesando venta...
              } @else {
                COBRAR E IMPRIMIR TICKET
              }
            </button>
          </div>
        </aside>
      </div>
    </div>

    @if (completedSale()) {
      <app-ticket-receipt
        [sale]="completedSale()!"
        (closed)="completedSale.set(null)"
      />
    }
  `,
  styles: []
})
export class PosComponent implements OnInit {
  private apiService = inject(ApiService);

  readonly products = signal<Product[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isSubmitting = signal<boolean>(false);
  readonly searchTerm = signal<string>('');
  readonly selectedCategory = signal<string>('');
  readonly cart = signal<CartItem[]>([]);
  readonly paymentMethod = signal<PaymentMethod>('CASH');
  readonly cashReceivedPesos = signal<number | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly infoMessage = signal<string | null>(null);
  readonly completedSale = signal<SaleDetail | null>(null);

  private pendingIdempotencyKey: string = this.generateUuid();

  readonly categories = computed(() => {
    const cats = new Set<string>();
    for (const p of this.products()) {
      if (p.active) cats.add(p.category);
    }
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'es-MX'));
  });

  readonly filteredProducts = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const cat = this.selectedCategory();

    return this.products().filter((p) => {
      if (!p.active) return false;
      if (cat && p.category !== cat) return false;
      if (!q) return true;

      const matchesProduct =
        p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      const matchesVariant = p.variants.some(
        (v) =>
          v.active &&
          (v.sku.toLowerCase().includes(q) ||
            v.size_label.toLowerCase().includes(q) ||
            v.color.toLowerCase().includes(q))
      );
      return matchesProduct || matchesVariant;
    });
  });

  readonly totalUnits = computed(() =>
    this.cart().reduce((sum, item) => sum + item.quantity, 0)
  );

  readonly totalCents = computed(() =>
    this.cart().reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
  );

  readonly cashReceivedCents = computed(() => {
    const pesos = this.cashReceivedPesos();
    if (pesos === null || pesos === undefined || Number.isNaN(pesos) || pesos < 0) {
      return 0;
    }
    return Math.round(pesos * 100);
  });

  readonly changeCents = computed(() => {
    const diff = this.cashReceivedCents() - this.totalCents();
    return diff > 0 ? diff : 0;
  });

  readonly canCheckout = computed(() => {
    if (this.isSubmitting() || this.cart().length === 0) return false;
    if (this.paymentMethod() === 'CASH') {
      return this.cashReceivedCents() >= this.totalCents();
    }
    return true;
  });

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.apiService.getProducts({ active: true, limit: 100 }).subscribe({
      next: (res) => {
        this.products.set(res.data);
        this.syncCartWithLatestCatalog(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(parseApiError(err));
        this.isLoading.set(false);
      }
    });
  }

  activeVariants(product: Product): ProductVariant[] {
    const q = this.searchTerm().trim().toLowerCase();
    const activeOnly = product.variants.filter((v) => v.active);
    if (!q) return activeOnly;

    const productMatches =
      product.name.toLowerCase().includes(q) || product.category.toLowerCase().includes(q);
    if (productMatches) return activeOnly;

    return activeOnly.filter(
      (v) =>
        v.sku.toLowerCase().includes(q) ||
        v.size_label.toLowerCase().includes(q) ||
        v.color.toLowerCase().includes(q)
    );
  }

  getCartQty(variantId: number): number {
    return this.cart().find((item) => item.variantId === variantId)?.quantity ?? 0;
  }

  handleSearchEnter(): void {
    const q = this.searchTerm().trim().toLowerCase();
    if (!q) return;

    // Buscar coincidencia exacta de SKU primero
    for (const product of this.products()) {
      if (!product.active) continue;
      for (const variant of product.variants) {
        if (variant.active && variant.sku.toLowerCase() === q) {
          if (variant.stock - this.getCartQty(variant.id) > 0) {
            this.addToCart(product, variant);
            this.searchTerm.set('');
          } else {
            this.errorMessage.set(`Sin existencias suficientes para ${product.name} (${variant.sku}).`);
          }
          return;
        }
      }
    }
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.selectedCategory.set('');
  }

  addToCart(product: Product, variant: ProductVariant): void {
    this.errorMessage.set(null);
    const current = this.cart();
    const existing = current.find((i) => i.variantId === variant.id);

    if (existing) {
      if (existing.quantity >= variant.stock) {
        this.errorMessage.set(`Solo hay ${variant.stock} unidades disponibles de ${product.name} talla ${variant.size_label}.`);
        return;
      }
      this.cart.set(
        current.map((i) =>
          i.variantId === variant.id
            ? { ...i, quantity: i.quantity + 1, maxStock: variant.stock, unitPriceCents: variant.unit_price_cents }
            : i
        )
      );
    } else {
      if (variant.stock <= 0) {
        this.errorMessage.set(`La talla ${variant.size_label} está agotada.`);
        return;
      }
      this.cart.set([
        ...current,
        {
          variantId: variant.id,
          productId: product.id,
          productName: product.name,
          sizeLabel: variant.size_label,
          color: variant.color,
          sku: variant.sku,
          unitPriceCents: variant.unit_price_cents,
          maxStock: variant.stock,
          quantity: 1
        }
      ]);
    }
    this.resetIdempotencyKey();
  }

  incrementQty(variantId: number): void {
    this.cart.update((items) =>
      items.map((item) =>
        item.variantId === variantId && item.quantity < item.maxStock
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
    this.resetIdempotencyKey();
  }

  decrementQty(variantId: number): void {
    this.cart.update((items) =>
      items.map((item) =>
        item.variantId === variantId && item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : item
      )
    );
    this.resetIdempotencyKey();
  }

  setItemQuantity(variantId: number, rawValue: number | string): void {
    const parsed = Math.floor(Number(rawValue));
    if (!Number.isFinite(parsed) || parsed < 1) {
      return;
    }
    this.cart.update((items) =>
      items.map((item) => {
        if (item.variantId !== variantId) return item;
        const clamped = Math.min(parsed, item.maxStock);
        return { ...item, quantity: clamped };
      })
    );
    this.resetIdempotencyKey();
  }

  removeFromCart(variantId: number): void {
    this.cart.update((items) => items.filter((i) => i.variantId !== variantId));
    this.resetIdempotencyKey();
  }

  clearCart(): void {
    this.cart.set([]);
    this.cashReceivedPesos.set(null);
    this.errorMessage.set(null);
    this.resetIdempotencyKey();
  }

  selectPaymentMethod(method: PaymentMethod): void {
    this.paymentMethod.set(method);
    this.resetIdempotencyKey();
  }

  onCashInputChange(value: number | string | null): void {
    if (value === null || value === '') {
      this.cashReceivedPesos.set(null);
    } else {
      const parsed = Number(value);
      this.cashReceivedPesos.set(Number.isFinite(parsed) ? parsed : 0);
    }
    this.resetIdempotencyKey();
  }

  setExactCash(): void {
    this.cashReceivedPesos.set(this.totalCents() / 100);
    this.resetIdempotencyKey();
  }

  setCashAmount(pesos: number): void {
    this.cashReceivedPesos.set(pesos);
    this.resetIdempotencyKey();
  }

  submitSale(): void {
    if (!this.canCheckout()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    const method = this.paymentMethod();
    const total = this.totalCents();
    const payload = {
      items: this.cart().map((item) => ({
        variant_id: item.variantId,
        quantity: item.quantity
      })),
      payment_method: method,
      amount_received_cents: method === 'CASH' ? this.cashReceivedCents() : total,
      expected_total_cents: total
    };

    const idempotencyKey = this.pendingIdempotencyKey;

    this.apiService.createSale(payload, idempotencyKey).subscribe({
      next: (created) => {
        // Consultar venta persistida por ID para generar el ticket oficial
        this.apiService.getSaleById(created.id).subscribe({
          next: (persistedSale) => {
            this.finishSaleSuccess(persistedSale);
          },
          error: () => {
            this.finishSaleSuccess(created);
          }
        });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(parseApiError(err));
        // Recargar catálogo por si hubo cambio de precio o stock insuficiente en servidor
        // Mantener pendingIdempotencyKey intacta en caso de error transitorio de red
        this.apiService.getProducts({ active: true, limit: 100 }).subscribe({
          next: (res) => {
            this.products.set(res.data);
            this.syncCartWithLatestCatalog(res.data);
          }
        });
      }
    });
  }

  private finishSaleSuccess(sale: SaleDetail): void {
    this.isSubmitting.set(false);
    this.cart.set([]);
    this.cashReceivedPesos.set(null);
    this.paymentMethod.set('CASH');
    this.resetIdempotencyKey();
    this.completedSale.set(sale);
    this.infoMessage.set(`Venta ${sale.folio} registrada correctamente.`);
    this.loadProducts();
  }

  private syncCartWithLatestCatalog(latestProducts: Product[]): void {
    const variantById = new Map<number, ProductVariant>();
    for (const p of latestProducts) {
      for (const v of p.variants) {
        variantById.set(v.id, v);
      }
    }

    this.cart.update((items) =>
      items.map((item) => {
        const latest = variantById.get(item.variantId);
        if (!latest) return item;
        return {
          ...item,
          unitPriceCents: latest.unit_price_cents,
          maxStock: latest.stock
        };
      })
    );
  }

  private resetIdempotencyKey(): void {
    this.pendingIdempotencyKey = this.generateUuid();
  }

  private generateUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
