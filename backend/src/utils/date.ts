const HERMOSILLO_TZ = 'America/Hermosillo';
const DATE_STR_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convierte una fecha devuelta por MySQL (en sesión UTC '+00:00') a cadena ISO 8601 UTC.
 */
export function toIsoUtc(mysqlDate: string | Date): string {
  if (mysqlDate instanceof Date) {
    return mysqlDate.toISOString();
  }
  const normalized = mysqlDate.trim().replace(' ', 'T');
  const withZone = normalized.endsWith('Z') ? normalized : `${normalized}Z`;
  const parsed = new Date(withZone);
  if (Number.isNaN(parsed.getTime())) {
    return mysqlDate;
  }
  return parsed.toISOString();
}

/**
 * Formatea un objeto Date en formato MySQL UTC 'YYYY-MM-DD HH:mm:ss.SSS'.
 */
function formatDateToUtcSql(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}.${ms}`;
}

/**
 * Convierte una fecha local YYYY-MM-DD de America/Hermosillo (UTC-07:00 fijo)
 * al inicio de ese día en UTC en formato MySQL 'YYYY-MM-DD HH:mm:ss.000'.
 */
export function hermosilloDateToUtcSql(dateStr: string): string {
  if (!DATE_STR_REGEX.test(dateStr)) {
    throw new Error(`Formato de fecha inválido: ${dateStr}. Se esperaba YYYY-MM-DD`);
  }
  const instant = new Date(`${dateStr}T00:00:00.000-07:00`);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Fecha inválida: ${dateStr}`);
  }
  return formatDateToUtcSql(instant);
}

/**
 * Suma días a una cadena YYYY-MM-DD usando calendario UTC sin cambios de horario.
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  if (!DATE_STR_REGEX.test(dateStr)) {
    throw new Error(`Formato de fecha inválido: ${dateStr}. Se esperaba YYYY-MM-DD`);
  }
  const parts = dateStr.split('-').map(Number);
  const year = parts[0]!;
  const month = parts[1]!;
  const day = parts[2]!;
  const utcDate = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = utcDate.getUTCFullYear();
  const mm = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Obtiene la fecha actual YYYY-MM-DD en la zona horaria America/Hermosillo.
 */
export function getTodayHermosilloDateStr(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HERMOSILLO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

export interface HermosilloDateRange {
  from: string;
  to: string;
  fromUtcSql: string;
  toUtcSql: string;
}

/**
 * Resuelve un intervalo semiabierto [from, to) de fechas locales en America/Hermosillo
 * y devuelve los límites UTC para consultas SQL.
 * Si from === to, extiende `to` en +1 día para abarcar ese día completo.
 */
export function resolveHermosilloDateRange(from?: string, to?: string): HermosilloDateRange {
  const today = getTodayHermosilloDateStr();
  const effectiveFrom = from && DATE_STR_REGEX.test(from) ? from : today;
  let effectiveTo = to && DATE_STR_REGEX.test(to) ? to : addDaysToDateStr(effectiveFrom, 1);

  if (effectiveTo <= effectiveFrom) {
    effectiveTo = addDaysToDateStr(effectiveFrom, 1);
  }

  return {
    from: effectiveFrom,
    to: effectiveTo,
    fromUtcSql: hermosilloDateToUtcSql(effectiveFrom),
    toUtcSql: hermosilloDateToUtcSql(effectiveTo)
  };
}
