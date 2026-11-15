import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentMethod, SaleDetail } from '../../../core/api/api.models';
import { CurrencyMxnPipe } from '../../pipes/currency-mxn.pipe';
import { HermosilloDatePipe } from '../../pipes/hermosillo-date.pipe';

@Component({
  selector: 'app-ticket-receipt',
  standalone: true,
  imports: [CommonModule, CurrencyMxnPipe, HermosilloDatePipe],
  template: `
    <div class="ticket-backdrop" role="dialog" aria-modal="true" aria-labelledby="ticket-dialog-title">
      <div class="ticket-dialog">
        <div class="ticket-actions-bar no-print">
          <h3 id="ticket-dialog-title">Ticket de Venta · {{ sale.folio }}</h3>
          <div class="ticket-buttons">
            <button type="button" class="btn-print" (click)="printTicket()">
              🖨️ Imprimir Ticket (80 mm)
            </button>
            <button type="button" class="btn-close-ticket" (click)="close()">
              Cerrar (Esc)
            </button>
          </div>
        </div>

        <div class="ticket-preview-scroll">
          <article class="ticket-sheet" aria-label="Ticket comercial de 80 mm">
            <header class="ticket-header">
              <div class="school-name">{{ sale.school.name || 'Colegio San Miguel' }}</div>
              @if (sale.school.address) {
                <div class="school-meta">{{ sale.school.address }}</div>
              }
              @if (sale.school.phone) {
                <div class="school-meta">Tel: {{ sale.school.phone }}</div>
              }
              <div class="ticket-subtitle">Venta de Uniformes Escolares</div>
            </header>

            <div class="ticket-divider">----------------------------------------</div>

            <section class="ticket-meta">
              <div class="meta-row">
                <span>Folio:</span>
                <strong>{{ sale.folio }}</strong>
              </div>
              <div class="meta-row">
                <span>Fecha:</span>
                <span>{{ sale.created_at | hermosilloDate }}</span>
              </div>
              <div class="meta-row">
                <span>Pago:</span>
                <span>{{ formatPaymentMethod(sale.payment_method) }}</span>
              </div>
            </section>

            <div class="ticket-divider">----------------------------------------</div>

            <section class="ticket-items">
              <div class="items-header">
                <span>ARTÍCULO</span>
                <span>IMPORTE</span>
              </div>
              @for (item of sale.items; track item.sku) {
                <div class="ticket-item">
                  <div class="item-name">{{ item.name }}</div>
                  <div class="item-variant">
                    Talla: {{ item.size_label }} · {{ item.color }} · {{ item.sku }}
                  </div>
                  <div class="item-calc">
                    <span>{{ item.quantity }} x {{ item.unit_price_cents | currencyMxn }}</span>
                    <strong>{{ item.line_total_cents | currencyMxn }}</strong>
                  </div>
                </div>
              }
            </section>

            <div class="ticket-divider">----------------------------------------</div>

            <section class="ticket-totals">
              <div class="total-row">
                <span>Subtotal:</span>
                <span>{{ sale.subtotal_cents | currencyMxn }}</span>
              </div>
              @if (sale.discount_cents > 0) {
                <div class="total-row">
                  <span>Descuento:</span>
                  <span>-{{ sale.discount_cents | currencyMxn }}</span>
                </div>
              }
              <div class="total-row grand-total">
                <span>TOTAL MXN:</span>
                <span>{{ sale.total_cents | currencyMxn }}</span>
              </div>
              <div class="total-row">
                <span>Recibido ({{ formatPaymentMethod(sale.payment_method) }}):</span>
                <span>{{ sale.amount_received_cents | currencyMxn }}</span>
              </div>
              @if (sale.payment_method === 'CASH') {
                <div class="total-row">
                  <span>Cambio:</span>
                  <span>{{ sale.change_cents | currencyMxn }}</span>
                </div>
              }
            </section>

            <div class="ticket-divider">----------------------------------------</div>

            <footer class="ticket-footer">
              @if (sale.school.footer) {
                <p class="footer-message">{{ sale.school.footer }}</p>
              }
              <p class="non-fiscal-notice">
                Comprobante comercial — No es un comprobante fiscal (CFDI)
              </p>
            </footer>
          </article>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ticket-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .ticket-dialog {
      background: #f8fafc;
      border-radius: 10px;
      max-width: 460px;
      width: 100%;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }

    .ticket-actions-bar {
      background: #1e3a8a;
      color: #ffffff;
      padding: 0.9rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .ticket-actions-bar h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
    }

    .ticket-buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .btn-print {
      flex: 1;
      background: #fbbf24;
      color: #1e3a8a;
      border: none;
      border-radius: 6px;
      padding: 0.55rem 0.9rem;
      font-weight: 700;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .btn-print:hover {
      background: #f59e0b;
    }

    .btn-close-ticket {
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 6px;
      padding: 0.55rem 0.9rem;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .btn-close-ticket:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .ticket-preview-scroll {
      overflow-y: auto;
      padding: 1.25rem;
      display: flex;
      justify-content: center;
      background: #e2e8f0;
    }

    .ticket-sheet {
      width: 76mm;
      max-width: 100%;
      background: #ffffff;
      color: #000000;
      padding: 4mm;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.35;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
    }

    .ticket-header {
      text-align: center;
    }

    .school-name {
      font-size: 15px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .school-meta {
      font-size: 11px;
    }

    .ticket-subtitle {
      font-size: 11px;
      margin-top: 2px;
      font-weight: 600;
    }

    .ticket-divider {
      text-align: center;
      overflow: hidden;
      white-space: nowrap;
      margin: 6px 0;
      font-size: 11px;
    }

    .meta-row,
    .items-header,
    .item-calc,
    .total-row {
      display: flex;
      justify-content: space-between;
      gap: 6px;
    }

    .items-header {
      font-weight: 700;
      font-size: 11px;
      margin-bottom: 4px;
    }

    .ticket-item {
      margin-bottom: 6px;
    }

    .item-name {
      font-weight: 700;
    }

    .item-variant {
      font-size: 11px;
    }

    .grand-total {
      font-size: 14px;
      font-weight: 700;
      margin: 4px 0;
    }

    .ticket-footer {
      text-align: center;
      font-size: 11px;
    }

    .footer-message {
      margin: 4px 0;
      font-weight: 600;
    }

    .non-fiscal-notice {
      margin: 6px 0 0;
      font-size: 10px;
      font-weight: 700;
    }

    @media print {
      .ticket-backdrop {
        position: static;
        background: transparent;
        padding: 0;
        display: block;
      }

      .ticket-dialog {
        box-shadow: none;
        background: transparent;
        max-width: none;
        max-height: none;
        border-radius: 0;
      }

      .ticket-preview-scroll {
        padding: 0;
        background: transparent;
        overflow: visible;
        display: block;
      }

      .ticket-sheet {
        width: 76mm;
        margin: 0;
        padding: 2mm;
        box-shadow: none;
      }
    }
  `]
})
export class TicketReceiptComponent {
  @Input({ required: true }) sale!: SaleDetail;
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.close();
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

  printTicket(): void {
    window.print();
  }

  close(): void {
    this.closed.emit();
  }
}
