import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { ApiService, HealthResponse, Product, SaleDetail } from './core/api/api.service';
import { CurrencyMxnPipe } from './shared/pipes/currency-mxn.pipe';
import { HermosilloDatePipe } from './shared/pipes/hermosillo-date.pipe';
import { PosComponent } from './features/pos/pos.component';
import { SalesComponent } from './features/sales/sales.component';
import { TicketReceiptComponent } from './shared/components/ticket-receipt/ticket-receipt.component';
import { routes } from './app.routes';

describe('App Component', () => {
  let mockApiService: { getHealth: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockApiService = {
      getHealth: vi.fn().mockReturnValue(of({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: { api: 'up', database: 'connected' }
      } as HealthResponse))
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        { provide: ApiService, useValue: mockApiService }
      ]
    }).compileComponents();
  });

  it('debe crear la aplicación correctamente', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('debe mostrar el título del colegio en el encabezado', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-title')?.textContent).toContain('Colegio San Miguel');
  });

  it('debe tener las 4 pestañas de navegación configuradas', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const tabs = compiled.querySelectorAll('.nav-tab');
    expect(tabs.length).toBe(4);
    const tabTexts = Array.from(tabs).map(t => t.textContent?.trim());
    expect(tabTexts.some(t => t?.includes('Punto de venta'))).toBe(true);
    expect(tabTexts.some(t => t?.includes('Artículos'))).toBe(true);
    expect(tabTexts.some(t => t?.includes('Inventario'))).toBe(true);
    expect(tabTexts.some(t => t?.includes('Ventas'))).toBe(true);
  });
});

describe('CurrencyMxnPipe y HermosilloDatePipe', () => {
  const currencyPipe = new CurrencyMxnPipe();
  const datePipe = new HermosilloDatePipe();

  it('debe formatear centavos a MXN correctamente', () => {
    const formatted = currencyPipe.transform(28000);
    expect(formatted).toContain('280.00');
  });

  it('debe manejar 0 y valores nulos devolviendo $0.00', () => {
    expect(currencyPipe.transform(0)).toContain('0.00');
    expect(currencyPipe.transform(null)).toContain('0.00');
    expect(currencyPipe.transform(undefined)).toContain('0.00');
  });

  it('debe convertir fecha UTC a zona horaria America/Hermosillo (UTC-7)', () => {
    // 2026-11-10T03:00:00.000Z equivale a 09/11/2026 20:00:00 en Hermosillo
    const formatted = datePipe.transform('2026-11-10T03:00:00.000Z');
    expect(formatted).toContain('09/11/2026');
    expect(formatted).toContain('20:00:00');
  });
});

describe('ApiService HTTP', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe enviar el header Idempotency-Key al crear una venta', () => {
    const key = '6f28f57d-04c7-4d2c-9c52-d654f98c662b';
    service
      .createSale(
        {
          items: [{ variant_id: 1, quantity: 2 }],
          payment_method: 'CASH',
          amount_received_cents: 60000
        },
        key
      )
      .subscribe();

    const req = httpMock.expectOne('http://127.0.0.1:3000/api/v1/sales');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe(key);
    req.flush({ id: 1, folio: 'CSM-00000001' });
  });

  it('debe solicitar el reporte de ventas en PDF como Blob con los parámetros de filtro', () => {
    const pdfBlob = new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' });
    let received: Blob | undefined;

    service
      .downloadSalesReportPdf({
        from: '2026-11-15',
        to: '2026-11-16',
        folio: 'CSM-00000001'
      })
      .subscribe((blob) => {
        received = blob;
      });

    const req = httpMock.expectOne(
      'http://127.0.0.1:3000/api/v1/reports/sales/pdf?from=2026-11-15&to=2026-11-16&folio=CSM-00000001'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(pdfBlob);

    expect(received).toBeInstanceOf(Blob);
    expect(received?.size).toBeGreaterThan(0);
  });
});

describe('PosComponent', () => {
  const sampleProducts: Product[] = [
    {
      id: 1,
      name: 'Playera polo escolar',
      category: 'Uniforme diario',
      description: null,
      active: true,
      created_at: '2026-11-10T00:00:00.000Z',
      updated_at: '2026-11-10T00:00:00.000Z',
      variants: [
        {
          id: 10,
          product_id: 1,
          size_label: '8',
          color: 'Blanco',
          sku: 'CSM-POLO-8',
          unit_price_cents: 25000,
          stock: 2,
          minimum_stock: 1,
          active: true,
          created_at: '2026-11-10T00:00:00.000Z',
          updated_at: '2026-11-10T00:00:00.000Z'
        }
      ]
    }
  ];

  let mockApiService: {
    getProducts: ReturnType<typeof vi.fn>;
    createSale: ReturnType<typeof vi.fn>;
    getSaleById: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockApiService = {
      getProducts: vi.fn().mockReturnValue(
        of({ data: sampleProducts, pagination: { page: 1, limit: 100, total: 1 } })
      ),
      createSale: vi.fn(),
      getSaleById: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [PosComponent],
      providers: [{ provide: ApiService, useValue: mockApiService }]
    }).compileComponents();
  });

  it('debe agregar tallas al carrito sin superar el stock y calcular cambio en centavos', () => {
    const fixture = TestBed.createComponent(PosComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    const product = sampleProducts[0]!;
    const variant = product.variants[0]!;

    comp.addToCart(product, variant);
    comp.addToCart(product, variant);
    comp.addToCart(product, variant); // excede stock de 2

    expect(comp.cart().length).toBe(1);
    expect(comp.cart()[0]?.quantity).toBe(2);
    expect(comp.totalCents()).toBe(50000);
    expect(comp.errorMessage()).toContain('2 unidades disponibles');

    comp.onCashInputChange(600);
    expect(comp.cashReceivedCents()).toBe(60000);
    expect(comp.changeCents()).toBe(10000);
    expect(comp.canCheckout()).toBe(true);
  });

  it('debe conservar el carrito si falla el cobro en el servidor', () => {
    mockApiService.createSale.mockReturnValue(
      throwError(() => new Error('Error de red simulado'))
    );

    const fixture = TestBed.createComponent(PosComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    const product = sampleProducts[0]!;
    const variant = product.variants[0]!;

    comp.addToCart(product, variant);
    comp.setExactCash();
    comp.submitSale();

    expect(comp.cart().length).toBe(1);
    expect(comp.errorMessage()).toContain('Error de red simulado');
    expect(comp.completedSale()).toBeNull();
  });
});

describe('TicketReceiptComponent', () => {
  it('debe renderizar folio, líneas congeladas y leyenda de comprobante no fiscal', async () => {
    const saleDetail: SaleDetail = {
      id: 7,
      folio: 'CSM-00000007',
      created_at: '2026-11-10T18:30:00.000Z',
      items: [
        {
          variant_id: 1,
          sku: 'CSM-POLO-10',
          name: 'Playera polo escolar',
          size_label: '10',
          color: 'Blanco',
          quantity: 2,
          unit_price_cents: 28000,
          line_total_cents: 56000
        }
      ],
      subtotal_cents: 56000,
      discount_cents: 0,
      total_cents: 56000,
      payment_method: 'CASH',
      amount_received_cents: 60000,
      change_cents: 4000,
      school: {
        name: 'Colegio San Miguel',
        address: 'Av. Central 100',
        phone: '662-000-0000',
        footer: 'Gracias por su compra'
      }
    };

    await TestBed.configureTestingModule({
      imports: [TicketReceiptComponent]
    }).compileComponents();

    const fixture = TestBed.createComponent(TicketReceiptComponent);
    fixture.componentInstance.sale = saleDetail;
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('CSM-00000007');
    expect(text).toContain('Playera polo escolar');
    expect(text).toContain('560.00');
    expect(text).toContain('No es un comprobante fiscal (CFDI)');
  });
});

describe('SalesComponent', () => {
  it('debe renderizar el botón Generar Reporte PDF e invocar downloadSalesReportPdf al hacer clic', () => {
    const apiMock = {
      getSales: vi.fn().mockReturnValue(
        of({
          data: [
            {
              id: 1,
              folio: 'CSM-00000001',
              created_at: '2026-11-15T17:00:00.000Z',
              items_count: 2,
              subtotal_cents: 56000,
              discount_cents: 0,
              total_cents: 56000,
              payment_method: 'CASH',
              amount_received_cents: 60000,
              change_cents: 4000
            }
          ],
          pagination: { page: 1, limit: 20, total: 1 }
        })
      ),
      getSalesReport: vi.fn().mockReturnValue(
        of({
          from: '2026-11-15',
          to: '2026-11-16',
          sales_count: 1,
          units_sold: 2,
          revenue_cents: 56000,
          by_payment_method: [{ method: 'CASH', sales_count: 1, revenue_cents: 56000 }],
          top_items: [
            {
              sku: 'CSM-POLO-BLA-10',
              name: 'Playera polo escolar',
              size_label: '10',
              color: 'Blanco',
              units: 2,
              revenue_cents: 56000
            }
          ]
        })
      ),
      downloadSalesReportPdf: vi.fn().mockReturnValue(
        of(new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' }))
      )
    };

    TestBed.configureTestingModule({
      imports: [SalesComponent],
      providers: [{ provide: ApiService, useValue: apiMock }]
    });

    const fixture = TestBed.createComponent(SalesComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const pdfButton = Array.from(host.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Generar Reporte PDF')
    );

    expect(pdfButton).toBeTruthy();

    const origCreateObjectUrl = URL.createObjectURL;
    const origRevokeObjectUrl = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/reporte-test');
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      pdfButton?.click();
      fixture.detectChanges();

      expect(apiMock.downloadSalesReportPdf).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    } finally {
      URL.createObjectURL = origCreateObjectUrl;
      URL.revokeObjectURL = origRevokeObjectUrl;
      clickSpy.mockRestore();
    }
  });
});
