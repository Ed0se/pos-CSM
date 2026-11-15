import { SalesReportDto, SaleSummaryDto } from '../repositories/sales.repository.js';
import { addDaysToDateStr } from './date.js';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2; // 532 pt
const TOP_START_Y = 752;
const BOTTOM_LIMIT_Y = 64;

const WINANSI_MAP: Record<string, string> = {
  '\u2022': '\\225', // •
  '\u2013': '\\226', // –
  '\u2014': '\\227', // —
  '\u00a1': '\\241', // ¡
  '\u00b0': '\\260', // °
  '\u00b7': '\\267', // ·
  '\u00bf': '\\277', // ¿
  '\u00c1': '\\301', // Á
  '\u00c9': '\\311', // É
  '\u00cd': '\\315', // Í
  '\u00d1': '\\321', // Ñ
  '\u00d3': '\\323', // Ó
  '\u00da': '\\332', // Ú
  '\u00dc': '\\334', // Ü
  '\u00e1': '\\341', // á
  '\u00e9': '\\351', // é
  '\u00ed': '\\355', // í
  '\u00f1': '\\361', // ñ
  '\u00f3': '\\363', // ó
  '\u00fa': '\\372', // ú
  '\u00fc': '\\374'  // ü
};

/**
 * Codifica una cadena UTF-8 como literal de cadena PDF compatible con WinAnsiEncoding (ASCII puro).
 */
export function encodePdfText(text: string): string {
  const normalized = text.replace(/[\u00a0\u202f]/g, ' ').replace(/[\r\n]+/g, ' ');
  let out = '';
  for (const ch of normalized) {
    if (ch === '\\') {
      out += '\\\\';
    } else if (ch === '(') {
      out += '\\(';
    } else if (ch === ')') {
      out += '\\)';
    } else if (WINANSI_MAP[ch]) {
      out += WINANSI_MAP[ch];
    } else {
      const code = ch.charCodeAt(0);
      if (code >= 32 && code <= 126) {
        out += ch;
      } else if (code >= 160 && code <= 255) {
        out += `\\${code.toString(8).padStart(3, '0')}`;
      } else {
        out += '?';
      }
    }
  }
  return out;
}

/**
 * Estima el ancho en puntos PDF de un texto usando Helvetica / Helvetica-Bold.
 */
function estimateTextWidth(text: string, fontSize: number, bold: boolean): number {
  let units = 0;
  for (const ch of text) {
    if ('ilIj.,:;\'!| '.includes(ch)) {
      units += 278;
    } else if ('ftr()-/'.includes(ch)) {
      units += 333;
    } else if ('WMmw@#%&'.includes(ch)) {
      units += 833;
    } else if (ch >= 'A' && ch <= 'Z') {
      units += bold ? 722 : 667;
    } else if (ch >= '0' && ch <= '9' || ch === '$') {
      units += 556;
    } else {
      units += bold ? 570 : 520;
    }
  }
  return (units / 1000) * fontSize;
}

function truncateTextToWidth(text: string, maxWidth: number, fontSize: number, bold: boolean): string {
  if (estimateTextWidth(text, fontSize, bold) <= maxWidth) {
    return text;
  }
  let clipped = text;
  while (clipped.length > 1 && estimateTextWidth(`${clipped}...`, fontSize, bold) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}...`;
}

function formatCurrencyMxn(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(cents / 100);
}

function formatHermosilloDateTime(isoUtc: string | Date): string {
  const date = isoUtc instanceof Date ? isoUtc : new Date(isoUtc);
  if (Number.isNaN(date.getTime())) {
    return String(isoUtc);
  }
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Hermosillo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function formatPaymentMethodEs(method: string): string {
  switch (method) {
    case 'CASH':
      return 'Efectivo';
    case 'CARD':
      return 'Tarjeta';
    case 'TRANSFER':
      return 'Transferencia';
    default:
      return method;
  }
}

class PdfCanvasBuilder {
  private pages: string[][] = [[]];
  private currentPageIndex = 0;
  public cursorY = TOP_START_Y;

  private get cmds(): string[] {
    return this.pages[this.currentPageIndex]!;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  newPage(): void {
    this.pages.push([]);
    this.currentPageIndex = this.pages.length - 1;
    this.cursorY = TOP_START_Y;
  }

  drawRect(x: number, y: number, w: number, h: number, fillRgb: string, strokeRgb?: string): void {
    if (strokeRgb) {
      this.cmds.push(`q ${fillRgb} rg ${strokeRgb} RG 0.7 w ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re B Q`);
    } else {
      this.cmds.push(`q ${fillRgb} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f Q`);
    }
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, strokeRgb = '0.796 0.835 0.882', width = 0.75): void {
    this.cmds.push(`q ${strokeRgb} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`);
  }

  drawText(
    text: string,
    x: number,
    y: number,
    options: { size?: number; bold?: boolean; rgb?: string; align?: 'left' | 'right'; maxWidth?: number } = {}
  ): void {
    const size = options.size ?? 9;
    const bold = options.bold ?? false;
    const rgb = options.rgb ?? '0.059 0.090 0.165';
    const align = options.align ?? 'left';

    const finalText = options.maxWidth
      ? truncateTextToWidth(text, options.maxWidth, size, bold)
      : text;

    let drawX = x;
    if (align === 'right') {
      drawX = x - estimateTextWidth(finalText, size, bold);
    }

    const fontRef = bold ? '/F2' : '/F1';
    const encoded = encodePdfText(finalText);
    this.cmds.push(`BT ${fontRef} ${size} Tf ${rgb} rg ${drawX.toFixed(2)} ${y.toFixed(2)} Td (${encoded}) Tj ET`);
  }

  addFooters(footerText: string): void {
    const total = this.pages.length;
    for (let i = 0; i < total; i++) {
      this.currentPageIndex = i;
      this.drawLine(MARGIN_X, 46, PAGE_WIDTH - MARGIN_X, 46, '0.796 0.835 0.882', 0.6);
      this.drawText(footerText, MARGIN_X, 32, { size: 8, rgb: '0.392 0.455 0.545' });
      this.drawText(`Página ${i + 1} de ${total}`, PAGE_WIDTH - MARGIN_X, 32, {
        size: 8,
        bold: true,
        rgb: '0.392 0.455 0.545',
        align: 'right'
      });
    }
  }

  toPdfBuffer(): Buffer {
    const objects: string[] = [];
    const addObject = (body: string): number => {
      objects.push(body);
      return objects.length;
    };

    const catalogId = addObject(''); // 1
    const pagesId = addObject(''); // 2
    const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); // 3
    const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'); // 4

    const pageIds: number[] = [];
    for (const pageCmds of this.pages) {
      const streamContent = pageCmds.join('\n');
      const streamLength = Buffer.byteLength(streamContent, 'ascii');
      const contentId = addObject(`<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream`);
      const pageId = addObject(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
      );
      pageIds.push(pageId);
    }

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    const chunks: string[] = ['%PDF-1.4\n'];
    const offsets: number[] = [0];
    let currentOffset = Buffer.byteLength(chunks[0]!, 'ascii');

    for (let i = 0; i < objects.length; i++) {
      offsets.push(currentOffset);
      const objStr = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
      chunks.push(objStr);
      currentOffset += Buffer.byteLength(objStr, 'ascii');
    }

    const xrefOffset = currentOffset;
    chunks.push(`xref\n0 ${objects.length + 1}\n`);
    chunks.push('0000000000 65535 f \n');
    for (let i = 1; i <= objects.length; i++) {
      chunks.push(`${String(offsets[i]!).padStart(10, '0')} 00000 n \n`);
    }

    chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`);
    chunks.push(`startxref\n${xrefOffset}\n%%EOF\n`);

    return Buffer.from(chunks.join(''), 'ascii');
  }
}

export interface BuildSalesReportPdfParams {
  report: SalesReportDto;
  sales: SaleSummaryDto[];
  salesTotal: number;
  schoolName: string;
  folioFilter?: string;
  generatedAt?: Date;
}

/**
 * Genera un documento PDF con el resumen ejecutivo, desgloses y listado de ventas del periodo.
 */
export function buildSalesReportPdf(params: BuildSalesReportPdfParams): Buffer {
  const { report, sales, salesTotal, schoolName, folioFilter } = params;
  const pdf = new PdfCanvasBuilder();

  const navy = '0.118 0.227 0.541';
  const gold = '0.984 0.749 0.141';
  const darkText = '0.059 0.090 0.165';
  const mutedText = '0.392 0.455 0.545';
  const cardBg = '0.973 0.980 0.988';
  const border = '0.796 0.835 0.882';
  const zebraBg = '0.953 0.969 0.988';
  const white = '1 1 1';

  const inclusiveEnd = addDaysToDateStr(report.to, -1);
  const periodLabel =
    inclusiveEnd >= report.from
      ? `Periodo: ${report.from} al ${inclusiveEnd}`
      : `Periodo: ${report.from} (corte < ${report.to})`;
  const issuedLabel = `Emitido: ${formatHermosilloDateTime(params.generatedAt ?? new Date())} (Hermosillo)`;

  // 1. Encabezado principal
  pdf.drawRect(MARGIN_X, 704, CONTENT_WIDTH, 54, navy);
  pdf.drawRect(MARGIN_X, 701, CONTENT_WIDTH, 3, gold);
  pdf.drawText(schoolName || 'Colegio San Miguel', MARGIN_X + 14, 737, {
    size: 14,
    bold: true,
    rgb: white
  });
  pdf.drawText('REPORTE DE VENTAS E INGRESOS', MARGIN_X + 14, 717, {
    size: 10.5,
    bold: true,
    rgb: '0.859 0.918 0.996'
  });
  pdf.drawText(periodLabel, PAGE_WIDTH - MARGIN_X - 14, 737, {
    size: 9,
    bold: true,
    rgb: white,
    align: 'right'
  });
  pdf.drawText(issuedLabel, PAGE_WIDTH - MARGIN_X - 14, 719, {
    size: 8,
    rgb: '0.859 0.918 0.996',
    align: 'right'
  });

  pdf.cursorY = 685;

  if (folioFilter && folioFilter.trim().length > 0) {
    pdf.drawText(`Filtro por folio: "${folioFilter.trim()}"`, MARGIN_X, pdf.cursorY, {
      size: 8.5,
      bold: true,
      rgb: navy
    });
    pdf.cursorY -= 16;
  }

  // 2. Tarjetas KPI
  const kpiWidth = 170;
  const kpiGap = 11;
  const kpiHeight = 52;
  const kpiY = pdf.cursorY - kpiHeight;

  // KPI 1: Ventas
  pdf.drawRect(MARGIN_X, kpiY, kpiWidth, kpiHeight, cardBg, border);
  pdf.drawText('VENTAS REALIZADAS', MARGIN_X + 12, kpiY + 34, { size: 8, bold: true, rgb: mutedText });
  pdf.drawText(String(report.sales_count), MARGIN_X + 12, kpiY + 13, { size: 15, bold: true, rgb: darkText });

  // KPI 2: Unidades
  const kpi2X = MARGIN_X + kpiWidth + kpiGap;
  pdf.drawRect(kpi2X, kpiY, kpiWidth, kpiHeight, cardBg, border);
  pdf.drawText('PRENDAS VENDIDAS', kpi2X + 12, kpiY + 34, { size: 8, bold: true, rgb: mutedText });
  pdf.drawText(`${report.units_sold} pzas`, kpi2X + 12, kpiY + 13, { size: 15, bold: true, rgb: darkText });

  // KPI 3: Ingresos Totales
  const kpi3X = kpi2X + kpiWidth + kpiGap;
  pdf.drawRect(kpi3X, kpiY, kpiWidth, kpiHeight, navy);
  pdf.drawText('INGRESOS TOTALES', kpi3X + 12, kpiY + 34, { size: 8, bold: true, rgb: '0.749 0.859 0.996' });
  pdf.drawText(formatCurrencyMxn(report.revenue_cents), kpi3X + 12, kpiY + 13, { size: 15, bold: true, rgb: white });

  pdf.cursorY = kpiY - 22;

  const ensureSpace = (neededHeight: number, onNewPageHeader?: () => void): void => {
    if (pdf.cursorY - neededHeight < BOTTOM_LIMIT_Y) {
      pdf.newPage();
      pdf.drawRect(MARGIN_X, 742, CONTENT_WIDTH, 20, navy);
      pdf.drawText(`${schoolName || 'Colegio San Miguel'} — Reporte de Ventas (${periodLabel})`, MARGIN_X + 10, 748, {
        size: 8.5,
        bold: true,
        rgb: white
      });
      pdf.cursorY = 724;
      if (onNewPageHeader) {
        onNewPageHeader();
      }
    }
  };

  // 3. Desglose por Método de Pago
  pdf.drawText('1. Ingresos por Método de Pago', MARGIN_X, pdf.cursorY, { size: 11, bold: true, rgb: navy });
  pdf.cursorY -= 10;

  if (report.by_payment_method.length === 0) {
    pdf.cursorY -= 12;
    pdf.drawText('Sin ventas registradas en este periodo.', MARGIN_X, pdf.cursorY, { size: 9, rgb: mutedText });
    pdf.cursorY -= 18;
  } else {
    const headerY = pdf.cursorY - 18;
    pdf.drawRect(MARGIN_X, headerY, CONTENT_WIDTH, 18, cardBg, border);
    pdf.drawText('MÉTODO DE PAGO', MARGIN_X + 8, headerY + 6, { size: 8, bold: true, rgb: mutedText });
    pdf.drawText('VENTAS', MARGIN_X + 340, headerY + 6, { size: 8, bold: true, rgb: mutedText, align: 'right' });
    pdf.drawText('IMPORTE TOTAL', PAGE_WIDTH - MARGIN_X - 8, headerY + 6, {
      size: 8,
      bold: true,
      rgb: mutedText,
      align: 'right'
    });
    pdf.cursorY = headerY;

    report.by_payment_method.forEach((row, idx) => {
      const rowY = pdf.cursorY - 18;
      if (idx % 2 === 1) {
        pdf.drawRect(MARGIN_X, rowY, CONTENT_WIDTH, 18, zebraBg);
      }
      pdf.drawLine(MARGIN_X, rowY, PAGE_WIDTH - MARGIN_X, rowY, border, 0.4);
      pdf.drawText(formatPaymentMethodEs(row.method), MARGIN_X + 8, rowY + 6, { size: 9, bold: true });
      pdf.drawText(String(row.sales_count), MARGIN_X + 340, rowY + 6, { size: 9, align: 'right' });
      pdf.drawText(formatCurrencyMxn(row.revenue_cents), PAGE_WIDTH - MARGIN_X - 8, rowY + 6, {
        size: 9,
        bold: true,
        align: 'right'
      });
      pdf.cursorY = rowY;
    });
    pdf.cursorY -= 20;
  }

  // 4. Artículos Más Vendidos
  ensureSpace(65);
  pdf.drawText('2. Artículos Más Vendidos (Top 10)', MARGIN_X, pdf.cursorY, { size: 11, bold: true, rgb: navy });
  pdf.cursorY -= 10;

  if (report.top_items.length === 0) {
    pdf.cursorY -= 12;
    pdf.drawText('Sin artículos vendidos en este periodo.', MARGIN_X, pdf.cursorY, { size: 9, rgb: mutedText });
    pdf.cursorY -= 18;
  } else {
    const drawTopHeader = () => {
      const hY = pdf.cursorY - 18;
      pdf.drawRect(MARGIN_X, hY, CONTENT_WIDTH, 18, cardBg, border);
      pdf.drawText('SKU', MARGIN_X + 8, hY + 6, { size: 8, bold: true, rgb: mutedText });
      pdf.drawText('ARTÍCULO', MARGIN_X + 110, hY + 6, { size: 8, bold: true, rgb: mutedText });
      pdf.drawText('TALLA / COLOR', MARGIN_X + 295, hY + 6, { size: 8, bold: true, rgb: mutedText });
      pdf.drawText('UDS.', MARGIN_X + 425, hY + 6, { size: 8, bold: true, rgb: mutedText, align: 'right' });
      pdf.drawText('INGRESO', PAGE_WIDTH - MARGIN_X - 8, hY + 6, { size: 8, bold: true, rgb: mutedText, align: 'right' });
      pdf.cursorY = hY;
    };

    drawTopHeader();
    report.top_items.forEach((item, idx) => {
      ensureSpace(20, drawTopHeader);
      const rowY = pdf.cursorY - 18;
      if (idx % 2 === 1) {
        pdf.drawRect(MARGIN_X, rowY, CONTENT_WIDTH, 18, zebraBg);
      }
      pdf.drawLine(MARGIN_X, rowY, PAGE_WIDTH - MARGIN_X, rowY, border, 0.4);
      pdf.drawText(item.sku, MARGIN_X + 8, rowY + 6, { size: 8.5, maxWidth: 96 });
      pdf.drawText(item.name, MARGIN_X + 110, rowY + 6, { size: 8.5, bold: true, maxWidth: 178 });
      pdf.drawText(`${item.size_label} · ${item.color}`, MARGIN_X + 295, rowY + 6, { size: 8.5, maxWidth: 100 });
      pdf.drawText(String(item.units), MARGIN_X + 425, rowY + 6, { size: 8.5, bold: true, align: 'right' });
      pdf.drawText(formatCurrencyMxn(item.revenue_cents), PAGE_WIDTH - MARGIN_X - 8, rowY + 6, {
        size: 8.5,
        bold: true,
        align: 'right'
      });
      pdf.cursorY = rowY;
    });
    pdf.cursorY -= 20;
  }

  // 5. Detalle de Ventas
  ensureSpace(65);
  const detailSubtitle =
    salesTotal > sales.length
      ? `3. Detalle de Ventas (${sales.length} de ${salesTotal} registros)`
      : `3. Detalle de Ventas (${sales.length} registros)`;
  pdf.drawText(detailSubtitle, MARGIN_X, pdf.cursorY, { size: 11, bold: true, rgb: navy });
  pdf.cursorY -= 10;

  if (sales.length === 0) {
    pdf.cursorY -= 12;
    pdf.drawText('No se encontraron ventas para los criterios seleccionados.', MARGIN_X, pdf.cursorY, {
      size: 9,
      rgb: mutedText
    });
  } else {
    const drawSalesHeader = () => {
      const hY = pdf.cursorY - 18;
      pdf.drawRect(MARGIN_X, hY, CONTENT_WIDTH, 18, cardBg, border);
      pdf.drawText('FOLIO', MARGIN_X + 6, hY + 6, { size: 7.5, bold: true, rgb: mutedText });
      pdf.drawText('FECHA / HORA', MARGIN_X + 86, hY + 6, { size: 7.5, bold: true, rgb: mutedText });
      pdf.drawText('PZAS', MARGIN_X + 225, hY + 6, { size: 7.5, bold: true, rgb: mutedText, align: 'right' });
      pdf.drawText('MÉTODO', MARGIN_X + 240, hY + 6, { size: 7.5, bold: true, rgb: mutedText });
      pdf.drawText('RECIBIDO', MARGIN_X + 388, hY + 6, { size: 7.5, bold: true, rgb: mutedText, align: 'right' });
      pdf.drawText('CAMBIO', MARGIN_X + 455, hY + 6, { size: 7.5, bold: true, rgb: mutedText, align: 'right' });
      pdf.drawText('TOTAL', PAGE_WIDTH - MARGIN_X - 6, hY + 6, { size: 7.5, bold: true, rgb: mutedText, align: 'right' });
      pdf.cursorY = hY;
    };

    drawSalesHeader();
    sales.forEach((sale, idx) => {
      ensureSpace(20, drawSalesHeader);
      const rowY = pdf.cursorY - 18;
      if (idx % 2 === 1) {
        pdf.drawRect(MARGIN_X, rowY, CONTENT_WIDTH, 18, zebraBg);
      }
      pdf.drawLine(MARGIN_X, rowY, PAGE_WIDTH - MARGIN_X, rowY, border, 0.4);
      pdf.drawText(sale.folio, MARGIN_X + 6, rowY + 6, { size: 8, bold: true, maxWidth: 76 });
      pdf.drawText(formatHermosilloDateTime(sale.created_at), MARGIN_X + 86, rowY + 6, { size: 8, maxWidth: 108 });
      pdf.drawText(String(sale.items_count), MARGIN_X + 225, rowY + 6, { size: 8, align: 'right' });
      pdf.drawText(formatPaymentMethodEs(sale.payment_method), MARGIN_X + 240, rowY + 6, { size: 8, maxWidth: 78 });
      pdf.drawText(formatCurrencyMxn(sale.amount_received_cents), MARGIN_X + 388, rowY + 6, { size: 8, align: 'right' });
      pdf.drawText(formatCurrencyMxn(sale.change_cents), MARGIN_X + 455, rowY + 6, { size: 8, align: 'right' });
      pdf.drawText(formatCurrencyMxn(sale.total_cents), PAGE_WIDTH - MARGIN_X - 6, rowY + 6, {
        size: 8,
        bold: true,
        align: 'right'
      });
      pdf.cursorY = rowY;
    });
  }

  pdf.addFooters(`Documento interno de control administrativo — ${schoolName || 'Colegio San Miguel'}`);
  return pdf.toPdfBuffer();
}
