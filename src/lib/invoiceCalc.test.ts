import { describe, expect, it } from 'vitest';
import { calculateInvoiceEur, parseEcbRates, signedInvoiceAmount, totalInvoiceEur, validateInvoiceFile } from './invoiceCalc';

function file(name: string, type: string, bytes: number[], size = bytes.length): File {
  return { name, type, size, slice: () => ({ arrayBuffer: async () => new Uint8Array(bytes).buffer }) } as unknown as File;
}

describe('Invoice amounts', () => {
  it('subtracts credit notes from every total', () => {
    expect(signedInvoiceAmount({ doc_type: 'credit_note', amount_eur: 25 })).toBe(-25);
    expect(totalInvoiceEur([{ doc_type: 'invoice', amount_eur: 100 }, { doc_type: 'receipt', amount_eur: 10 }, { doc_type: 'credit_note', amount_eur: 25 }])).toBe(85);
  });
  it('multiplies original amount by exchange rate to two decimals', () => {
    expect(calculateInvoiceEur(100, 0.876543, 'USD')).toBe(87.65);
  });
  it('always uses rate 1 for EUR', () => {
    expect(calculateInvoiceEur(100, 2, 'EUR')).toBe(100);
  });
  it('requires strictly positive amounts', () => {
    expect(() => calculateInvoiceEur(0, 1, 'EUR')).toThrow();
    expect(() => calculateInvoiceEur(-2, 1, 'EUR')).toThrow();
  });
  it('requires strictly positive exchange rates', () => {
    expect(() => calculateInvoiceEur(100, 0, 'USD')).toThrow();
    expect(() => calculateInvoiceEur(100, NaN, 'USD')).toThrow();
  });
  it('inverts ECB units per EUR and retains six decimals', () => {
    expect(parseEcbRates('<Envelope><Cube><Cube currency="USD" rate="1.25"/><Cube currency="GBP" rate="0.85"/></Cube></Envelope>')).toEqual({ EUR: 1, USD: 0.8, GBP: 1.176471 });
  });
});

describe('Invoice file rules', () => {
  const pdf = [37, 80, 68, 70, 45, 49, 46, 55];
  it('accepts only PDF/JPEG/PNG/WebP signatures', async () => {
    for (const f of [file('a.pdf', 'application/pdf', pdf), file('a.jpg', 'image/jpeg', [255, 216, 255]), file('a.png', 'image/png', [137, 80, 78, 71, 13, 10, 26, 10]), file('a.webp', 'image/webp', [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])]) {
      expect((await validateInvoiceFile(f)).ok).toBe(true);
    }
    expect((await validateInvoiceFile(file('a.doc', 'application/msword', pdf))).ok).toBe(false);
    expect((await validateInvoiceFile(file('a.gif', 'image/gif', [71, 73, 70, 56]))).ok).toBe(false);
  });
  it('requires MIME and extension to match content', async () => {
    expect((await validateInvoiceFile(file('a.pdf', 'image/png', pdf))).ok).toBe(false);
    expect((await validateInvoiceFile(file('a.pdf', 'application/pdf', [77, 90]))).ok).toBe(false);
    expect((await validateInvoiceFile(file('a.pdf', '', pdf))).ok).toBe(false);
  });
  it('enforces the 10MB maximum', async () => {
    expect((await validateInvoiceFile(file('a.pdf', 'application/pdf', pdf, 10485760))).ok).toBe(true);
    expect((await validateInvoiceFile(file('a.pdf', 'application/pdf', pdf, 10485761))).ok).toBe(false);
  });
});