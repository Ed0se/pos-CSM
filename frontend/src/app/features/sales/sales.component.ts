import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  parseApiError,
  PaymentMethod,
  SaleDetail,
  SalesReport,
  SaleSummary
} from '../../core/api/api.service';
import { CurrencyMxnPipe } from '../../shared/pipes/currency-mxn.pipe';
import { HermosilloDatePipe } from '../../shared/pipes/hermosillo-date.pipe';
import { TicketReceiptComponent } from '../../shared/components/ticket-receipt/ticket-receipt.component';

type PeriodPreset = 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CurrencyMxnPipe,
    HermosilloDatePipe,
    TicketReceiptComponent
  ],
  template: `
    <div class="feature-container no-print">
      <div class="feature-header">
        <div>
          <h2>Historial de Ventas y Reportes</h2>
          <p class="subtitle">
            Consulta de ventas realizadas, reimpresión de tickets históricos y resumen de ingresos (hora local Hermosillo).
          </p>
        </div>
        <div class="header-actions">
          <button
            type="button"
            class="btn-primary"
            [disabled]="isLoading() || isDownloadingPdf()"
            (click)="exportPdf()"
          >
            {{ isDownloadingPdf() ? 'Generando PDF...' : '📄 Generar Reporte PDF' }}
          </button>
          <button
            type="button"
            class="btn-secondary"
            [disabled]="sales().length === 0"
            (click)="exportCsv()"
          >
            ⬇️ Exportar CSV
          </button>
        </div>
      </div>

      @if (errorMessage()) {
        <div class="alert-banner error" role="alert">
          <span>⚠️ {{ errorMessage() }}</span>
          <button type="button" class="alert-close" (click)="errorMessage.set(null)">✕</button>
        </div>
      }

      <!-- Barra de Filtros -->
      <section class="card filter-card" aria-label="Filtros de ventas y reporte">
        <div class="filter-row">
          <div class="preset-group" role="group" aria-label="Periodo">
            <button
              type="button"
              class="preset-btn"
              [class.active]="preset() === 'TODAY'"
              (click)="selectPreset('TODAY')"
            >
              Hoy
            </button>
            <button
              type="button"
              class="preset-btn"
              [class.active]="preset() === 'WEEK'"
              (click)="selectPreset('WEEK')"
            >
              Últimos 7 días
            </button>
            <button
              type="button"
              class="preset-btn"
              [class.active]="preset() === 'MONTH'"
              (click)="selectPreset('MONTH')"
            >
              Este mes
            </button>
            <button
              type="button"
              class="preset-btn"
              [class.active]="preset() === 'CUSTOM'"
              (click)="selectPreset('CUSTOM')"
            >
              Rango personalizado
            </button>
          </div>

          <div class="folio-search">
            <label for="sales-folio-search" class="sr-only">Buscar por folio</label>
            <input
              id="sales-folio-search"
              type="text"
              placeholder="Buscar folio (ej. CSM-00000001)..."
              [ngModel]="folioFilter()"
              (ngModelChange)="folioFilter.set($event)"
              (keydown.enter)="loadData()"
            />
            <button type="button" class="btn-primary" (click)="loadData()">Buscar</button>
          </div>
        </div>

        @if (preset() === 'CUSTOM') {
          <div class="custom-range-row">
            <div class="date-field">
              <label for="date-from">Desde (inclusive)</label>
              <input
                id="date-from"
                type="date"
                [ngModel]="customFrom()"
                (ngModelChange)="customFrom.set($event)"
              />
            </div>
            <div class="date-field">
              <label for="date-to">Hasta (inclusive)</label>
              <input
                id="date-to"
                type="date"
                [ngModel]="customTo()"
                (ngModelChange)="customTo.set($event)"
              />
            </div>
            <button type="button" class="btn-primary" (click)="loadData()">Aplicar rango</button>
          </div>
        }
      </section>

      <!-- Indicadores (KPIs) -->
      @if (report()) {
        @let r = report()!;
        <section class="kpi-grid" aria-label="Resumen del periodo">
          <div class="kpi-card">
            <span class="kpi-label">Número de Ventas</span>
            <strong class="kpi-value">{{ r.sales_count }}</strong>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Prendas Vendidas</span>
            <strong class="kpi-value">{{ r.units_sold }} pzas</strong>
          </div>
          <div class="kpi-card highlight">
            <span class="kpi-label">Ingresos Totales</span>
            <strong class="kpi-value">{{ r.revenue_cents | currencyMxn }}</strong>
          </div>
        </section>

        <div class="analytics-grid">
          <section class="card" aria-label="Desglose por método de pago">
            <h3>Ingresos por Método de Pago</h3>
            @if (r.by_payment_method.length === 0) {
              <p class="empty-inline">Sin ventas registradas en este periodo.</p>
            } @else {
              <table class="data-table compact">
                <thead>
                  <tr>
                    <th>Método</th>
                    <th class="num">Ventas</th>
                    <th class="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of r.by_payment_method; track row.method) {
                    <tr>
                      <td>{{ formatPaymentMethod(row.method) }}</td>
                      <td class="num">{{ row.sales_count }}</td>
                      <td class="num"><strong>{{ row.revenue_cents | currencyMxn }}</strong></td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>

          <section class="card" aria-label="Prendas más vendidas">
            <h3>Artículos Más Vendidos</h3>
            @if (r.top_items.length === 0) {
              <p class="empty-inline">Sin prendas vendidas en este periodo.</p>
            } @else {
              <table class="data-table compact">
                <thead>
                  <tr>
                    <th>Artículo</th>
                    <th>SKU</th>
                    <th class="num">Uds.</th>
                    <th class="num">Ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of r.top_items; track item.sku) {
                    <tr>
                      <td>
                        <div class="cell-title">{{ item.name }}</div>
                        <div class="cell-sub">Talla {{ item.size_label }} · {{ item.color }}</div>
                      </td>
                      <td class="mono">{{ item.sku }}</td>
                      <td class="num"><strong>{{ item.units }}</strong></td>
                      <td class="num">{{ item.revenue_cents | currencyMxn }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>
        </div>
      }

      <!-- Tabla de Historial de Ventas -->
      <section class="card history-card" aria-label="Listado de ventas">
        <div class="card-header">
          <h3>Historial de Ventas</h3>
          <span class="cell-sub">Mostrando {{ sales().length }} venta(s)</span>
        </div>

        @if (isLoading()) {
          <div class="loading-box">Cargando ventas...</div>
        } @else if (sales().length === 0) {
          <div class="empty-box">No se encontraron ventas en el rango seleccionado.</div>
        } @else {
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha / Hora (Hermosillo)</th>
                  <th class="num">Prendas</th>
                  <th>Método de Pago</th>
                  <th class="num">Total</th>
                  <th class="num">Recibido</th>
                  <th class="num">Cambio</th>
                  <th>Ticket</th>
                </tr>
              </thead>
              <tbody>
                @for (sale of sales(); track sale.id) {
                  <tr>
                    <td class="mono"><strong>{{ sale.folio }}</strong></td>
                    <td>{{ sale.created_at | hermosilloDate }}</td>
                    <td class="num">{{ sale.items_count }}</td>
                    <td>{{ formatPaymentMethod(sale.payment_method) }}</td>
                    <td class="num"><strong>{{ sale.total_cents | currencyMxn }}</strong></td>
                    <td class="num">{{ sale.amount_received_cents | currencyMxn }}</td>
                    <td class="num">{{ sale.change_cents | currencyMxn }}</td>
                    <td>
                      <button
                        type="button"
                        class="btn-sm primary"
                        [disabled]="loadingSaleId() === sale.id"
                        (click)="openSaleTicket(sale.id)"
                      >
                        {{ loadingSaleId() === sale.id ? 'Cargando...' : '🧾 Detalle / Reimprimir' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>

    @if (selectedSale()) {
      <app-ticket-receipt
        [sale]="selectedSale()!"
        (closed)="selectedSale.set(null)"
      />
    }
  `,
  styles: [`
    .header-actions { display: flex; gap: .55rem; flex-wrap: wrap; }
    .filter-card { margin-bottom: 1.25rem; }
    .filter-row { display: flex; justify-content: space-between; align-items: center; gap: .85rem; flex-wrap: wrap; }
    .preset-group { display: flex; gap: .4rem; flex-wrap: wrap; }
    .preset-btn { padding: .5rem .85rem; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 7px; cursor: pointer; font-weight: 600; font-size: .85rem; color: #334155; }
    .preset-btn.active { background: #1e3a8a; color: #fff; border-color: #1e3a8a; }
    .folio-search { display: flex; gap: .45rem; flex: 1; max-width: 360px; }
    .folio-search input { flex: 1; padding: .5rem .75rem; border: 1px solid #cbd5e1; border-radius: 7px; font-size: .9rem; }
    .custom-range-row { display: flex; align-items: flex-end; gap: .85rem; flex-wrap: wrap; margin-top: .9rem; padding-top: .9rem; border-top: 1px solid #e2e8f0; }
    .date-field { display: flex; flex-direction: column; gap: .25rem; }
    .date-field label { font-size: .8rem; font-weight: 600; color: #475569; }
    .date-field input { padding: .45rem .65rem; border: 1px solid #cbd5e1; border-radius: 6px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.25rem; }
    @media (max-width: 720px) { .kpi-grid { grid-template-columns: 1fr; } }
    .kpi-card { background: #fff; border-radius: 10px; padding: 1rem 1.2rem; box-shadow: 0 1px 3px rgba(0,0,0,.08); display: flex; flex-direction: column; gap: .3rem; }
    .kpi-card.highlight { background: #1e3a8a; color: #fff; }
    .kpi-label { font-size: .85rem; color: #64748b; font-weight: 600; }
    .kpi-card.highlight .kpi-label { color: #bfdbfe; }
    .kpi-value { font-size: 1.6rem; font-weight: 800; }
    .analytics-grid { display: grid; grid-template-columns: 1fr 1.3fr; gap: 1rem; margin-bottom: 1.25rem; }
    @media (max-width: 900px) { .analytics-grid { grid-template-columns: 1fr; } }
    .analytics-grid h3, .history-card h3 { margin: 0 0 .75rem; font-size: 1.05rem; }
    .empty-inline { text-align: center; padding: 1.5rem 1rem; color: #64748b; }
  `]
})
export class SalesComponent implements OnInit {
  private apiService = inject(ApiService);

  readonly sales = signal<SaleSummary[]>([]);
  readonly report = signal<SalesReport | null>(null);
  readonly selectedSale = signal<SaleDetail | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly isDownloadingPdf = signal<boolean>(false);
  readonly loadingSaleId = signal<number | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly preset = signal<PeriodPreset>('TODAY');
  readonly folioFilter = signal<string>('');
  readonly customFrom = signal<string>(this.getTodayHermosillo());
  readonly customTo = signal<string>(this.getTodayHermosillo());

  ngOnInit(): void {
    this.loadData();
  }

  selectPreset(newPreset: PeriodPreset): void {
    this.preset.set(newPreset);
    if (newPreset !== 'CUSTOM') {
      this.loadData();
    }
  }

  loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { from, to } = this.computeRange();
    const folio = this.folioFilter().trim();

    this.apiService.getSalesReport({ from, to }).subscribe({
      next: (rep) => this.report.set(rep),
      error: (err) => this.errorMessage.set(parseApiError(err))
    });

    this.apiService
      .getSales({
        from: folio ? undefined : from,
        to: folio ? undefined : to,
        folio: folio || undefined,
        limit: 100
      })
      .subscribe({
        next: (res) => {
          this.sales.set(res.data);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.errorMessage.set(parseApiError(err));
          this.isLoading.set(false);
        }
      });
  }

  openSaleTicket(saleId: number): void {
    this.loadingSaleId.set(saleId);
    this.errorMessage.set(null);
    this.apiService.getSaleById(saleId).subscribe({
      next: (detail) => {
        this.loadingSaleId.set(null);
        this.selectedSale.set(detail);
      },
      error: (err) => {
        this.loadingSaleId.set(null);
        this.errorMessage.set(parseApiError(err));
      }
    });
  }

  formatPaymentMethod(method: PaymentMethod): string {
    switch (method) {
      case 'CASH':
        return 'Efectivo';
      case 'CARD':
        return 'Tarjeta';
      case 'TRANSFER':
        return 'Transferencia';
    }
  }

  exportPdf(): void {
    const { from, to } = this.computeRange();
    const folio = this.folioFilter().trim();

    this.isDownloadingPdf.set(true);
    this.errorMessage.set(null);

    this.apiService
      .downloadSalesReportPdf({
        from,
        to,
        folio: folio || undefined
      })
      .subscribe({
        next: (blob) => {
          this.isDownloadingPdf.set(false);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `reporte-ventas-csm-${from}_a_${to}.pdf`;
          link.click();
          URL.revokeObjectURL(url);
        },
        error: (err) => {
          this.isDownloadingPdf.set(false);
          this.errorMessage.set(parseApiError(err));
        }
      });
  }

  exportCsv(): void {
    const rows = this.sales();
    if (rows.length === 0) return;

    const header = ['Folio', 'FechaUTC', 'Prendas', 'MetodoPago', 'TotalMXN', 'RecibidoMXN', 'CambioMXN'];
    const lines = [
      header.join(','),
      ...rows.map((s) =>
        [
          s.folio,
          s.created_at,
          s.items_count,
          this.formatPaymentMethod(s.payment_method),
          (s.total_cents / 100).toFixed(2),
          (s.amount_received_cents / 100).toFixed(2),
          (s.change_cents / 100).toFixed(2)
        ].join(',')
      )
    ];

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ventas-csm-${this.getTodayHermosillo()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private computeRange(): { from: string; to: string } {
    const today = this.getTodayHermosillo();
    switch (this.preset()) {
      case 'TODAY':
        return { from: today, to: this.addDays(today, 1) };
      case 'WEEK':
        return { from: this.addDays(today, -6), to: this.addDays(today, 1) };
      case 'MONTH': {
        const monthStart = `${today.slice(0, 7)}-01`;
        return { from: monthStart, to: this.addDays(today, 1) };
      }
      case 'CUSTOM': {
        const from = this.customFrom() || today;
        const rawTo = this.customTo() || from;
        const safeTo = rawTo < from ? from : rawTo;
        return { from, to: this.addDays(safeTo, 1) };
      }
    }
  }

  private getTodayHermosillo(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Hermosillo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  private addDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const utc = new Date(Date.UTC(y!, m! - 1, d! + days));
    const yyyy = utc.getUTCFullYear();
    const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(utc.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
