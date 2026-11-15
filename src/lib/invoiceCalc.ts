import { FILE_RULES, validateFile, type FileValidationResult } from '@/lib/fileValidation';

export type InvoiceDocType = 'invoice' | 'receipt' | 'credit_note';
export const INVOICE_FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';
export const INVOICE_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'NOK'] as const;

export function calculateInvoiceEur(amount: number, rate: number, currency: string): number {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) {
    throw new Error('Amount and exchange rate must be positive');
  }
  return Math.round((amount * (currency === 'EUR' ? 1 : rate) + Number.EPSILON) * 100) / 100;
}

export function signedInvoiceAmount(invoice: { doc_type: string; amount_eur: number }): number {
  return (invoice.doc_type === 'credit_note' ? -1 : 1) * Number(invoice.amount_eur);
}

export function totalInvoiceEur(invoices: { doc_type: string; amount_eur: number }[]): number {
  return Math.round(invoices.reduce((sum, invoice) => sum + signedInvoiceAmount(invoice), 0) * 100) / 100;
}

export async function validateInvoiceFile(file: File): Promise<FileValidationResult> {
  const basic = validateFile(file, 'attachment');
  if (!basic.ok) return basic;
  const failure = {
    ok: false,
    errorEn: 'Only genuine PDF, JPG, PNG and WebP files are allowed (maximum 10MB).',
    errorEl: 'Επιτρέπονται μόνο γνήσια PDF, JPG, PNG και WebP (μέχρι 10MB).',
  };
  const ext = file.name.split('.').pop()?.toLowerCase();
  const expected = ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as Record<string, string>)[ext || ''];
  if (!expected || file.type.toLowerCase() !== expected || file.size === 0 || file.size > FILE_RULES.attachment.maxBytes) return failure;
  const h = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const valid = expected === 'application/pdf' ? String.fromCharCode(...h.slice(0, 5)) === '%PDF-'
    : expected === 'image/jpeg' ? h[0] === 255 && h[1] === 216 && h[2] === 255
    : expected === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => h[i] === byte)
    : String.fromCharCode(...h.slice(0, 4)) === 'RIFF' && String.fromCharCode(...h.slice(8, 12)) === 'WEBP';
  return valid ? { ok: true } : failure;
}

export function parseEcbRates(xml: string): Record<string, number> {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid ECB response');
  const rates: Record<string, number> = { EUR: 1 };
  doc.querySelectorAll('Cube[currency][rate]').forEach(node => {
    const currency = node.getAttribute('currency');
    const quoted = Number(node.getAttribute('rate'));
    if (currency && Number.isFinite(quoted) && quoted > 0) rates[currency] = Number((1 / quoted).toFixed(6));
  });
  if (Object.keys(rates).length === 1) throw new Error('No ECB rates available');
  return rates;
}

let ratesRequest: Promise<Record<string, number>> | undefined;
export async function fetchEcbRates(): Promise<Record<string, number>> {
  try {
    const saved = sessionStorage.getItem('skynet-invoice-ecb-rates');
    if (saved) return JSON.parse(saved);
  } catch { /* Session storage may be disabled. */ }
  if (!ratesRequest) {
    ratesRequest = fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', { signal: AbortSignal.timeout(8000) })
      .then(async response => {
        if (!response.ok) throw new Error('ECB unavailable');
        const rates = parseEcbRates(await response.text());
        try { sessionStorage.setItem('skynet-invoice-ecb-rates', JSON.stringify(rates)); } catch { /* Optional cache. */ }
        return rates;
      }).catch(error => { ratesRequest = undefined; throw error; });
  }
  return ratesRequest;
}