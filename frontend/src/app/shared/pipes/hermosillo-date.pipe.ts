import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'hermosilloDate',
  standalone: true
})
export class HermosilloDatePipe implements PipeTransform {
  private readonly formatter = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Hermosillo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  transform(isoDate: string | Date | null | undefined): string {
    if (!isoDate) return '-';
    const parsed = isoDate instanceof Date ? isoDate : new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) return String(isoDate);
    return this.formatter.format(parsed);
  }
}
