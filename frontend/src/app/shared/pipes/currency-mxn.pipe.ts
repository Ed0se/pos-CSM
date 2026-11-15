import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'currencyMxn',
  standalone: true
})
export class CurrencyMxnPipe implements PipeTransform {
  private formatter = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  });

  transform(cents: number | null | undefined): string {
    if (cents === null || cents === undefined || isNaN(cents)) {
      return this.formatter.format(0);
    }
    return this.formatter.format(cents / 100);
  }
}
