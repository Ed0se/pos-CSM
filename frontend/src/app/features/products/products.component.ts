import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ApiService,
  parseApiError,
  Product,
  ProductVariant
} from '../../core/api/api.service';
import { CurrencyMxnPipe } from '../../shared/pipes/currency-mxn.pipe';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyMxnPipe],
  template: `
    <div class="feature-container">
      <div class="feature-header">
        <div>
          <h2>Catálogo de Artículos y Tallas</h2>
          <p class="subtitle">
            Administra los modelos de prendas y configura cada talla, color, SKU y precio en MXN.
          </p>
        </div>
        <button type="button" class="btn-primary" (click)="openNewProductForm()">
          + Nueva Prenda
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

      <!-- Formulario de Alta / Edición de Prenda -->
      @if (showProductForm()) {
        <section class="card form-card" aria-label="Formulario de prenda">
          <div class="card-header">
            <h3>{{ editingProductId() ? 'Editar Prenda' : 'Nueva Prenda' }}</h3>
            <button type="button" class="btn-link" (click)="cancelProductForm()">Cancelar</button>
          </div>
          <form [formGroup]="productForm" (ngSubmit)="saveProduct()" class="form-grid">
            <div class="form-field">
              <label for="prod-name">Nombre de la prenda *</label>
              <input
                id="prod-name"
                type="text"
                formControlName="name"
                placeholder="Ej. Playera polo escolar"
              />
              @if (productForm.controls.name.touched && productForm.controls.name.invalid) {
                <small class="field-error">El nombre es obligatorio (máx. 120 caracteres).</small>
              }
            </div>

            <div class="form-field">
              <label for="prod-category">Categoría *</label>
              <input
                id="prod-category"
                type="text"
                formControlName="category"
                placeholder="Ej. Uniforme diario, Deportes, Invierno"
              />
              @if (productForm.controls.category.touched && productForm.controls.category.invalid) {
                <small class="field-error">La categoría es obligatoria (máx. 60 caracteres).</small>
              }
            </div>

            <div class="form-field full-width">
              <label for="prod-desc">Descripción (opcional)</label>
              <input
                id="prod-desc"
                type="text"
                formControlName="description"
                placeholder="Detalles de tela, modelo o notas internas"
              />
            </div>

            <div class="form-field checkbox-field">
              <label class="checkbox-label">
                <input type="checkbox" formControlName="active" />
                <span>Prenda activa (visible en punto de venta)</span>
              </label>
            </div>

            <div class="form-actions full-width">
              <button type="submit" class="btn-primary" [disabled]="productForm.invalid || isSavingProduct()">
                {{ isSavingProduct() ? 'Guardando...' : (editingProductId() ? 'Guardar Cambios' : 'Crear Prenda') }}
              </button>
              <button type="button" class="btn-secondary" (click)="cancelProductForm()">Cancelar</button>
            </div>
          </form>
        </section>
      }

      <div class="master-detail-grid">
        <!-- Panel Izquierdo: Tabla de Prendas -->
        <section class="card" aria-label="Lista de prendas">
          <div class="toolbar">
            <div class="search-box">
              <label for="products-search" class="sr-only">Buscar prenda o SKU</label>
              <input
                id="products-search"
                type="text"
                placeholder="Buscar prenda, categoría o SKU..."
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
              />
            </div>
            <div class="filter-tabs" role="group" aria-label="Filtrar estado">
              <button
                type="button"
                class="filter-btn"
                [class.active]="statusFilter() === 'ALL'"
                (click)="statusFilter.set('ALL')"
              >
                Todos
              </button>
              <button
                type="button"
                class="filter-btn"
                [class.active]="statusFilter() === 'ACTIVE'"
                (click)="statusFilter.set('ACTIVE')"
              >
                Activos
              </button>
              <button
                type="button"
                class="filter-btn"
                [class.active]="statusFilter() === 'INACTIVE'"
                (click)="statusFilter.set('INACTIVE')"
              >
                Inactivos
              </button>
            </div>
          </div>

          @if (isLoading()) {
            <div class="loading-box">Cargando catálogo...</div>
          } @else if (filteredProducts().length === 0) {
            <div class="empty-box">No hay prendas que coincidan con los filtros.</div>
          } @else {
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Prenda</th>
                    <th>Categoría</th>
                    <th class="num">Tallas</th>
                    <th class="num">Stock Total</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (product of filteredProducts(); track product.id) {
                    <tr [class.selected-row]="selectedProduct()?.id === product.id">
                      <td>
                        <div class="cell-title">{{ product.name }}</div>
                        @if (product.description) {
                          <div class="cell-sub">{{ product.description }}</div>
                        }
                      </td>
                      <td>{{ product.category }}</td>
                      <td class="num">{{ product.variants.length }}</td>
                      <td class="num">{{ getTotalStock(product) }}</td>
                      <td>
                        <span class="badge" [class.active]="product.active" [class.inactive]="!product.active">
                          {{ product.active ? 'Activo' : 'Inactivo' }}
                        </span>
                      </td>
                      <td>
                        <div class="row-actions">
                          <button type="button" class="btn-sm primary" (click)="selectProduct(product)">
                            Tallas ({{ product.variants.length }})
                          </button>
                          <button type="button" class="btn-sm" (click)="openEditProductForm(product)">
                            Editar
                          </button>
                          <button type="button" class="btn-sm" (click)="toggleProductActive(product)">
                            {{ product.active ? 'Inactivar' : 'Activar' }}
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

        <!-- Panel Derecho: Variantes / Tallas de la Prenda Seleccionada -->
        <section class="card detail-panel" aria-label="Variantes de la prenda seleccionada">
          @if (!selectedProduct()) {
            <div class="empty-detail">
              <span class="detail-icon">👕</span>
              <h3>Selecciona una prenda</h3>
              <p>Haz clic en <strong>Tallas</strong> en cualquier prenda para ver, agregar o editar sus tallas, colores, SKUs y precios.</p>
            </div>
          } @else {
            @let currentProduct = selectedProduct()!;
            <div class="detail-header">
              <div>
                <h3>{{ currentProduct.name }}</h3>
                <span class="cell-sub">{{ currentProduct.category }} · Gestión de tallas y precios</span>
              </div>
              <button type="button" class="btn-primary btn-sm-add" (click)="openNewVariantForm()">
                + Agregar Talla/Variante
              </button>
            </div>

            <div class="info-note">
              ℹ️ Las nuevas variantes inician con <strong>0 existencias</strong>. Para cargar stock inicial o registrar entradas, usa la pestaña <strong>Inventario</strong>.
            </div>

            @if (showVariantForm()) {
              <form [formGroup]="variantForm" (ngSubmit)="saveVariant()" class="variant-form-box">
                <div class="form-subheader">
                  <strong>{{ editingVariantId() ? 'Editar Variante' : 'Nueva Talla / Variante' }}</strong>
                  <button type="button" class="btn-link" (click)="cancelVariantForm()">Cerrar</button>
                </div>

                <div class="form-grid">
                  <div class="form-field">
                    <label for="var-size">Talla *</label>
                    <input id="var-size" type="text" formControlName="size_label" placeholder="Ej. 6, 8, 10, CH, M, G" />
                  </div>

                  <div class="form-field">
                    <label for="var-color">Color</label>
                    <input id="var-color" type="text" formControlName="color" placeholder="Estándar" />
                  </div>

                  <div class="form-field">
                    <label for="var-sku">SKU único *</label>
                    <div class="sku-row">
                      <input id="var-sku" type="text" formControlName="sku" placeholder="Ej. CSM-POLO-BLA-10" />
                      <button type="button" class="btn-sm" (click)="suggestSku()" title="Sugerir SKU automático">
                        Sugerir
                      </button>
                    </div>
                  </div>

                  <div class="form-field">
                    <label for="var-price">Precio ($ MXN) *</label>
                    <input id="var-price" type="number" step="0.01" min="0.01" formControlName="pricePesos" placeholder="280.00" />
                  </div>

                  <div class="form-field">
                    <label for="var-min">Stock mínimo</label>
                    <input id="var-min" type="number" step="1" min="0" formControlName="minimum_stock" />
                  </div>

                  <div class="form-field checkbox-field">
                    <label class="checkbox-label">
                      <input type="checkbox" formControlName="active" />
                      <span>Variante activa</span>
                    </label>
                  </div>
                </div>

                <div class="form-actions">
                  <button type="submit" class="btn-primary" [disabled]="variantForm.invalid || isSavingVariant()">
                    {{ isSavingVariant() ? 'Guardando...' : (editingVariantId() ? 'Actualizar Variante' : 'Guardar Variante') }}
                  </button>
                  <button type="button" class="btn-secondary" (click)="cancelVariantForm()">Cancelar</button>
                </div>
              </form>
            }

            @if (currentProduct.variants.length === 0) {
              <div class="empty-box">Esta prenda aún no tiene tallas ni SKUs registrados.</div>
            } @else {
              <div class="table-responsive">
                <table class="data-table compact">
                  <thead>
                    <tr>
                      <th>Talla</th>
                      <th>Color</th>
                      <th>SKU</th>
                      <th class="num">Precio</th>
                      <th class="num">Stock</th>
                      <th class="num">Mín.</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (variant of currentProduct.variants; track variant.id) {
                      <tr>
                        <td><strong>{{ variant.size_label }}</strong></td>
                        <td>{{ variant.color }}</td>
                        <td class="mono">{{ variant.sku }}</td>
                        <td class="num">{{ variant.unit_price_cents | currencyMxn }}</td>
                        <td class="num">
                          <strong [class.text-danger]="variant.stock <= variant.minimum_stock">{{ variant.stock }}</strong>
                        </td>
                        <td class="num">{{ variant.minimum_stock }}</td>
                        <td>
                          <span class="badge" [class.active]="variant.active" [class.inactive]="!variant.active">
                            {{ variant.active ? 'Activa' : 'Inactiva' }}
                          </span>
                        </td>
                        <td>
                          <button type="button" class="btn-sm" (click)="openEditVariantForm(variant)">
                            Editar
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }
        </section>
      </div>
    </div>
  `,
  styles: [`
    .form-card { margin-bottom: 1.25rem; border: 1px solid #bfdbfe; }
    .detail-header { display: flex; justify-content: space-between; align-items: flex-start; gap: .75rem; margin-bottom: .9rem; }
    .detail-header h3 { margin: 0; font-size: 1.1rem; }
    .master-detail-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 1.25rem; align-items: start; }
    @media (max-width: 1050px) { .master-detail-grid { grid-template-columns: 1fr; } }
    .sku-row { display: flex; gap: .4rem; }
    .sku-row input { flex: 1; }
    .checkbox-field { justify-content: flex-end; }
    .checkbox-label { display: flex; align-items: center; gap: .45rem; cursor: pointer; font-weight: 500; }
    .field-error { color: #dc2626; font-size: .78rem; }
    .selected-row { background: #eff6ff; }
    .btn-sm-add { padding: .45rem .75rem; font-size: .85rem; }
    .empty-detail { text-align: center; padding: 3rem 1.5rem; color: #64748b; }
    .detail-icon { font-size: 2.5rem; display: block; margin-bottom: .75rem; }
    .info-note { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; padding: .6rem .8rem; border-radius: 7px; font-size: .82rem; margin-bottom: .9rem; }
    .variant-form-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: .9rem; margin-bottom: 1rem; }
    .form-subheader { display: flex; justify-content: space-between; align-items: center; margin-bottom: .75rem; }
  `]
})
export class ProductsComponent implements OnInit {
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);

  readonly products = signal<Product[]>([]);
  readonly selectedProductId = signal<number | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly isSavingProduct = signal<boolean>(false);
  readonly isSavingVariant = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  readonly showProductForm = signal<boolean>(false);
  readonly editingProductId = signal<number | null>(null);

  readonly showVariantForm = signal<boolean>(false);
  readonly editingVariantId = signal<number | null>(null);

  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly productForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    category: ['', [Validators.required, Validators.maxLength(60)]],
    description: [''],
    active: [true]
  });

  readonly variantForm = this.fb.nonNullable.group({
    size_label: ['', [Validators.required, Validators.maxLength(30)]],
    color: ['Estándar', [Validators.maxLength(60)]],
    sku: ['', [Validators.required, Validators.maxLength(64)]],
    pricePesos: [0, [Validators.required, Validators.min(0.01)]],
    minimum_stock: [0, [Validators.required, Validators.min(0)]],
    active: [true]
  });

  readonly selectedProduct = computed(() => {
    const id = this.selectedProductId();
    if (id === null) return null;
    return this.products().find((p) => p.id === id) ?? null;
  });

  readonly filteredProducts = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.products().filter((p) => {
      if (filter === 'ACTIVE' && !p.active) return false;
      if (filter === 'INACTIVE' && p.active) return false;
      if (!q) return true;

      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.variants.some(
          (v) =>
            v.sku.toLowerCase().includes(q) ||
            v.size_label.toLowerCase().includes(q) ||
            v.color.toLowerCase().includes(q)
        )
      );
    });
  });

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(preserveSelectedId?: number): void {
    this.isLoading.set(true);
    this.apiService.getProducts({ limit: 100 }).subscribe({
      next: (res) => {
        this.products.set(res.data);
        const targetId = preserveSelectedId ?? this.selectedProductId();
        if (targetId && res.data.some((p) => p.id === targetId)) {
          this.selectedProductId.set(targetId);
        } else if (res.data.length > 0 && !this.selectedProductId()) {
          this.selectedProductId.set(res.data[0]!.id);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(parseApiError(err));
        this.isLoading.set(false);
      }
    });
  }

  getTotalStock(product: Product): number {
    return product.variants.reduce((sum, v) => sum + v.stock, 0);
  }

  selectProduct(product: Product): void {
    this.selectedProductId.set(product.id);
    this.showVariantForm.set(false);
    this.editingVariantId.set(null);
  }

  openNewProductForm(): void {
    this.editingProductId.set(null);
    this.productForm.reset({
      name: '',
      category: '',
      description: '',
      active: true
    });
    this.showProductForm.set(true);
    this.errorMessage.set(null);
  }

  openEditProductForm(product: Product): void {
    this.editingProductId.set(product.id);
    this.productForm.reset({
      name: product.name,
      category: product.category,
      description: product.description ?? '',
      active: product.active
    });
    this.showProductForm.set(true);
    this.errorMessage.set(null);
  }

  cancelProductForm(): void {
    this.showProductForm.set(false);
    this.editingProductId.set(null);
  }

  saveProduct(): void {
    if (this.productForm.invalid) return;
    this.isSavingProduct.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const val = this.productForm.getRawValue();
    const payload = {
      name: val.name.trim(),
      category: val.category.trim(),
      description: val.description.trim() || null,
      active: val.active
    };

    const editId = this.editingProductId();
    const req$ = editId
      ? this.apiService.updateProduct(editId, payload)
      : this.apiService.createProduct(payload);

    req$.subscribe({
      next: (saved) => {
        this.isSavingProduct.set(false);
        this.showProductForm.set(false);
        this.editingProductId.set(null);
        this.successMessage.set(
          editId ? `Prenda "${saved.name}" actualizada.` : `Prenda "${saved.name}" creada. Ahora agrega sus tallas.`
        );
        this.loadProducts(saved.id);
      },
      error: (err) => {
        this.isSavingProduct.set(false);
        this.errorMessage.set(parseApiError(err));
      }
    });
  }

  toggleProductActive(product: Product): void {
    this.errorMessage.set(null);
    this.apiService.updateProduct(product.id, { active: !product.active }).subscribe({
      next: (updated) => {
        this.successMessage.set(
          `Prenda "${updated.name}" marcada como ${updated.active ? 'Activa' : 'Inactiva'}.`
        );
        this.loadProducts(updated.id);
      },
      error: (err) => {
        this.errorMessage.set(parseApiError(err));
      }
    });
  }

  openNewVariantForm(): void {
    this.editingVariantId.set(null);
    this.variantForm.reset({
      size_label: '',
      color: 'Estándar',
      sku: '',
      pricePesos: 0,
      minimum_stock: 0,
      active: true
    });
    this.showVariantForm.set(true);
    this.errorMessage.set(null);
  }

  openEditVariantForm(variant: ProductVariant): void {
    this.editingVariantId.set(variant.id);
    this.variantForm.reset({
      size_label: variant.size_label,
      color: variant.color,
      sku: variant.sku,
      pricePesos: variant.unit_price_cents / 100,
      minimum_stock: variant.minimum_stock,
      active: variant.active
    });
    this.showVariantForm.set(true);
    this.errorMessage.set(null);
  }

  cancelVariantForm(): void {
    this.showVariantForm.set(false);
    this.editingVariantId.set(null);
  }

  suggestSku(): void {
    const product = this.selectedProduct();
    if (!product) return;
    const val = this.variantForm.getRawValue();
    const clean = (txt: string, maxLen: number) =>
      txt
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, maxLen);

    const prodCode = clean(product.name, 4) || 'PROD';
    const colorCode = clean(val.color || 'EST', 3) || 'EST';
    const sizeCode = clean(val.size_label || 'U', 4) || 'U';
    this.variantForm.controls.sku.setValue(`CSM-${prodCode}-${colorCode}-${sizeCode}`);
  }

  saveVariant(): void {
    const product = this.selectedProduct();
    if (!product || this.variantForm.invalid) return;

    const val = this.variantForm.getRawValue();
    const priceCents = Math.round(Number(val.pricePesos) * 100);
    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      this.errorMessage.set('El precio debe ser mayor a $0.00.');
      return;
    }

    const minStock = Math.floor(Number(val.minimum_stock));
    if (!Number.isInteger(minStock) || minStock < 0) {
      this.errorMessage.set('El stock mínimo debe ser un entero mayor o igual a 0.');
      return;
    }

    this.isSavingVariant.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const payload = {
      size_label: val.size_label.trim(),
      color: val.color.trim() || 'Estándar',
      sku: val.sku.trim().toUpperCase(),
      unit_price_cents: priceCents,
      minimum_stock: minStock,
      active: val.active
    };

    const editVariantId = this.editingVariantId();
    const req$ = editVariantId
      ? this.apiService.updateVariant(editVariantId, payload)
      : this.apiService.createVariant(product.id, payload);

    req$.subscribe({
      next: (saved) => {
        this.isSavingVariant.set(false);
        this.showVariantForm.set(false);
        this.editingVariantId.set(null);
        this.successMessage.set(
          editVariantId
            ? `Variante ${saved.sku} actualizada.`
            : `Talla ${saved.size_label} (${saved.sku}) agregada a ${product.name}.`
        );
        this.loadProducts(product.id);
      },
      error: (err) => {
        this.isSavingVariant.set(false);
        this.errorMessage.set(parseApiError(err));
      }
    });
  }
}
