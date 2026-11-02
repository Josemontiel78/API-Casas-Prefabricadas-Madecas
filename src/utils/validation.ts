/**
 * Utility validation helpers for Madecas Casas Prefabricadas CRM/ERP
 * Includes Chilean RUT validation (Módulo 11), email validation, and business bounds.
 */

/**
 * Validates Chilean RUT using the Modulo 11 check digit algorithm.
 * Accepts formats: "12.345.678-9", "12345678-9", "123456789", "12345678-K"
 */
export function validateChileanRut(rut: string): boolean {
  if (!rut || typeof rut !== 'string') return false;

  // Clean dots, spaces, dashes
  const cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleanRut.length < 7 || cleanRut.length > 9) return false;

  const body = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1);

  // Body must be only numbers
  if (!/^\d+$/.test(body)) return false;

  // Modulo 11 calculation
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const computedDigit = 11 - remainder;

  let expectedDv = '';
  if (computedDigit === 11) {
    expectedDv = '0';
  } else if (computedDigit === 10) {
    expectedDv = 'K';
  } else {
    expectedDv = computedDigit.toString();
  }

  return dv === expectedDv;
}

/**
 * Formats a Chilean RUT to standard format: XX.XXX.XXX-Y
 */
export function formatChileanRut(rut: string): string {
  if (!rut) return '';
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;

  const dv = clean.slice(-1);
  const body = clean.slice(0, -1);

  // Group thousands
  let formattedBody = '';
  let count = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    formattedBody = body[i] + formattedBody;
    count++;
    if (count % 3 === 0 && i > 0) {
      formattedBody = '.' + formattedBody;
    }
  }

  return `${formattedBody}-${dv}`;
}

/**
 * Standard RFC-5322 compliant regex for email validation
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates sales commission percentage (0% to 30%)
 */
export function validateCommission(pct: number): { valid: boolean; error?: string } {
  if (isNaN(pct)) return { valid: false, error: 'La comisión debe ser un número válido' };
  if (pct < 0) return { valid: false, error: 'La comisión no puede ser negativa' };
  if (pct > 30) return { valid: false, error: 'La comisión no puede superar el 30%' };
  return { valid: true };
}

/**
 * Validates sales monthly target
 */
export function validateMonthlyTarget(target: number): { valid: boolean; error?: string } {
  if (isNaN(target)) return { valid: false, error: 'La meta mensual debe ser un número válido' };
  if (target < 0) return { valid: false, error: 'La meta mensual no puede ser negativa' };
  return { valid: true };
}
