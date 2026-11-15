import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ApiService,
  InventoryItem,
  ManualMovementKind,
  MovementKind,
  parseApiError,
  StockMovement
} from '../../core/api/api.service';
import { CurrencyMxnPipe } from '../../shared/pipes/currency-mxn.pipe';
import { HermosilloDatePipe } from '../../shared/pipes/hermosillo-date.pipe';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyMxnPipe, HermosilloDatePipe],
  template: `
    <div class="feature-container">
      <div class="feature-header">
        <div>
          <h2>Control de Inventario</h2>
          <p class="subtitle">
            Existencias por variante, alertas de stock mínimo y auditoría de entradas, salidas y ajustes.
          </p>
        </div>
        <button type="button" class="btn-primary" (click)="openMovementForm()">
          + Registrar Entrada / Salida / Ajuste
        </button>
      </div>

      @if (errorMessage()) {
        <div class="alert-banner error" role="alert">
          <span>⚠️ {{ errorMessage() }}</span>
          <button type="button" class="alert-close" (click)="errorMessage.set(null)">✕</button>
        </div>
      }

      @if (successMessage()) {
        <div class="alert-banner success" role="status">
          <span>✅ {{ successMessage() }}</span>
          <button type="button" class="alert-close" (click)="successMessage.set(null)">✕</button>
        </div>
      }

      <!-- Formulario de Movimiento Auditado -->
      @if (showMovementForm()) {
        <section class="card movement-card" aria-label="Registrar movimiento de inventario">
          <div class="card-header">
            <h3>Registrar Movimiento de Inventario</h3>
            <button type="button" class="btn-link" (click)="closeMovementForm()">Cancelar</button>
          </div>

          <form [formGroup]="movementForm" (ngSubmit)="submitMovement()" class="form-grid">
            <div class="form-field full-width">
              <label for="mov-variant">Variante (Prenda / Talla / Color / SKU) *</label>
              <select id="mov-variant" formControlName="variant_id">
                <option [ngValue]="0" disabled>Selecciona una variante...</option>
                @for (item of allInventory(); track item.variant_id) {
                  <option [ngValue]="item.variant_id">
                    {{ item.product_name }} · Talla {{ item.size_label }} · {{ item.color }} ({{ item.sku }}) — Stock: {{ item.stock }}
                  </option>
                }
              </select>
            </div>

            <div class="form-field">
              <label for="mov-kind">Tipo de movimiento *</label>
              <select id="mov-kind" formControlName="kind">
                <option value="ENTRY">Entrada (Suma existencias)</option>
                <option value="EXIT">Salida (Resta existencias)</option>
                <option value="ADJUSTMENT">Ajuste (Positivo + o Negativo -)</option>
              </select>
            </div>

            <div class="form-field">
              <label for="mov-qty">
                @if (movementForm.controls.kind.value === 'ADJUSTMENT') {
                  Diferencia de ajuste (ej. +5 o -2) *
                } @else {
                  Cantidad entera (mayor a 0) *
                }
              </label>
              <input
                id="mov-qty"
                type="number"
                step="1"
                formControlName="quantityInput"
                placeholder="Ej. 10"
              />
            </div>

            <div class="form-field full-width">
              <label for="mov-reason">Motivo obligatorio *</label>
              <input
                id="mov-reason"
                type="text"
                formControlName="reason"
                placeholder="Ej. Compra a proveedor, Inventario inicial, Merma, Conteo físico..."
              />
            </div>

            @if (selectedVariantForMovement()) {
              @let selectedVar = selectedVariantForMovement()!;
              @let preview = previewStockResult();
              <div class="stock-preview full-width" [class.invalid]="preview.nextStock < 0 || preview.delta === 0">
                <span>Stock actual: <strong>{{ selectedVar.stock }}</strong></span>
                <span>→</span>
                <span>
                  Stock resultante:
                  <strong>{{ preview.nextStock }}</strong>
                  @if (preview.delta === 0) {
                    (Ingresa una cantidad entera válida)
                  } @else if (preview.nextStock < 0) {
                    (No se permite stock negativo)
                  }
                </span>
              </div>
            }

            <div class="form-actions full-width">
              <button type="submit" class="btn-primary" [disabled]="!canSubmitMovement()">
                {{ isSavingMovement() ? 'Registrando...' : 'Confirmar Movimiento' }}
              </button>
              <button type="button" class="btn-secondary" (click)="closeMovementForm()">Cancelar</button>
            </div>
          </form>
        </section>
      }

      <!-- Tabla de Existencias por Variante -->
      <section class="card" aria-label="Existencias por variante">
        <div class="toolbar">
          <div class="search-box">
            <label for="inv-search" class="sr-only">Buscar por artículo, SKU, talla o color</label>
            <input
              id="inv-search"
              type="text"
              placeholder="Buscar por artículo, SKU, talla o color..."
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
            />
          </div>

          <div class="filter-tabs" role="group" aria-label="Filtrar existencias">
            <button
              type="button"
              class="filter-btn"
              [class.active]="stockFilter() === 'ALL'"
              (click)="stockFilter.set('ALL')"
            >
              Todos ({{ allInventory().length }})
            </button>
            <button
              type="button"
              class="filter-btn warning"
              [class.active]="stockFilter() === 'LOW'"
              (click)="stockFilter.set('LOW')"
            >
              ⚠️ Bajo mínimo ({{ lowStockCount() }})
            </button>
            <button
              type="button"
              class="filter-btn danger"
              [class.active]="stockFilter() === 'OUT'"
              (click)="stockFilter.set('OUT')"
            >
              ⛔ Agotados ({{ outOfStockCount() }})
            </button>
            <button type="button" class="filter-btn" (click)="loadAll()">↻ Actualizar</button>
          </div>
        </div>

        @if (isLoading()) {
          <div class="loading-box">Cargando inventario...</div>
        } @else if (filteredInventory().length === 0) {
          <div class="empty-box">No hay variantes que coincidan con el filtro seleccionado.</div>
        } @else {
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Artículo</th>
                  <th>Talla</th>
                  <th>Color</th>
                  <th>SKU</th>
                  <th class="num">Precio</th>
                  <th class="num">Stock</th>
                  <th class="num">Mínimo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (item of filteredInventory(); track item.variant_id) {
                  <tr>
                    <td>
                      <div class="cell-title">{{ item.product_name }}</div>
                      <div class="cell-sub">{{ item.category }}</div>
                    </td>
                    <td><strong>{{ item.size_label }}</strong></td>
                    <td>{{ item.color }}</td>
                    <td class="mono">{{ item.sku }}</td>
                    <td class="num">{{ item.unit_price_cents | currencyMxn }}</td>
                    <td class="num">
                      <strong [class.text-danger]="item.stock === 0" [class.text-warning]="item.stock > 0 && item.stock <= item.minimum_stock">
                        {{ item.stock }}
                      </strong>
                    </td>
                    <td class="num">{{ item.minimum_stock }}</td>
                    <td>
                      @if (item.stock_status === 'OUT_OF_STOCK') {
                        <span class="status-pill out">⛔ Agotado</span>
                      } @else if (item.stock_status === 'LOW_STOCK') {
                        <span class="status-pill low">⚠️ Bajo mínimo</span>
                      } @else {
                        <span class="status-pill ok">✅ Disponible</span>
                      }
                    </td>
                    <td>
                      <div class="row-actions">
                        <button type="button" class="btn-sm primary" (click)="openMovementForm(item.variant_id)">
                          ± Mover stock
                        </button>
                        <button type="button" class="btn-sm" (click)="filterMovementsByVariant(item)">
                          Auditoría
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Historial de Auditoría de Movimientos -->
      <section class="card audit-section" aria-label="Auditoría de movimientos de inventario">
        <div class="card-header">
          <div>
            <h3>Auditoría de Movimientos Recientes</h3>
            <span class="cell-sub">Cada entrada, salida, ajuste o venta queda registrada con fecha y saldo final.</span>
          </div>
          @if (auditVariantFilter()) {
            <button type="button" class="btn-secondary btn-sm-clear" (click)="clearAuditFilter()">
              Filtro: {{ auditVariantFilter()!.sku }} ✕ Ver todos
            </button>
          }
        </div>

        @if (isLoadingMovements()) {
          <div class="loading-box">Cargando movimientos...</div>
        } @else if (movements().length === 0) {
          <div class="empty-box">Aún no hay movimientos registrados.</div>
        } @else {
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Fecha / Hora (Hermosillo)</th>
                  <th>Prenda / Talla</th>
                  <th>SKU</th>
                  <th>Tipo</th>
                  <th class="num">Cambio</th>
                  <th class="num">Stock Final</th>
                  <th>Motivo / Referencia</th>
                </tr>
              </thead>
              <tbody>
                @for (mov of movements(); track mov.id) {
                  <tr>
                    <td>{{ mov.created_at | hermosilloDate }}</td>
                    <td>
                      <div class="cell-title">{{ mov.product_name }}</div>
                      <div class="cell-sub">Talla {{ mov.size_label }} · {{ mov.color }}</div>
                    </td>
                    <td class="mono">{{ mov.sku }}</td>
                    <td>
                      <span class="kind-pill" [ngClass]="mov.kind.toLowerCase()">
                        {{ formatMovementKind(mov.kind) }}
                      </span>
                    </td>
                    <td class="num">
                      <strong [class.delta-pos]="mov.quantity_delta > 0" [class.delta-neg]="mov.quantity_delta < 0">
                        {{ mov.quantity_delta > 0 ? '+' + mov.quantity_delta : mov.quantity_delta }}
                      </strong>
                    </td>
                    <td class="num"><strong>{{ mov.stock_after }}</strong></td>
                    <td>
                      {{ mov.reason }}
                      @if (mov.sale_folio) {
                        <span class="folio-badge">{{ mov.sale_folio }}</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .movement-card { margin-bottom: 1.25rem; border: 1px solid #bfdbfe; }
    .audit-section { margin-top: 1.25rem; }
    .stock-preview { display: flex; gap: .75rem; align-items: center; padding: .65rem .9rem; border-radius: 7px; background: #dcfce7; color: #166534; font-size: .92rem; }
    .stock-preview.invalid { background: #fee2e2; color: #991b1b; }
    .btn-sm-clear { padding: .35rem .7rem; font-size: .82rem; }
    .status-pill { display: inline-block; padding: .2rem .55rem; border-radius: 9999px; font-size: .78rem; font-weight: 600; white-space: nowrap; }
    .status-pill.ok { background: #dcfce7; color: #166534; }
    .status-pill.low { background: #fef3c7; color: #92400e; }
    .status-pill.out { background: #fee2e2; color: #991b1b; }
    .kind-pill { display: inline-block; padding: .15rem .5rem; border-radius: 5px; font-size: .76rem; font-weight: 700; }
    .kind-pill.entry { background: #dcfce7; color: #166534; }
    .kind-pill.exit { background: #fef3c7; color: #92400e; }
    .kind-pill.adjustment { background: #e0e7ff; color: #3730a3; }
    .kind-pill.sale { background: #dbeafe; color: #1e40af; }
    .delta-pos { color: #16a34a; }
    .delta-neg { color: #dc2626; }
    .folio-badge { display: inline-block; margin-left: .4rem; padding: .1rem .4rem; border-radius: 4px; background: #f1f5f9; font-family: monospace; font-size: .78rem; color: #334155; }
  `]
})
export class InventoryComponent implements OnInit {
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);

  readonly allInventory = signal<InventoryItem[]>([]);
  readonly movements = signal<StockMovement[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isLoadingMovements = signal<boolean>(true);
  readonly isSavingMovement = signal<boolean>(false);

  readonly searchTerm = signal<string>('');
  readonly stockFilter = signal<'ALL' | 'LOW' | 'OUT'>('ALL');
  readonly showMovementForm = signal<boolean>(false);
  readonly auditVariantFilter = signal<InventoryItem | null>(null);

  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly movementForm = this.fb.nonNullable.group({
    variant_id: [0, [Validators.required, Validators.min(1)]],
    kind: ['ENTRY' as ManualMovementKind, [Validators.required]],
    quantityInput: [1, [Validators.required]],
    reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(255)]]
  });

  readonly lowStockCount = computed(
    () => this.allInventory().filter((i) => i.stock > 0 && i.stock <= i.minimum_stock).length
  );

  readonly outOfStockCount = computed(
    () => this.allInventory().filter((i) => i.stock === 0).length
  );

  readonly filteredInventory = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const filter = this.stockFilter();

    return this.allInventory().filter((item) => {
      if (filter === 'LOW' && !(item.stock > 0 && item.stock <= item.minimum_stock)) return false;
      if (filter === 'OUT' && item.stock !== 0) return false;
      if (!q) return true;

      return (
        item.product_name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.size_label.toLowerCase().includes(q) ||
        item.color.toLowerCase().includes(q)
      );
    });
  });

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loadInventory();
    this.loadMovements();
  }

  loadInventory(): void {
    this.isLoading.set(true);
    this.apiService.getInventory({ limit: 100 }).subscribe({
      next: (res) => {
        this.allInventory.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(parseApiError(err));
        this.isLoading.set(false);
      }
    });
  }

  loadMovements(): void {
    this.isLoadingMovements.set(true);
    const variantFilter = this.auditVariantFilter();
    this.apiService
      .getMovements({
        variantId: variantFilter?.variant_id,
        limit: 50
      })
      .subscribe({
        next: (res) => {
          this.movements.set(res.data);
          this.isLoadingMovements.set(false);
        },
        error: (err) => {
          this.errorMessage.set(parseApiError(err));
          this.isLoadingMovements.set(false);
        }
      });
  }

  openMovementForm(variantId?: number): void {
    const defaultId = variantId ?? this.allInventory()[0]?.variant_id ?? 0;
    this.movementForm.reset({
      variant_id: defaultId,
      kind: 'ENTRY',
      quantityInput: 1,
      reason: ''
    });
    this.showMovementForm.set(true);
    this.errorMessage.set(null);
  }

  closeMovementForm(): void {
    this.showMovementForm.set(false);
  }

  selectedVariantForMovement(): InventoryItem | null {
    const id = Number(this.movementForm.controls.variant_id.value);
    return this.allInventory().find((i) => i.variant_id === id) ?? null;
  }

  previewStockResult(): { delta: number; nextStock: number } {
    const variant = this.selectedVariantForMovement();
    const current = variant?.stock ?? 0;
    const rawQty = Number(this.movementForm.controls.quantityInput.value);
    if (!Number.isInteger(rawQty) || rawQty === 0) {
      return { delta: 0, nextStock: current };
    }
    const kind = this.movementForm.controls.kind.value;
    let delta = rawQty;
    if (kind === 'ENTRY') {
      delta = rawQty > 0 ? rawQty : 0;
    } else if (kind === 'EXIT') {
      delta = rawQty > 0 ? -rawQty : 0;
    }
    return {
      delta,
      nextStock: current + delta
    };
  }

  canSubmitMovement(): boolean {
    if (this.movementForm.invalid || this.isSavingMovement()) return false;
    const preview = this.previewStockResult();
    return preview.delta !== 0 && preview.nextStock >= 0;
  }

  submitMovement(): void {
    if (!this.canSubmitMovement()) return;

    const val = this.movementForm.getRawValue();
    const preview = this.previewStockResult();

    this.isSavingMovement.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.apiService
      .createMovement({
        variant_id: Number(val.variant_id),
        kind: val.kind,
        quantity_delta: preview.delta,
        reason: val.reason.trim()
      })
      .subscribe({
        next: (mov) => {
          this.isSavingMovement.set(false);
          this.showMovementForm.set(false);
          this.successMessage.set(
            `Movimiento registrado para ${mov.sku}: ${mov.quantity_delta > 0 ? '+' + mov.quantity_delta : mov.quantity_delta} (nuevo stock: ${mov.stock_after}).`
          );
          this.loadAll();
        },
        error: (err) => {
          this.isSavingMovement.set(false);
          this.errorMessage.set(parseApiError(err));
        }
      });
  }

  filterMovementsByVariant(item: InventoryItem): void {
    this.auditVariantFilter.set(item);
    this.loadMovements();
  }

  clearAuditFilter(): void {
    this.auditVariantFilter.set(null);
    this.loadMovements();
  }

  formatMovementKind(kind: MovementKind): string {
    switch (kind) {
      case 'ENTRY':
        return 'Entrada';
      case 'EXIT':
        return 'Salida';
      case 'ADJUSTMENT':
        return 'Ajuste';
      case 'SALE':
        return 'Venta';
    }
  }
}
